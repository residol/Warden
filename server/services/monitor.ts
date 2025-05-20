import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { storage } from '../storage';
import { pterodactyl } from './pterodactyl';
import { log } from '../vite';

interface ResourceThreshold {
  warning: number;  // Percentuale per avviso
  critical: number; // Percentuale per allarme critico
}

interface ServerMonitorConfig {
  enabled: boolean;
  checkInterval: number; // Intervallo in minuti
  resources: {
    memory: ResourceThreshold;
    cpu: ResourceThreshold;
    disk: ResourceThreshold;
  };
  alertChannelId: string | null;
  cooldown: number; // Tempo minimo tra avvisi consecutivi per lo stesso server (in minuti)
}

// Mappa per tenere traccia degli ultimi avvisi per server (ID server -> timestamp)
const lastAlerts = new Map<string, {
  memory?: number;
  cpu?: number;
  disk?: number;
}>();

// Configurazione predefinita
let monitorConfig: ServerMonitorConfig = {
  enabled: true,
  checkInterval: 5, // Controlla ogni 5 minuti
  resources: {
    memory: {
      warning: 80,   // 80% utilizzo memoria
      critical: 95   // 95% utilizzo memoria
    },
    cpu: {
      warning: 70,   // 70% utilizzo CPU
      critical: 90   // 90% utilizzo CPU
    },
    disk: {
      warning: 85,   // 85% utilizzo disco
      critical: 95   // 95% utilizzo disco
    }
  },
  alertChannelId: null, // Verrà impostato durante l'inizializzazione
  cooldown: 30 // 30 minuti di cooldown tra avvisi dello stesso tipo per lo stesso server
};

let monitorInterval: NodeJS.Timeout | null = null;
let discordClient: Client | null = null;

/**
 * Inizializza il sistema di monitoraggio
 */
export function initMonitoring(client: Client, channelId?: string) {
  if (monitorInterval) {
    // Reset monitoring if already running
    clearInterval(monitorInterval);
    monitorInterval = null;
  }

  discordClient = client;
  
  if (channelId) {
    monitorConfig.alertChannelId = channelId;
  }
  
  if (!monitorConfig.enabled) {
    log('Monitoraggio risorse disabilitato nella configurazione', 'express');
    return;
  }

  log(`Avvio monitoraggio risorse con intervallo di ${monitorConfig.checkInterval} minuti`, 'express');
  
  // Start monitoring
  startMonitoring();
}

/**
 * Avvia il ciclo di monitoraggio
 */
function startMonitoring() {
  // Esegui un primo controllo immediato
  checkResourceUsage();
  
  // Imposta il ciclo di controllo periodico
  monitorInterval = setInterval(
    checkResourceUsage,
    monitorConfig.checkInterval * 60 * 1000
  );
}

/**
 * Controlla l'utilizzo delle risorse per tutti i server Pterodactyl
 */
