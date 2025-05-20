import * as crypto from 'crypto';
import * as child_process from 'child_process';
import * as util from 'util';
import { storage } from '../storage';
import { log } from '../vite';

const exec = util.promisify(child_process.exec);

// Interfaccia per la configurazione temporanea
interface TempConfig {
  content: string;
  filename: string;
  timestamp: number;
}

// Cache in-memory delle configurazioni temporanee
const tempConfigs: Record<string, TempConfig> = {};

/**
 * Servizio per gestire le operazioni WireGuard
 */
export class WireGuardService {
  private serverPublicKey: string;
  private serverEndpoint: string;

  constructor() {
    this.serverPublicKey = process.env.WG_SERVER_PUBLIC_KEY || '';
    this.serverEndpoint = process.env.WG_SERVER_ENDPOINT || '';
    
    if (!this.serverPublicKey || !this.serverEndpoint) {
      log('Configurazione WireGuard incompleta. Sono necessari WG_SERVER_PUBLIC_KEY e WG_SERVER_ENDPOINT.', 'express');
    } else {
      log('Servizio WireGuard inizializzato con successo', 'express');
    }
  }

  /**
   * Verifica se la configurazione WireGuard è pronta
   */
  isConfigured(): boolean {
    return !!(this.serverPublicKey && this.serverEndpoint);
  }

  /**
   * Genera una nuova chiave privata WireGuard
   */
  async generatePrivateKey(): Promise<string> {
    try {
      // In un ambiente reale, utilizzeresti wg genkey
      // const { stdout } = await exec('wg genkey');
      // return stdout.trim();
      
      // Simuliamo la generazione di una chiave per semplicità
      const privateKey = crypto.randomBytes(32).toString('base64');
      return privateKey;
    } catch (error) {
      console.error('Errore nella generazione della chiave privata:', error);
      throw new Error('Impossibile generare la chiave privata WireGuard');
    }
  }

  /**
   * Deriva la chiave pubblica dalla chiave privata
   */
  async derivePublicKey(privateKey: string): Promise<string> {
    try {
      // In un ambiente reale, utilizzeresti wg pubkey
      // const { stdout } = await exec(`echo "${privateKey}" | wg pubkey`);
      // return stdout.trim();
      
      // Simuliamo la derivazione della chiave pubblica
      const publicKey = crypto.createHash('sha256').update(privateKey).digest('base64');
      return publicKey;
    } catch (error) {
      console.error('Errore nella derivazione della chiave pubblica:', error);
      throw new Error('Impossibile derivare la chiave pubblica WireGuard');
    }
  }

  /**
   * Trova un indirizzo IP disponibile nella sottorete WireGuard
   */
  async findAvailableIP(): Promise<string | null> {
    try {
      // Ottieni tutti i peer esistenti per trovare gli indirizzi IP già in uso
      const peers = await storage.getAllWireguardPeers();
      const usedIPs = peers.map(peer => {
        const ipWithoutMask = peer.allowedIps.split('/')[0];
        return ipWithoutMask;
      });
      
      // Nella sottorete 10.0.0.0/24, trova il primo IP disponibile
      // Inizia da 10.0.0.2 (10.0.0.1 è tipicamente il server)
      for (let i = 2; i <= 254; i++) {
        const ip = `10.0.0.${i}`;
        if (!usedIPs.includes(ip)) {
          return ip;
        }
      }
      
      return null; // Tutti gli IP sono in uso
    } catch (error) {
      console.error('Errore nella ricerca di un IP disponibile:', error);
      throw new Error('Impossibile trovare un indirizzo IP disponibile');
    }
  }

  /**
   * Aggiunge un peer alla configurazione del server WireGuard
   */
  async addPeerToServer(publicKey: string, ipAddress: string): Promise<boolean> {
    try {
      // In un ambiente reale, utilizzeresti comandi wg o modificheresti il file di configurazione
      // Ad esempio:
      // await exec(`sudo wg set wg0 peer ${publicKey} allowed-ips ${ipAddress}/32`);
      
      // Simuliamo l'aggiunta del peer
      log(`[WireGuard] Aggiunto peer ${publicKey} con IP ${ipAddress}`, 'express');
      return true;
    } catch (error) {
      console.error('Errore nell\'aggiunta del peer al server WireGuard:', error);
      return false;
    }
  }

  /**
   * Rimuove un peer dalla configurazione del server WireGuard
   */
  async removePeerFromServer(publicKey: string): Promise<boolean> {
    try {
      // In un ambiente reale, utilizzeresti comandi wg
      // Ad esempio:
      // await exec(`sudo wg set wg0 peer ${publicKey} remove`);
      
      // Simuliamo la rimozione del peer
      log(`[WireGuard] Rimosso peer ${publicKey}`, 'express');
      return true;
    } catch (error) {
      console.error('Errore nella rimozione del peer dal server WireGuard:', error);
      return false;
    }
  }

  /**
   * Genera il contenuto di un file di configurazione per il client
   */
  generateClientConfig(privateKey: string, ipAddress: string): string {
    // Genera la configurazione WireGuard
    return `[Interface]
PrivateKey = ${privateKey}
Address = ${ipAddress}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${this.serverPublicKey}
AllowedIPs = 10.0.0.0/24
Endpoint = ${this.serverEndpoint}
PersistentKeepalive = 25
`;
  }

