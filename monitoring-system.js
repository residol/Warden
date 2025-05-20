// Sistema di monitoraggio avanzato per risorse di sistema e server
// Questo modulo fornisce funzionalità per monitorare l'utilizzo delle risorse e configurare avvisi

import os from 'os';
import fs from 'fs';
import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

// Soglie di avviso predefinite
const DEFAULT_THRESHOLDS = {
  cpu: 80, // Percentuale
  memory: 85, // Percentuale
  disk: 90, // Percentuale
  network: 90, // Percentuale della capacità di rete
  serverOffline: true, // Avvisa se un server va offline
  serverHighCpu: 90, // Percentuale CPU per un server
  serverHighMemory: 90 // Percentuale memoria per un server
};

// Configurazione per lo storage delle metriche
let metricsHistory = {
  system: {
    cpu: [],
    memory: [],
    disk: [],
    network: [],
    timestamp: []
  },
  servers: {}
};

// Configurazione per gli avvisi
let alertsConfig = {
  enabled: true,
  discordChannel: null, // ID canale Discord per gli avvisi
  thresholds: { ...DEFAULT_THRESHOLDS },
  cooldown: 15 * 60 * 1000, // 15 minuti di cooldown tra avvisi simili
  lastAlerts: {} // Timestamp degli ultimi avvisi inviati
};

// Intervallo di monitoraggio in ms (default: 5 minuti)
let monitoringInterval = 5 * 60 * 1000;
let monitoringActive = false;
let intervalId = null;

// Riferimenti esterni
let discordClient = null;
let pterodactylService = null;

// ==========================================
// FUNZIONI DI MONITORAGGIO
// ==========================================

// Raccoglie le metriche di sistema
async function collectSystemMetrics() {
  try {
    // CPU
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    
    // Memoria
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Disco
    let diskUsage = 0;
    try {
      // Questo è un esempio semplificato, in un ambiente reale dovresti usare
      // comandi di sistema o librerie specifiche per ottenere l'utilizzo disco
      const df = fs.readFileSync('/proc/mounts', 'utf8');
      // Implementazione semplificata, nella realtà dovresti analizzare il df output
      diskUsage = 70; // Esempio: 70%
    } catch (error) {
      console.warn('Impossibile leggere le informazioni del disco:', error.message);
      diskUsage = 0;
    }
    
    // Rete (esempio semplificato)
    let networkUsage = 0;
    try {
      // In un ambiente reale dovresti monitorare il traffico di rete
      // Questo è solo un esempio
      networkUsage = Math.random() * 40 + 30; // 30-70% di utilizzo simulato
    } catch (error) {
      console.warn('Impossibile leggere le informazioni di rete:', error.message);
    }
    
    // Aggiorna la cronologia delle metriche
    const timestamp = Date.now();
    metricsHistory.system.cpu.push(cpuUsage);
    metricsHistory.system.memory.push(memoryUsage);
    metricsHistory.system.disk.push(diskUsage);
    metricsHistory.system.network.push(networkUsage);
    metricsHistory.system.timestamp.push(timestamp);
    
    // Mantieni solo le ultime 288 letture (24 ore con intervallo di 5 minuti)
    const maxHistoryEntries = 288;
    if (metricsHistory.system.cpu.length > maxHistoryEntries) {
      metricsHistory.system.cpu.shift();
      metricsHistory.system.memory.shift();
      metricsHistory.system.disk.shift();
      metricsHistory.system.network.shift();
      metricsHistory.system.timestamp.shift();
    }
    
    // Controlla le soglie e invia avvisi se necessario
    await checkSystemThresholds({
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage
    });
    
    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage,
      timestamp
    };
  } catch (error) {
    console.error('Errore durante la raccolta delle metriche di sistema:', error);
    throw error;
  }
}

