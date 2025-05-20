import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { WireguardPeer } from '@shared/schema';
import { log } from '../vite';

/**
 * Servizio per gestire i backup delle configurazioni WireGuard
 */
class WireGuardBackupService {
  private backupDir: string;
  private configDir: string;
  private backupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Crea directory di backup se non esiste
    this.backupDir = path.join(process.cwd(), 'backups', 'wireguard');
    this.configDir = path.join(process.cwd(), 'configs', 'wireguard');
    
    // Crea le directory se non esistono
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(this.configDir, { recursive: true });
    
    log('Servizio backup WireGuard inizializzato', 'express');
  }
  
  /**
   * Avvia il backup periodico delle configurazioni
   * @param intervalMinutes Intervallo in minuti tra i backup
   */
  startPeriodicBackup(intervalMinutes: number = 1440) { // Default: una volta al giorno
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    // Esegui subito un backup all'avvio
    this.backupAllPeerConfigs();
    
    // Imposta l'intervallo per i backup futuri
    this.backupInterval = setInterval(() => {
      this.backupAllPeerConfigs();
    }, intervalMinutes * 60 * 1000);
    
    log(`Backup periodico WireGuard avviato con intervallo di ${intervalMinutes} minuti`, 'express');
  }
  
  /**
   * Arresta il backup periodico
   */
  stopPeriodicBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      log('Backup periodico WireGuard arrestato', 'express');
    }
  }
  
  /**
   * Esegue il backup di tutte le configurazioni dei peer
   */
  async backupAllPeerConfigs() {
    try {
      // Ottieni tutti i peer WireGuard dal database
      const peers = await storage.getAllWireguardPeers();
      
      if (!peers || peers.length === 0) {
        log('Nessun peer WireGuard da sottoporre a backup', 'express');
        return;
      }
      
      // Crea un timestamp per la cartella di backup
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFolder = path.join(this.backupDir, `backup_${timestamp}`);
      fs.mkdirSync(backupFolder, { recursive: true });
      
      // Backup di ogni peer
      for (const peer of peers) {
        await this.backupPeerConfig(peer, backupFolder);
      }
      
      // Backup del database come JSON
      fs.writeFileSync(
        path.join(backupFolder, 'peers_database.json'),
        JSON.stringify(peers, null, 2)
      );
      
      log(`Backup completato: ${peers.length} configurazioni WireGuard salvate in ${backupFolder}`, 'express');
    } catch (error) {
      console.error('Errore durante il backup delle configurazioni WireGuard:', error);
    }
  }
  
  /**
   * Esegue il backup della configurazione di un singolo peer
   */
  async backupPeerConfig(peer: WireguardPeer, backupFolder: string) {
    try {
      // Crea un file di configurazione in formato simile a quello WireGuard
      const configContent = this.generateConfigFromPeer(peer);
      
      // Salva il file di configurazione
      const filename = `${peer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.conf`;
      fs.writeFileSync(path.join(backupFolder, filename), configContent);
      
      // Aggiorna anche la copia più recente nella cartella configs
      fs.writeFileSync(path.join(this.configDir, filename), configContent);
      
    } catch (error) {
      console.error(`Errore durante il backup del peer ${peer.name}:`, error);
    }
  }
  
  /**
   * Genera il contenuto della configurazione da un peer
   */
  private generateConfigFromPeer(peer: WireguardPeer): string {
    // Nota: questo è solo il formato del file, la chiave privata effettiva non è disponibile
    // Questo è solo per scopi di backup e documentazione
    return `# Backup configurazione WireGuard per ${peer.name}
# Generato il: ${new Date().toISOString()}
# ID: ${peer.id}
# Descrizione: ${peer.description || 'Nessuna descrizione'}

[Interface]
# Chiave pubblica: ${peer.publicKey}
Address = ${peer.allowedIps}
# La chiave privata non è disponibile nel backup per motivi di sicurezza

[Peer]
# Server WireGuard
PublicKey = SERVER_PUBLIC_KEY
Endpoint = SERVER_ENDPOINT:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Metadati aggiuntivi (non usati da WireGuard)
# Creato da: ${peer.createdBy}
# Creato il: ${peer.createdAt}
# Ultimo handshake: ${peer.lastHandshake || 'Mai'}
# Dispositivo attivo: ${peer.enabled ? 'Sì' : 'No'}
# Traffico download: ${peer.transferRx || 0} bytes
# Traffico upload: ${peer.transferTx || 0} bytes
`;
  }
  
  /**
   * Ripristina un backup specifico
   */
  async restoreBackup(backupName: string) {
    try {
      const backupPath = path.join(this.backupDir, backupName);
      
      // Verifica che la directory di backup esista
      if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isDirectory()) {
        throw new Error(`Backup "${backupName}" non trovato`);
      }
      
      // Leggi il file del database
      const dbPath = path.join(backupPath, 'peers_database.json');
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database non trovato nel backup "${backupName}"`);
      }
      
      const peersData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      
      // Ripristina ogni peer nel database
      let restoredCount = 0;
      for (const peerData of peersData) {
        // Controlla se il peer esiste già
        const existingPeer = await storage.getWireguardPeerByPublicKey(peerData.publicKey);
        
        if (existingPeer) {
          // Aggiorna il peer esistente
          await storage.updateWireguardPeer(existingPeer.id, {
            name: peerData.name,
            description: peerData.description,
            enabled: peerData.enabled
          });
        } else {
          // Crea un nuovo peer
          await storage.createWireguardPeer(peerData);
        }
        
        restoredCount++;
      }
      
      log(`Ripristino completato: ${restoredCount} configurazioni WireGuard ripristinate dal backup "${backupName}"`, 'express');
      return { success: true, restoredCount };
    } catch (error) {
      console.error('Errore durante il ripristino del backup:', error);
      throw error;
    }
  }
  
  /**
   * Ottiene l'elenco dei backup disponibili
   */
  getAvailableBackups() {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(name => fs.statSync(path.join(this.backupDir, name)).isDirectory())
        .map(name => {
          try {
            const stats = fs.statSync(path.join(this.backupDir, name));
            const peerDbPath = path.join(this.backupDir, name, 'peers_database.json');
            let peerCount = 0;
            
            if (fs.existsSync(peerDbPath)) {
              const peersData = JSON.parse(fs.readFileSync(peerDbPath, 'utf8'));
              peerCount = peersData.length;
            }
            
            return {
              name,
              date: stats.mtime,
              size: this.getDirectorySize(path.join(this.backupDir, name)),
              peerCount
            };
          } catch (e) {
            return {
              name,
              date: new Date(0),
              size: 0,
              peerCount: 0,
              error: true
            };
          }
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime()); // Ordina per data più recente
      
      return backups;
    } catch (error) {
      console.error('Errore nel recupero dei backup disponibili:', error);
      return [];
    }
  }
  
  /**
   * Calcola la dimensione di una directory
   */
  private getDirectorySize(directoryPath: string): number {
    let totalSize = 0;
    
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
  
  /**
   * Elimina un backup specifico
   */
  deleteBackup(backupName: string) {
    try {
      const backupPath = path.join(this.backupDir, backupName);
      
      // Verifica che la directory di backup esista
      if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isDirectory()) {
        throw new Error(`Backup "${backupName}" non trovato`);
      }
      
      // Elimina la directory ricorsivamente
      fs.rmSync(backupPath, { recursive: true, force: true });
      
      log(`Backup "${backupName}" eliminato con successo`, 'express');
      return { success: true };
    } catch (error) {
      console.error('Errore durante l\'eliminazione del backup:', error);
      throw error;
    }
  }
}

// Crea l'istanza del servizio di backup
export const wireguardBackup = new WireGuardBackupService();

// Avvia il backup periodico all'avvio dell'applicazione (ogni 12 ore)
wireguardBackup.startPeriodicBackup(12 * 60);