async function checkResourceUsage() {
  try {
    if (!pterodactyl.isReady()) {
      log('API Pterodactyl non configurata, impossibile monitorare risorse', 'express');
      return;
    }
    
    // Ottieni statistiche di tutti i server
    const stats = await pterodactyl.getAllServersStats();
    
    if (stats.length === 0) {
      return;
    }
    
    log(`Monitoraggio di ${stats.length} server Pterodactyl`, 'express');
    
    // Controlla ogni server per utilizzo elevato delle risorse
    for (const server of stats) {
      if (server.status !== 'running') continue;
      
      let alerts: Array<{
        resource: 'memory' | 'cpu' | 'disk';
        value: number;
        limit: number;
        percent: number;
        level: 'warning' | 'critical';
      }> = [];
      
      // Controlla memoria
      if (server.memory.percent >= monitorConfig.resources.memory.critical) {
        alerts.push({
          resource: 'memory',
          value: server.memory.current,
          limit: server.memory.limit,
          percent: server.memory.percent,
          level: 'critical'
        });
      } else if (server.memory.percent >= monitorConfig.resources.memory.warning) {
        alerts.push({
          resource: 'memory',
          value: server.memory.current,
          limit: server.memory.limit,
          percent: server.memory.percent,
          level: 'warning'
        });
      }
      
      // Controlla CPU
      if (server.cpu.current >= monitorConfig.resources.cpu.critical) {
        alerts.push({
          resource: 'cpu',
          value: server.cpu.current,
          limit: server.cpu.limit,
          percent: (server.cpu.current / server.cpu.limit) * 100,
          level: 'critical'
        });
      } else if (server.cpu.current >= monitorConfig.resources.cpu.warning) {
        alerts.push({
          resource: 'cpu',
          value: server.cpu.current,
          limit: server.cpu.limit,
          percent: (server.cpu.current / server.cpu.limit) * 100,
          level: 'warning'
        });
      }
      
      // Controlla disco
      if (server.disk.percent >= monitorConfig.resources.disk.critical) {
        alerts.push({
          resource: 'disk',
          value: server.disk.current,
          limit: server.disk.limit,
          percent: server.disk.percent,
          level: 'critical'
        });
      } else if (server.disk.percent >= monitorConfig.resources.disk.warning) {
        alerts.push({
          resource: 'disk',
          value: server.disk.current,
          limit: server.disk.limit,
          percent: server.disk.percent,
          level: 'warning'
        });
      }
      
      // Se ci sono avvisi, invia le notifiche (rispettando il cooldown)
      if (alerts.length > 0) {
        const now = Date.now();
        const lastAlert = lastAlerts.get(server.id) || {};
        
        const filteredAlerts = alerts.filter(alert => {
          const lastAlertTime = lastAlert[alert.resource];
          const cooldownMs = monitorConfig.cooldown * 60 * 1000;
          
          // Se non c'è un avviso precedente o è passato abbastanza tempo
          return !lastAlertTime || (now - lastAlertTime) >= cooldownMs;
        });
        
        if (filteredAlerts.length > 0) {
          // Aggiorna i timestamp per gli avvisi che stiamo inviando
          const updatedLastAlert = { ...lastAlert };
          filteredAlerts.forEach(alert => {
            updatedLastAlert[alert.resource] = now;
          });
          lastAlerts.set(server.id, updatedLastAlert);
          
          // Invia gli avvisi
          sendResourceAlerts(server, filteredAlerts);
          
          // Crea un sistema di alert nel database
          for (const alert of filteredAlerts) {
            const severity = alert.level === 'critical' ? 'critical' : 'warning';
            const resourceName = resourceDisplayName(alert.resource);
            
            // Cerca il server nel database interno
            const dbServer = await storage.getServerByName(server.name);
            
            if (dbServer) {
              await storage.createSystemAlert({
                type: severity,
                message: `Utilizzo ${resourceName} elevato: ${alert.percent.toFixed(1)}%`,
                serverId: dbServer.id
              });
            }
          }
        }
      }
    }
  } catch (error) {
    log(`Errore durante il monitoraggio delle risorse: ${error}`, 'express');
    console.error('Errore nel monitoraggio delle risorse:', error);
  }
}

/**
 * Invia avvisi di utilizzo elevato delle risorse tramite Discord
 */