// Raccoglie metriche dei server Pterodactyl
async function collectServerMetrics() {
  if (!pterodactylService) {
    console.warn('Servizio Pterodactyl non configurato');
    return {};
  }
  
  try {
    // Ottieni la lista dei server da Pterodactyl
    const servers = await pterodactylService.getServers();
    const serverMetrics = {};
    
    // Per ogni server, ottieni le metriche
    for (const server of servers) {
      const serverId = server.attributes.identifier;
      const serverName = server.attributes.name;
      
      try {
        // Ottieni le risorse utilizzate dal server
        const resources = await pterodactylService.getServerResources(serverId);
        
        if (resources) {
          // Calcola l'utilizzo percentuale
          const cpuUsage = resources.cpu ? resources.cpu.current : 0;
          const memoryTotal = resources.memory ? resources.memory.limit : 0;
          const memoryUsed = resources.memory ? resources.memory.current : 0;
          const memoryUsage = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;
          const diskTotal = resources.disk ? resources.disk.limit : 0;
          const diskUsed = resources.disk ? resources.disk.current : 0;
          const diskUsage = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;
          const status = server.attributes.status || 'unknown';
          
          // Crea o aggiorna la cronologia delle metriche per questo server
          if (!metricsHistory.servers[serverId]) {
            metricsHistory.servers[serverId] = {
              name: serverName,
              cpu: [],
              memory: [],
              disk: [],
              status: [],
              timestamp: []
            };
          }
          
          // Aggiungi le metriche attuali alla cronologia
          const timestamp = Date.now();
          metricsHistory.servers[serverId].cpu.push(cpuUsage);
          metricsHistory.servers[serverId].memory.push(memoryUsage);
          metricsHistory.servers[serverId].disk.push(diskUsage);
          metricsHistory.servers[serverId].status.push(status);
          metricsHistory.servers[serverId].timestamp.push(timestamp);
          
          // Mantieni solo le ultime 288 letture (24 ore con intervallo di 5 minuti)
          const maxHistoryEntries = 288;
          if (metricsHistory.servers[serverId].cpu.length > maxHistoryEntries) {
            metricsHistory.servers[serverId].cpu.shift();
            metricsHistory.servers[serverId].memory.shift();
            metricsHistory.servers[serverId].disk.shift();
            metricsHistory.servers[serverId].status.shift();
            metricsHistory.servers[serverId].timestamp.shift();
          }
          
          // Salva le metriche attuali per la restituzione
          serverMetrics[serverId] = {
            name: serverName,
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage,
            status,
            timestamp
          };
          
          // Controlla le soglie e invia avvisi se necessario
          await checkServerThresholds(serverId, serverName, {
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage,
            status
          });
        }
      } catch (error) {
        console.error(`Errore durante la raccolta delle metriche per il server ${serverName}:`, error);
        
        // Aggiungi uno stato di errore alla cronologia
        if (metricsHistory.servers[serverId]) {
          const timestamp = Date.now();
          metricsHistory.servers[serverId].status.push('error');
          metricsHistory.servers[serverId].timestamp.push(timestamp);
          
          // Mantieni solo le ultime 288 letture
          const maxHistoryEntries = 288;
          if (metricsHistory.servers[serverId].status.length > maxHistoryEntries) {
            metricsHistory.servers[serverId].status.shift();
            metricsHistory.servers[serverId].timestamp.shift();
          }
        }
      }
    }
    
    return serverMetrics;
  } catch (error) {
    console.error('Errore durante la raccolta delle metriche dei server:', error);
    throw error;
  }
}

// ==========================================
// GESTIONE AVVISI
// ==========================================