  /**
   * Salva temporaneamente una configurazione per il download
   */
  storeTempConfig(id: string, content: string, filename: string): void {
    tempConfigs[id] = {
      content,
      filename,
      timestamp: Date.now()
    };
  }

  /**
   * Recupera una configurazione temporanea
   */
  getTempConfig(id: string): TempConfig | null {
    const config = tempConfigs[id];
    if (!config) return null;
    
    // Verifica che la configurazione non sia scaduta (30 minuti)
    const configAge = Date.now() - config.timestamp;
    if (configAge > 30 * 60 * 1000) {
      delete tempConfigs[id];
      return null;
    }
    
    return config;
  }

  /**
   * Pulisce le configurazioni temporanee scadute
   */
  cleanupTempConfigs(): void {
    const now = Date.now();
    Object.keys(tempConfigs).forEach(key => {
      const configAge = now - tempConfigs[key].timestamp;
      if (configAge > 30 * 60 * 1000) {
        delete tempConfigs[key];
      }
    });
  }
  
  /**
   * Ottiene lo stato attuale di WireGuard
   */
  async getWireGuardStatus(): Promise<WireguardStatus> {
    try {
      // In un ambiente reale, eseguiremmo il comando 'wg show' per ottenere lo stato
      // Per ora, simuliamo uno stato WireGuard con dati di esempio
      
      // Otteniamo i peer dal database
      const dbPeers = await storage.getAllWireguardPeers();
      
      // Convertiamo in WireguardPeerStatus
      const peers: WireguardPeerStatus[] = dbPeers.map(peer => ({
        publicKey: peer.publicKey,
        allowedIps: peer.allowedIps,
        latestHandshake: new Date(peer.lastHandshake || Date.now() - Math.random() * 3600000).toISOString(),
        transferRx: peer.transferRx || Math.floor(Math.random() * 100000000),
        transferTx: peer.transferTx || Math.floor(Math.random() * 100000000),
        persistentKeepalive: '25'
      }));
      
      // Calcola il traffico totale
      const totalRx = peers.reduce((sum, peer) => sum + (peer.transferRx || 0), 0);
      const totalTx = peers.reduce((sum, peer) => sum + (peer.transferTx || 0), 0);
      const totalTraffic = formatBytes(totalRx + totalTx);
      
      // Calcola statistiche aggiuntive
      const onlinePeers = dbPeers.filter(peer => peer.isOnline).length;
      
      return {
        interface: 'wg0',
        listenPort: 51820,
        publicKey: process.env.WG_SERVER_PUBLIC_KEY || 'SERVER_PUBLIC_KEY',
        peers,
        status: 'online',
        totalTraffic,
        onlinePeers,
        totalPeers: dbPeers.length
      };
    } catch (error) {
      console.error('Errore nel recupero dello stato WireGuard:', error);
      return {
        interface: 'wg0',
        listenPort: 51820,
        publicKey: process.env.WG_SERVER_PUBLIC_KEY || 'SERVER_PUBLIC_KEY',
        peers: [],
        status: 'degraded',
        totalTraffic: '0 B',
        onlinePeers: 0,
        totalPeers: 0
      };
    }
  }
}

// Esporta un'istanza singleton
// Interfaccia per lo stato WireGuard
export interface WireguardPeerStatus {
  publicKey: string;
  allowedIps: string;
  latestHandshake: string;
  transferRx?: number;
  transferTx?: number;
  persistentKeepalive?: string;
}

// Interfaccia per lo stato completo di WireGuard
export interface WireguardStatus {
  interface: string;
  listenPort: number;
  publicKey: string;
  peers: WireguardPeerStatus[];
  status: 'online' | 'offline' | 'degraded';
  totalTraffic: string;
  onlinePeers: number;
  totalPeers: number;
}

export const wireguard = new WireGuardService();

/**
 * Ottiene lo stato attuale di WireGuard
 */
export async function getWireguardStatus(): Promise<WireguardStatus> {
  return await wireguard.getWireGuardStatus();
}

/**
 * Genera un file di configurazione WireGuard per un client
 */
export async function generateWireguardConfig(name: string): Promise<{config: string, filename: string, peerId?: number} | null> {
  try {
    // Genera una nuova chiave privata
    const privateKey = await wireguard.generatePrivateKey();
    const publicKey = await wireguard.derivePublicKey(privateKey);
    
    // Trova un IP disponibile
    const ipAddress = await wireguard.findAvailableIP();
    if (!ipAddress) {
      throw new Error('Nessun indirizzo IP disponibile');
    }
    
    // Genera la configurazione
    const config = wireguard.generateClientConfig(privateKey, ipAddress);
    const filename = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.conf`;
    
    // Salva la configurazione nel database
    const peer = await storage.createWireguardPeer({
      userId: null,
      name,
      description: `Configurazione generata per ${name}`,
      publicKey,
      allowedIps: `${ipAddress}/32`,
      createdBy: 'api',
      enabled: true
    });
    
    // Aggiungi il peer alla configurazione WireGuard
    await wireguard.addPeerToServer(publicKey, ipAddress);
    
    return { config, filename, peerId: peer.id };
  } catch (error) {
    console.error('Errore nella generazione della configurazione WireGuard:', error);
    return null;
  }
}

// Funzione di utility per formattare i byte in una stringa leggibile
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Avvia un processo di pulizia periodico per le configurazioni temporanee
setInterval(() => wireguard.cleanupTempConfigs(), 15 * 60 * 1000); // Pulisci ogni 15 minuti