async function sendResourceAlerts(server: any, alerts: any[]) {
  if (!discordClient || !monitorConfig.alertChannelId) {
    return;
  }
  
  try {
    const channel = await discordClient.channels.fetch(monitorConfig.alertChannelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }
    
    const textChannel = channel as TextChannel;
    
    // Raggruppa gli avvisi per livello di criticità
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    
    // Determina il colore in base alla presenza di avvisi critici
    const color = criticalAlerts.length > 0 ? 0xE74C3C : 0xF39C12;
    
    // Funzioni di formatttazione
    const formatBytes = (mb: number) => {
      if (mb < 1024) return `${mb.toFixed(0)} MB`;
      return `${(mb / 1024).toFixed(2)} GB`;
    };
    
    const createProgressBar = (percent: number, length = 10) => {
      const filled = Math.round((percent / 100) * length);
      const empty = length - filled;
      return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent.toFixed(1)}%`;
    };
    
    // Crea l'embed con il riepilogo degli avvisi
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Avviso risorse: ${server.name}`)
      .setDescription(`Rilevato utilizzo elevato delle risorse per il server **${server.name}** su Pterodactyl.`)
      .setColor(color)
      .setTimestamp();
    
    // Aggiungi i dettagli per ogni tipo di risorsa
    alerts.forEach(alert => {
      const emoji = alert.level === 'critical' ? '🔴' : '⚠️';
      const resourceName = resourceDisplayName(alert.resource);
      
      embed.addFields({
        name: `${emoji} ${resourceName}`,
        value: alert.resource === 'cpu' 
          ? `${createProgressBar(alert.percent)}\n${alert.value.toFixed(1)}% / ${alert.limit}%`
          : `${createProgressBar(alert.percent)}\n${formatBytes(alert.value)} / ${formatBytes(alert.limit)}`,
        inline: false
      });
    });
    
    // Suggerimenti per la risoluzione
    let suggestions = '';
    
    if (alerts.some(a => a.resource === 'memory')) {
      suggestions += '• Verifica processi con utilizzo di memoria anomalo\n';
      suggestions += '• Valuta di aumentare il limite RAM per il server\n';
    }
    
    if (alerts.some(a => a.resource === 'cpu')) {
      suggestions += '• Controlla eventuali plugin o mod che causano lag\n';
      suggestions += '• Considera di ridurre la distanza di rendering o il numero di entità\n';
    }
    
    if (alerts.some(a => a.resource === 'disk')) {
      suggestions += '• Elimina log non necessari e file temporanei\n';
      suggestions += '• Valuta di aumentare lo spazio disco allocato\n';
    }
    
    if (suggestions) {
      embed.addFields({
        name: '💡 Suggerimenti',
        value: suggestions
      });
    }
    
    // Link alle azioni
    embed.addFields({
      name: '🔧 Azioni',
      value: 'Usa il comando `/pterodactyl stats` per dettagli completi'
    });
    
    await textChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('Errore nell\'invio degli avvisi su Discord:', error);
  }
}

/**
 * Restituisce il nome leggibile di una risorsa
 */
function resourceDisplayName(resource: string): string {
  switch (resource) {
    case 'memory': return 'Memoria';
    case 'cpu': return 'CPU';
    case 'disk': return 'Disco';
    default: return resource;
  }
}

/**
 * Aggiorna la configurazione del monitoraggio
 */
export function updateMonitorConfig(newConfig: Partial<ServerMonitorConfig>) {
  monitorConfig = { ...monitorConfig, ...newConfig };
  
  // Riavvia il monitoraggio con la nuova configurazione
  if (discordClient) {
    log('Aggiornata configurazione monitoraggio risorse', 'express');
    initMonitoring(discordClient, monitorConfig.alertChannelId || undefined);
  }
}

/**
 * Disabilita temporaneamente il monitoraggio
 */
export function pauseMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log('Monitoraggio risorse in pausa', 'express');
  }
}

/**
 * Riprende il monitoraggio se è in pausa
 */
export function resumeMonitoring() {
  if (!monitorInterval && monitorConfig.enabled && discordClient) {
    startMonitoring();
    log('Monitoraggio risorse ripreso', 'express');
  }
}

/**
 * Controlla manualmente l'utilizzo delle risorse di un server specifico
 */
export async function checkServerResources(serverId: string) {
  try {
    const stats = await pterodactyl.getAllServersStats();
    const server = stats.find(s => s.id === serverId);
    
    if (!server) {
      return null;
    }
    
    return {
      memory: {
        current: server.memory.current,
        limit: server.memory.limit,
        percent: server.memory.percent
      },
      cpu: {
        current: server.cpu.current,
        limit: server.cpu.limit,
        percent: (server.cpu.current / server.cpu.limit) * 100
      },
      disk: {
        current: server.disk.current,
        limit: server.disk.limit,
        percent: server.disk.percent
      },
      status: server.status
    };
  } catch (error) {
    console.error('Errore durante il controllo delle risorse del server:', error);
    return null;
  }
}

/**
 * Ottiene lo stato attuale del monitoraggio
 */
export function getMonitoringStatus() {
  return {
    enabled: monitorConfig.enabled,
    running: !!monitorInterval,
    checkInterval: monitorConfig.checkInterval,
    thresholds: monitorConfig.resources,
    cooldown: monitorConfig.cooldown
  };
}