// Controlla le soglie di sistema e invia avvisi se necessario
async function checkSystemThresholds(metrics) {
  if (!alertsConfig.enabled) return;
  
  const now = Date.now();
  const { thresholds, cooldown, lastAlerts } = alertsConfig;
  
  // Controllo CPU
  if (metrics.cpu > thresholds.cpu) {
    // Verifica il cooldown
    if (!lastAlerts.cpu || (now - lastAlerts.cpu) > cooldown) {
      await sendAlert({
        type: 'system',
        level: metrics.cpu > thresholds.cpu + 10 ? 'critical' : 'warning',
        message: `Utilizzo CPU alto: ${metrics.cpu.toFixed(1)}% (soglia: ${thresholds.cpu}%)`,
        details: {
          cpu: metrics.cpu,
          threshold: thresholds.cpu
        }
      });
      
      lastAlerts.cpu = now;
    }
  }
  
  // Controllo memoria
  if (metrics.memory > thresholds.memory) {
    if (!lastAlerts.memory || (now - lastAlerts.memory) > cooldown) {
      await sendAlert({
        type: 'system',
        level: metrics.memory > thresholds.memory + 10 ? 'critical' : 'warning',
        message: `Utilizzo memoria alto: ${metrics.memory.toFixed(1)}% (soglia: ${thresholds.memory}%)`,
        details: {
          memory: metrics.memory,
          threshold: thresholds.memory
        }
      });
      
      lastAlerts.memory = now;
    }
  }
  
  // Controllo disco
  if (metrics.disk > thresholds.disk) {
    if (!lastAlerts.disk || (now - lastAlerts.disk) > cooldown) {
      await sendAlert({
        type: 'system',
        level: metrics.disk > thresholds.disk + 5 ? 'critical' : 'warning',
        message: `Spazio su disco basso: ${metrics.disk.toFixed(1)}% utilizzato (soglia: ${thresholds.disk}%)`,
        details: {
          disk: metrics.disk,
          threshold: thresholds.disk
        }
      });
      
      lastAlerts.disk = now;
    }
  }
  
  // Controllo rete
  if (metrics.network > thresholds.network) {
    if (!lastAlerts.network || (now - lastAlerts.network) > cooldown) {
      await sendAlert({
        type: 'system',
        level: 'warning',
        message: `Utilizzo rete alto: ${metrics.network.toFixed(1)}% (soglia: ${thresholds.network}%)`,
        details: {
          network: metrics.network,
          threshold: thresholds.network
        }
      });
      
      lastAlerts.network = now;
    }
  }
}

// Controlla le soglie dei server e invia avvisi se necessario
async function checkServerThresholds(serverId, serverName, metrics) {
  if (!alertsConfig.enabled) return;
  
  const now = Date.now();
  const { thresholds, cooldown, lastAlerts } = alertsConfig;
  
  // Inizializza l'oggetto per questo server se non esiste
  if (!lastAlerts[serverId]) {
    lastAlerts[serverId] = {};
  }
  
  // Controllo stato server
  if (thresholds.serverOffline && metrics.status !== 'running') {
    const alertKey = `${serverId}_status`;
    
    if (!lastAlerts[alertKey] || (now - lastAlerts[alertKey]) > cooldown) {
      await sendAlert({
        type: 'server',
        level: 'critical',
        message: `Server ${serverName} non è in esecuzione (stato: ${metrics.status})`,
        details: {
          serverId,
          serverName,
          status: metrics.status
        }
      });
      
      lastAlerts[alertKey] = now;
    }
  }
  
  // Controllo CPU server
  if (metrics.cpu > thresholds.serverHighCpu) {
    const alertKey = `${serverId}_cpu`;
    
    if (!lastAlerts[alertKey] || (now - lastAlerts[alertKey]) > cooldown) {
      await sendAlert({
        type: 'server',
        level: metrics.cpu > thresholds.serverHighCpu + 10 ? 'critical' : 'warning',
        message: `Server ${serverName} ha un utilizzo CPU alto: ${metrics.cpu.toFixed(1)}% (soglia: ${thresholds.serverHighCpu}%)`,
        details: {
          serverId,
          serverName,
          cpu: metrics.cpu,
          threshold: thresholds.serverHighCpu
        }
      });
      
      lastAlerts[alertKey] = now;
    }
  }
  
  // Controllo memoria server
  if (metrics.memory > thresholds.serverHighMemory) {
    const alertKey = `${serverId}_memory`;
    
    if (!lastAlerts[alertKey] || (now - lastAlerts[alertKey]) > cooldown) {
      await sendAlert({
        type: 'server',
        level: metrics.memory > thresholds.serverHighMemory + 10 ? 'critical' : 'warning',
        message: `Server ${serverName} ha un utilizzo memoria alto: ${metrics.memory.toFixed(1)}% (soglia: ${thresholds.serverHighMemory}%)`,
        details: {
          serverId,
          serverName,
          memory: metrics.memory,
          threshold: thresholds.serverHighMemory
        }
      });
      
      lastAlerts[alertKey] = now;
    }
  }
}

