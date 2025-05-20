import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { WireguardPeer } from '@shared/schema';
import { log } from '../vite';

// Definizione di un punto dati per l'utilizzo nel tempo
export interface UsageDataPoint {
  timestamp: string; // ISO string
  download: number; // bytes
  upload: number; // bytes
  total: number; // bytes
  activePeers: number; // count
}

// Definizione della struttura di utilizzo per peer
export interface PeerUsageData {
  peerId: number;
  peerName: string;
  data: UsageDataPoint[];
}

/**
 * Servizio per registrare e recuperare statistiche di utilizzo WireGuard nel tempo
 */
class WireGuardUsageService {
  private usageDir: string;
  private currentUsage: Map<number, UsageDataPoint[]>;
  private usageInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Crea directory di utilizzo se non esiste
    this.usageDir = path.join(process.cwd(), 'data', 'wireguard-usage');
    fs.mkdirSync(this.usageDir, { recursive: true });

    this.currentUsage = new Map();

    log('Servizio utilizzo WireGuard inizializzato', 'express');
  }

  /**
   * Avvia il monitoraggio periodico dell'utilizzo
   * @param intervalMinutes Intervallo in minuti tra i campionamenti
   */
  startPeriodicUsageTracking(intervalMinutes: number = 15) { // Default: ogni 15 minuti
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
    }

    // Esegui subito un campionamento all'avvio
    this.recordCurrentUsage();

    // Imposta l'intervallo per i campionamenti futuri
    this.usageInterval = setInterval(() => {
      this.recordCurrentUsage();
    }, intervalMinutes * 60 * 1000);

    log(`Monitoraggio periodico utilizzo WireGuard avviato con intervallo di ${intervalMinutes} minuti`, 'express');
  }

  /**
   * Arresta il monitoraggio periodico
   */
  stopPeriodicUsageTracking() {
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
      this.usageInterval = null;
      log('Monitoraggio periodico utilizzo WireGuard arrestato', 'express');
    }
  }

  /**
   * Registra l'utilizzo corrente di tutti i peer WireGuard
   */
  async recordCurrentUsage() {
    try {
      // Ottieni tutti i peer WireGuard dal database
      const peers = await storage.getAllWireguardPeers();

      if (!peers || peers.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString();
      let totalActivePeers = 0;

      // Per ogni peer, registra l'utilizzo corrente
      for (const peer of peers) {
        if (peer.isOnline) {
          totalActivePeers++;
        }

        // Crea un punto dati per questo peer
        const dataPoint: UsageDataPoint = {
          timestamp,
          download: peer.transferRx || 0,
          upload: peer.transferTx || 0,
          total: (peer.transferRx || 0) + (peer.transferTx || 0),
          activePeers: peer.isOnline ? 1 : 0
        };

        // Aggiungi il punto dati alla memoria
        if (!this.currentUsage.has(peer.id)) {
          this.currentUsage.set(peer.id, []);
        }

        this.currentUsage.get(peer.id)?.push(dataPoint);

        // Mantieni solo gli ultimi 1000 punti dati in memoria
        const peerData = this.currentUsage.get(peer.id);
        if (peerData && peerData.length > 1000) {
          this.currentUsage.set(peer.id, peerData.slice(peerData.length - 1000));
        }
      }

      // Salva i dati su disco
      this.saveUsageData();

      log(`Utilizzo WireGuard registrato: ${totalActivePeers} peer attivi`, 'express');
    } catch (error) {
      console.error('Errore durante la registrazione dell\'utilizzo WireGuard:', error);
    }
  }

  /**
   * Salva i dati di utilizzo correnti su disco
   */
  private saveUsageData() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Per ogni peer, salva i dati di oggi in un file separato
      this.currentUsage.forEach((dataPoints, peerId) => {
        // Filtra solo i dati di oggi
        const todayData = dataPoints.filter(point => 
          point.timestamp.startsWith(today)
        );

        if (todayData.length === 0) return;

        // Crea un file per questo peer e per oggi
        const peerDir = path.join(this.usageDir, `peer_${peerId}`);
        fs.mkdirSync(peerDir, { recursive: true });

        const filePath = path.join(peerDir, `${today}.json`);

        // Se il file esiste già, aggiorna i dati, altrimenti crea un nuovo file
        let fileData: UsageDataPoint[] = [];
        if (fs.existsSync(filePath)) {
          try {
            fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Rimuovi eventuali dati duplicati per lo stesso timestamp
            const existingTimestamps = new Set(fileData.map(point => point.timestamp));

            // Aggiungi solo i nuovi dati
            for (const point of todayData) {
              if (!existingTimestamps.has(point.timestamp)) {
                fileData.push(point);
              }
            }
          } catch (e) {
            console.error(`Errore nella lettura del file di utilizzo ${filePath}:`, e);
            fileData = [...todayData];
          }
        } else {
          fileData = [...todayData];
        }

        // Ordina per timestamp crescente
        fileData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Salva il file
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
      });
    } catch (error) {
      console.error('Errore durante il salvataggio dei dati di utilizzo WireGuard:', error);
    }
  }

  /**
   * Ottiene i dati di utilizzo per tutti i peer o per un peer specifico
   * @param peerId Opzionale: ID del peer per cui recuperare i dati
   * @param timeRange Intervallo di tempo: '24h', '7d', '30d', 'all'
   */
  async getUsageData(peerId?: number, timeRange: '24h' | '7d' | '30d' | 'all' = '7d'): Promise<PeerUsageData[]> {
    try {
      // Determina l'intervallo di date da recuperare
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          startDate = new Date(0); // Inizio dei tempi
      }

      // Lista di tutti i peer o solo quello richiesto
      let peers: WireguardPeer[];
      if (peerId !== undefined) {
        const peer = await storage.getWireguardPeer(peerId);
        peers = peer ? [peer] : [];
      } else {
        peers = await storage.getAllWireguardPeers();
      }

      // Prepara i risultati
      const result: PeerUsageData[] = [];

      // Per ogni peer, recupera i dati di utilizzo
      for (const peer of peers) {
        const peerDir = path.join(this.usageDir, `peer_${peer.id}`);

        // Verifica che la directory del peer esista
        if (!fs.existsSync(peerDir) || !fs.statSync(peerDir).isDirectory()) {
          // Aggiungi solo i dati in memoria per questo peer, se presenti
          const memoryData = this.currentUsage.get(peer.id) || [];
          const filteredData = memoryData.filter(point => 
            new Date(point.timestamp) >= startDate
          );

          if (filteredData.length > 0) {
            result.push({
              peerId: peer.id,
              peerName: peer.name,
              data: filteredData
            });
          }

          continue;
        }

        // Leggi tutti i file nella directory che rientrano nell'intervallo di date
        const files = fs.readdirSync(peerDir)
          .filter(filename => filename.endsWith('.json'))
          .filter(filename => {
            const fileDate = new Date(filename.replace('.json', ''));
            return !isNaN(fileDate.getTime()) && fileDate >= startDate;
          })
          .sort(); // Ordina per nome file (che è basato sulla data)

        // Dati aggregati per questo peer
        let peerData: UsageDataPoint[] = [];

        // Leggi e aggrega i dati da ogni file
        for (const filename of files) {
          try {
            const filePath = path.join(peerDir, filename);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileData: UsageDataPoint[] = JSON.parse(fileContent);

            // Filtra solo i punti dati nell'intervallo
            const filteredData = fileData.filter(point => 
              new Date(point.timestamp) >= startDate
            );

            peerData = [...peerData, ...filteredData];
          } catch (e) {
            console.error(`Errore nella lettura del file di utilizzo ${filename}:`, e);
          }
        }

        // Aggiungi anche i dati in memoria che potrebbero non essere ancora stati salvati
        const memoryData = this.currentUsage.get(peer.id) || [];
        const filteredMemoryData = memoryData.filter(point => 
          new Date(point.timestamp) >= startDate
        );

        // Combina i dati da disco e memoria, rimuovendo duplicati
        const allTimestamps = new Set(peerData.map(point => point.timestamp));
        for (const point of filteredMemoryData) {
          if (!allTimestamps.has(point.timestamp)) {
            peerData.push(point);
          }
        }

        // Ordina per timestamp
        peerData.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Aggiungi i dati per questo peer al risultato
        if (peerData.length > 0) {
          result.push({
            peerId: peer.id,
            peerName: peer.name,
            data: peerData
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Errore nel recupero dei dati di utilizzo WireGuard:', error);
      return [];
    }
  }

  /**
   * Calcola le statistiche di utilizzo aggregate per un determinato periodo
   * @param timeRange Intervallo di tempo per cui calcolare le statistiche
   */
  async getAggregateStats(timeRange: '24h' | '7d' | '30d' | 'all' = '7d') {
    try {
      const allUsageData = await this.getUsageData(undefined, timeRange);

      let totalDownload = 0;
      let totalUpload = 0;
      let peakTotal = 0;
      let peakDownload = 0;
      let peakUpload = 0;
      let avgActivePeers = 0;
      let totalDataPoints = 0;

      // Calcola le statistiche aggregate
      allUsageData.forEach(peerData => {
        peerData.data.forEach(point => {
          totalDownload += point.download;
          totalUpload += point.upload;
          peakTotal = Math.max(peakTotal, point.total);
          peakDownload = Math.max(peakDownload, point.download);
          peakUpload = Math.max(peakUpload, point.upload);
          avgActivePeers += point.activePeers;
          totalDataPoints++;
        });
      });

      // Calcola media
      avgActivePeers = totalDataPoints > 0 ? avgActivePeers / totalDataPoints : 0;

      return {
        totalDownload,
        totalUpload,
        totalTraffic: totalDownload + totalUpload,
        peakTotal,
        peakDownload,
        peakUpload,
        avgActivePeers
      };
    } catch (error) {
      console.error('Errore nel calcolo delle statistiche aggregate:', error);
      return {
        totalDownload: 0,
        totalUpload: 0,
        totalTraffic: 0,
        peakTotal: 0,
        peakDownload: 0,
        peakUpload: 0,
        avgActivePeers: 0
      };
    }
  }
}

// Crea l'istanza del servizio di utilizzo
export const wireguardUsage = new WireGuardUsageService();

// Avvia il monitoraggio periodico all'avvio dell'applicazione (ogni 15 minuti)
wireguardUsage.startPeriodicUsageTracking(15);