import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { log } from '../vite';
import { storage } from '../storage';
import { getWireguardStatus } from './wireguard';

/**
 * Classe per il monitoraggio della rete WireGuard
 * Tiene traccia delle connessioni e disconnessioni e invia notifiche
 */
class WireGuardMonitor {
  private client: Client | null = null;
  private alertChannelId: string | null = null;
  private interval: NodeJS.Timeout | null = null;
  private lastPeerStatus: Map<string, boolean> = new Map(); // <publicKey, isOnline>
  private initialized = false;

  /**
   * Inizializza il monitoraggio WireGuard
   */
  initialize(client: Client, alertChannelId?: string) {
    if (this.initialized) {
      log('Monitoraggio WireGuard già inizializzato', 'express');
      return;
    }
    
    this.client = client;
    if (alertChannelId) {
      this.alertChannelId = alertChannelId;
    }
    
    // Avvia il controllo periodico
    this.startMonitoring();
    
    this.initialized = true;
    log('Monitoraggio WireGuard inizializzato con successo', 'express');
  }
  
  /**
   * Avvia il monitoraggio periodico
   */
  private startMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    // Esegui un controllo immediato
    this.checkPeersStatus();
    
    // Imposta un controllo periodico ogni 3 minuti
    this.interval = setInterval(() => this.checkPeersStatus(), 3 * 60 * 1000);
    log('Monitoraggio periodico WireGuard avviato', 'express');
  }
  
  /**
   * Controlla lo stato di tutti i peer e notifica i cambiamenti
   */
  private async checkPeersStatus() {
    try {
      // Ottieni lo stato attuale di WireGuard
      const wireguardStatus = await getWireguardStatus();
      
      // Ottieni tutti i peer dal database
      const configuredPeers = await storage.getAllWireguardPeers();
      
      // Mappa per tracciare quali peer hanno risposto
      const respondedPeers = new Set<string>();
      
      // Elabora i peer attivi
      for (const peer of wireguardStatus.peers) {
        // Controlla se è stata definita una chiave pubblica
        if (!peer.publicKey) continue;
        
        // Marca questo peer come risposto
        respondedPeers.add(peer.publicKey);
        
        // Cerca le informazioni aggiuntive nel database
        const dbPeer = configuredPeers.find(p => p.publicKey === peer.publicKey);
        if (!dbPeer) continue;
        
        // Verifica se il peer è online (handshake negli ultimi 3 minuti)
        const handshakeTimestamp = peer.latestHandshake ? parseInt(peer.latestHandshake) : 0;
        const isOnline = handshakeTimestamp > 0 && (Math.floor(Date.now() / 1000) - handshakeTimestamp) < 180;
        
        // Verifica se lo stato del peer è cambiato
        const wasOnline = this.lastPeerStatus.get(peer.publicKey) === true;
        
        // Aggiorna il database
        if (dbPeer.isOnline !== isOnline) {
          await storage.updateWireguardPeer(dbPeer.id, { isOnline });
        }
        
        // Notifica il cambiamento di stato
        if (isOnline !== wasOnline) {
          // Aggiorna la mappa di stato
          this.lastPeerStatus.set(peer.publicKey, isOnline);
          
          // Notifica solo se lo stato è cambiato
          if (isOnline && !wasOnline) {
            // Il peer si è connesso
            this.notifyPeerConnection(dbPeer.name || dbPeer.allowedIps, peer.allowedIps);
            
            // Aggiorna il numero totale di connessioni
            const totalConnections = (dbPeer.totalConnections || 0) + 1;
            await storage.updateWireguardPeer(dbPeer.id, { 
              lastHandshake: new Date().toISOString(),
              totalConnections,
              transferRx: peer.transferRx || 0,
              transferTx: peer.transferTx || 0
            });
          } else if (!isOnline && wasOnline) {
            // Il peer si è disconnesso
            this.notifyPeerDisconnection(dbPeer.name || dbPeer.allowedIps, peer.allowedIps);
            
            // Aggiorna il tempo dell'ultima connessione
            if (dbPeer.lastHandshake) {
              const lastConnTime = new Date(dbPeer.lastHandshake).getTime();
              const duration = Math.floor((Date.now() - lastConnTime) / 1000);
              
              await storage.updateWireguardPeer(dbPeer.id, {
                lastConnectionDuration: duration,
                transferRx: peer.transferRx || 0,
                transferTx: peer.transferTx || 0
              });
            }
          }
        }
        
        // Aggiorna sempre i dati di trasferimento
        if (peer.transferRx !== undefined || peer.transferTx !== undefined) {
          await storage.updateWireguardPeer(dbPeer.id, {
            transferRx: peer.transferRx,
            transferTx: peer.transferTx
          });
        }
      }
      
      // Verifica i peer che non hanno risposto ma sono contrassegnati come online
      for (const dbPeer of configuredPeers) {
        if (dbPeer.isOnline && !respondedPeers.has(dbPeer.publicKey)) {
          // Il peer è segnato come online ma non ha risposto
          const wasOnline = this.lastPeerStatus.get(dbPeer.publicKey) === true;
          
          if (wasOnline) {
            // Notifica la disconnessione
            this.notifyPeerDisconnection(dbPeer.name || dbPeer.allowedIps, dbPeer.allowedIps);
            
            // Aggiorna il tempo dell'ultima connessione
            if (dbPeer.lastHandshake) {
              const lastConnTime = new Date(dbPeer.lastHandshake).getTime();
              const duration = Math.floor((Date.now() - lastConnTime) / 1000);
              
              await storage.updateWireguardPeer(dbPeer.id, {
                isOnline: false,
                lastConnectionDuration: duration
              });
            } else {
              await storage.updateWireguardPeer(dbPeer.id, { isOnline: false });
            }
          }
          
          // Aggiorna la mappa di stato
          this.lastPeerStatus.set(dbPeer.publicKey, false);
        }
      }
    } catch (error) {
      console.error('Errore durante il controllo dei peer WireGuard:', error);
    }
  }
  
  /**
   * Invia una notifica di connessione peer
   */
  private notifyPeerConnection(peerName: string, peerIp: string) {
    if (!this.client || !this.alertChannelId) return;
    
    try {
      const channel = this.client.channels.cache.get(this.alertChannelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;
      
      const embed = new EmbedBuilder()
        .setTitle('🔵 Dispositivo connesso')
        .setDescription(`Un dispositivo si è connesso alla rete WireGuard`)
        .addFields(
          { name: 'Nome', value: peerName, inline: true },
          { name: 'IP', value: peerIp.split('/')[0], inline: true },
          { name: 'Orario', value: new Date().toLocaleTimeString('it-IT'), inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Errore nell\'invio della notifica di connessione WireGuard:', error);
    }
  }
  
  /**
   * Invia una notifica di disconnessione peer
   */
  private notifyPeerDisconnection(peerName: string, peerIp: string) {
    if (!this.client || !this.alertChannelId) return;
    
    try {
      const channel = this.client.channels.cache.get(this.alertChannelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;
      
      const embed = new EmbedBuilder()
        .setTitle('⚪ Dispositivo disconnesso')
        .setDescription(`Un dispositivo si è disconnesso dalla rete WireGuard`)
        .addFields(
          { name: 'Nome', value: peerName, inline: true },
          { name: 'IP', value: peerIp.split('/')[0], inline: true },
          { name: 'Orario', value: new Date().toLocaleTimeString('it-IT'), inline: true }
        )
        .setColor(0x95a5a6)
        .setTimestamp();
      
      channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Errore nell\'invio della notifica di disconnessione WireGuard:', error);
    }
  }
  
  /**
   * Arresta il monitoraggio
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.initialized = false;
    log('Monitoraggio WireGuard arrestato', 'express');
  }
}

export const wireguardMonitor = new WireGuardMonitor();