// Invia un avviso tramite Discord e lo salva nel database
async function sendAlert(alert) {
  try {
    // Invia l'avviso su Discord se configurato
    if (discordClient && alertsConfig.discordChannel) {
      const channel = await discordClient.channels.fetch(alertsConfig.discordChannel);
      
      if (channel) {
        // Crea un embed per l'avviso
        const embed = new EmbedBuilder()
          .setTitle(`🚨 Avviso: ${alert.type === 'system' ? 'Sistema' : 'Server'}`)
          .setDescription(alert.message)
          .setColor(alert.level === 'critical' ? 0xFF0000 : 0xFFAA00)
          .setTimestamp();
        
        // Aggiungi dettagli specifici in base al tipo di avviso
        if (alert.type === 'system') {
          embed.addFields(
            { name: 'Tipo', value: 'Sistema', inline: true },
            { name: 'Livello', value: alert.level === 'critical' ? 'Critico' : 'Avviso', inline: true },
            { name: 'Timestamp', value: new Date().toISOString(), inline: true }
          );
          
          if (alert.details.cpu) {
            embed.addFields({ name: 'CPU', value: `${alert.details.cpu.toFixed(1)}%`, inline: true });
          }
          if (alert.details.memory) {
            embed.addFields({ name: 'Memoria', value: `${alert.details.memory.toFixed(1)}%`, inline: true });
          }
          if (alert.details.disk) {
            embed.addFields({ name: 'Disco', value: `${alert.details.disk.toFixed(1)}%`, inline: true });
          }
          if (alert.details.network) {
            embed.addFields({ name: 'Rete', value: `${alert.details.network.toFixed(1)}%`, inline: true });
          }
        } else if (alert.type === 'server') {
          embed.addFields(
            { name: 'Server', value: alert.details.serverName, inline: true },
            { name: 'ID', value: alert.details.serverId, inline: true },
            { name: 'Livello', value: alert.level === 'critical' ? 'Critico' : 'Avviso', inline: true }
          );
          
          if (alert.details.status) {
            embed.addFields({ name: 'Stato', value: alert.details.status, inline: true });
          }
          if (alert.details.cpu) {
            embed.addFields({ name: 'CPU', value: `${alert.details.cpu.toFixed(1)}%`, inline: true });
          }
          if (alert.details.memory) {
            embed.addFields({ name: 'Memoria', value: `${alert.details.memory.toFixed(1)}%`, inline: true });
          }
        }
        
        await channel.send({ embeds: [embed] });
      }
    }
    
    // Qui puoi anche salvare l'avviso nel database se necessario
    // await database.insertAlert(alert);
    
    console.log(`Avviso inviato: ${alert.message}`);
    return true;
  } catch (error) {
    console.error('Errore durante l\'invio dell\'avviso:', error);
    return false;
  }
}

// ==========================================
// API PUBBLICHE
// ==========================================

// Funzione per inizializzare il sistema di monitoraggio
export function initMonitoring(options = {}) {
  // Configura i servizi esterni
  if (options.discordClient) {
    discordClient = options.discordClient;
  }
  
  if (options.pterodactylService) {
    pterodactylService = options.pterodactylService;
  }
  
  // Configura gli avvisi
  if (options.alertsConfig) {
    alertsConfig = {
      ...alertsConfig,
      ...options.alertsConfig
    };
  }
  
  // Imposta l'intervallo di monitoraggio
  if (options.interval) {
    monitoringInterval = options.interval;
  }
  
  console.log('Sistema di monitoraggio inizializzato con successo');
  return true;
}

// Avvia il monitoraggio periodico
export function startMonitoring() {
  if (monitoringActive) {
    console.warn('Il monitoraggio è già attivo');
    return false;
  }
  
  monitoringActive = true;
  
  // Esegui subito il primo ciclo di monitoraggio
  runMonitoringCycle();
  
  // Imposta l'intervallo per i cicli successivi
  intervalId = setInterval(runMonitoringCycle, monitoringInterval);
  
  console.log(`Monitoraggio avviato con intervallo di ${monitoringInterval / 1000} secondi`);
  return true;
}

// Ferma il monitoraggio
export function stopMonitoring() {
  if (!monitoringActive) {
    console.warn('Il monitoraggio non è attivo');
    return false;
  }
  
  monitoringActive = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  console.log('Monitoraggio fermato');
  return true;
}

