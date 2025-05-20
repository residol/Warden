import { log } from '../vite';
import { storage } from '../storage';
import { FirewallRule } from '@/lib/types';

/**
 * Servizio per gestire le regole firewall per WireGuard
 */
class WireGuardFirewallService {
  private rules: Map<number, FirewallRule[]> = new Map(); // <peerId, Rule[]>
  private ruleIdCounter: number = 1;
  
  constructor() {
    log('Servizio firewall WireGuard inizializzato', 'express');
    // Carica le regole iniziali
    this.loadInitialRules();
  }
  
  /**
   * Carica alcune regole iniziali di esempio
   */
  private loadInitialRules() {
    // Crea una regola di esempio per ogni peer
    (async () => {
      try {
        const peers = await storage.getAllWireguardPeers();
        
        // Per ogni peer, crea una regola di limite di banda di base
        for (const peer of peers) {
          // Verifica se abbiamo già regole per questo peer
          if (!this.getRulesForPeer(peer.id).length) {
            // Aggiungi una regola di limitazione di base
            this.addRule({
              peerId: peer.id,
              type: 'limit',
              direction: 'both',
              protocol: 'all',
              rateLimit: 5000, // 5 Mbps
              description: 'Limitazione di banda predefinita',
              enabled: true
            });
            
            // Aggiungi una regola per consentire SSH
            this.addRule({
              peerId: peer.id,
              type: 'allow',
              direction: 'both',
              protocol: 'tcp',
              port: 22,
              description: 'Accesso SSH',
              enabled: true
            });
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento delle regole firewall iniziali:', error);
      }
    })();
  }
  
  /**
   * Ottiene tutte le regole per un peer specifico
   */
  getRulesForPeer(peerId: number): FirewallRule[] {
    return this.rules.get(peerId) || [];
  }
  
  /**
   * Ottiene tutte le regole presenti nel sistema
   */
  getAllRules(): FirewallRule[] {
    const allRules: FirewallRule[] = [];
    for (const [_, peerRules] of this.rules) {
      allRules.push(...peerRules);
    }
    return allRules;
  }
  
  /**
   * Aggiunge una nuova regola firewall
   */
  addRule(rule: Omit<FirewallRule, 'id' | 'createdAt'>): FirewallRule {
    const id = this.ruleIdCounter++;
    const createdAt = new Date().toISOString();
    
    const newRule: FirewallRule = {
      id,
      createdAt,
      ...rule
    };
    
    // Aggiungi la regola alla mappa
    const peerRules = this.rules.get(rule.peerId) || [];
    peerRules.push(newRule);
    this.rules.set(rule.peerId, peerRules);
    
    // In un'implementazione reale, qui applicheremmo la regola
    this.applyRule(newRule);
    
    return newRule;
  }
  
  /**
   * Aggiorna una regola esistente
   */
  updateRule(ruleId: number, updates: Partial<Omit<FirewallRule, 'id' | 'createdAt'>>): FirewallRule | null {
    // Cerca la regola
    for (const [peerId, peerRules] of this.rules) {
      const ruleIndex = peerRules.findIndex(r => r.id === ruleId);
      
      if (ruleIndex !== -1) {
        // Se troviamo la regola, aggiornala
        const oldRule = peerRules[ruleIndex];
        
        // Rimuovi la vecchia regola se era attiva
        if (oldRule.enabled) {
          this.removeRule(oldRule);
        }
        
        // Crea la nuova regola con gli aggiornamenti
        const updatedRule: FirewallRule = {
          ...oldRule,
          ...updates
        };
        
        // Aggiorna la regola nell'array
        peerRules[ruleIndex] = updatedRule;
        this.rules.set(peerId, peerRules);
        
        // Applica la nuova regola se è abilitata
        if (updatedRule.enabled) {
          this.applyRule(updatedRule);
        }
        
        return updatedRule;
      }
    }
    
    return null;
  }
  
  /**
   * Elimina una regola
   */
  deleteRule(ruleId: number): boolean {
    // Cerca la regola
    for (const [peerId, peerRules] of this.rules) {
      const ruleIndex = peerRules.findIndex(r => r.id === ruleId);
      
      if (ruleIndex !== -1) {
        // Se troviamo la regola, rimuovila
        const rule = peerRules[ruleIndex];
        
        // Rimuovi la regola dal sistema
        if (rule.enabled) {
          this.removeRule(rule);
        }
        
        // Rimuovi la regola dall'array
        peerRules.splice(ruleIndex, 1);
        this.rules.set(peerId, peerRules);
        
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Ottiene una regola specifica per ID
   */
  getRule(ruleId: number): FirewallRule | null {
    // Cerca la regola
    for (const [_, peerRules] of this.rules) {
      const rule = peerRules.find(r => r.id === ruleId);
      if (rule) {
        return rule;
      }
    }
    
    return null;
  }
  
  /**
   * Applica una regola firewall (simulata)
   * In un'implementazione reale, questa funzione utilizzerebbe 
   * iptables/nftables per applicare la regola
   */
  private applyRule(rule: FirewallRule): void {
    // Questo è un segnaposto per la vera implementazione
    // che utilizzerebbe chiamate di sistema per configurare il firewall
    
    log(`Applicazione regola firewall: ${rule.type} per peer ${rule.peerId}`, 'express');
    
    // Qui, in un sistema reale, eseguiremmo comandi come:
    // Per rate limit:
    // iptables -A FORWARD -s <peerIP> -m limit --limit <rateLimit>kb/s -j ACCEPT
    
    // Per allow:
    // iptables -A FORWARD -s <peerIP> -p <protocol> --dport <port> -j ACCEPT
    
    // Per block:
    // iptables -A FORWARD -s <peerIP> -p <protocol> --dport <port> -j DROP
  }
  
  /**
   * Rimuove una regola firewall (simulata)
   */
  private removeRule(rule: FirewallRule): void {
    // Questo è un segnaposto per la vera implementazione
    log(`Rimozione regola firewall: ${rule.type} per peer ${rule.peerId}`, 'express');
    
    // Qui, in un sistema reale, eseguiremmo comandi come:
    // iptables -D FORWARD -s <peerIP> ... (stessi parametri usati per l'aggiunta)
  }
}

export const wireguardFirewall = new WireGuardFirewallService();