// Esegue un ciclo di monitoraggio
async function runMonitoringCycle() {
  try {
    // Raccoglie le metriche di sistema
    const systemMetrics = await collectSystemMetrics();
    
    // Raccoglie le metriche dei server
    const serverMetrics = await collectServerMetrics();
    
    // Qui puoi anche aggiungere azioni aggiuntive come l'invio delle metriche
    // a un sistema di monitoraggio esterno, database, ecc.
    
    return {
      system: systemMetrics,
      servers: serverMetrics,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Errore durante il ciclo di monitoraggio:', error);
  }
}

// Ottieni le metriche attuali (esegue una raccolta immediata)
export async function getCurrentMetrics() {
  try {
    return await runMonitoringCycle();
  } catch (error) {
    console.error('Errore durante il recupero delle metriche attuali:', error);
    throw error;
  }
}

// Ottieni la cronologia delle metriche
export function getMetricsHistory(options = {}) {
  const { period, serverId } = options;
  
  // Filtra in base al periodo specificato (es. ultime 24 ore)
  let filteredHistory = { ...metricsHistory };
  
  if (period) {
    const cutoffTime = Date.now() - period;
    
    // Filtra le metriche di sistema
    const systemIndices = metricsHistory.system.timestamp.reduce((indices, timestamp, index) => {
      if (timestamp >= cutoffTime) {
        indices.push(index);
      }
      return indices;
    }, []);
    
    filteredHistory.system = {
      cpu: systemIndices.map(i => metricsHistory.system.cpu[i]),
      memory: systemIndices.map(i => metricsHistory.system.memory[i]),
      disk: systemIndices.map(i => metricsHistory.system.disk[i]),
      network: systemIndices.map(i => metricsHistory.system.network[i]),
      timestamp: systemIndices.map(i => metricsHistory.system.timestamp[i])
    };
    
    // Filtra le metriche dei server
    filteredHistory.servers = {};
    
    Object.keys(metricsHistory.servers).forEach(sid => {
      if (!serverId || sid === serverId) {
        const serverIndices = metricsHistory.servers[sid].timestamp.reduce((indices, timestamp, index) => {
          if (timestamp >= cutoffTime) {
            indices.push(index);
          }
          return indices;
        }, []);
        
        filteredHistory.servers[sid] = {
          name: metricsHistory.servers[sid].name,
          cpu: serverIndices.map(i => metricsHistory.servers[sid].cpu[i]),
          memory: serverIndices.map(i => metricsHistory.servers[sid].memory[i]),
          disk: serverIndices.map(i => metricsHistory.servers[sid].disk[i]),
          status: serverIndices.map(i => metricsHistory.servers[sid].status[i]),
          timestamp: serverIndices.map(i => metricsHistory.servers[sid].timestamp[i])
        };
      }
    });
  } else if (serverId) {
    // Se è specificato solo il serverId, filtra solo per quello
    filteredHistory.servers = {};
    
    if (metricsHistory.servers[serverId]) {
      filteredHistory.servers[serverId] = metricsHistory.servers[serverId];
    }
  }
  
  return filteredHistory;
}

// Configura le soglie di avviso
export function setAlertThresholds(newThresholds) {
  if (!newThresholds) return false;
  
  alertsConfig.thresholds = {
    ...alertsConfig.thresholds,
    ...newThresholds
  };
  
  console.log('Soglie di avviso aggiornate:', alertsConfig.thresholds);
  return true;
}

// Imposta il canale Discord per gli avvisi
export function setAlertChannel(channelId) {
  alertsConfig.discordChannel = channelId;
  console.log(`Canale Discord per gli avvisi impostato su: ${channelId}`);
  return true;
}

// Abilita/disabilita gli avvisi
export function setAlertsEnabled(enabled) {
  alertsConfig.enabled = !!enabled;
  console.log(`Avvisi ${alertsConfig.enabled ? 'abilitati' : 'disabilitati'}`);
  return true;
}

// Ottieni la configurazione attuale degli avvisi
export function getAlertsConfig() {
  return {
    ...alertsConfig,
    lastAlerts: Object.keys(alertsConfig.lastAlerts).reduce((acc, key) => {
      acc[key] = new Date(alertsConfig.lastAlerts[key]).toISOString();
      return acc;
    }, {})
  };
}

// Esporta tutte le funzioni pubbliche
export default {
  initMonitoring,
  startMonitoring,
  stopMonitoring,
  getCurrentMetrics,
  getMetricsHistory,
  setAlertThresholds,
  setAlertChannel,
  setAlertsEnabled,
  getAlertsConfig
};