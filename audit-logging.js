// Sistema di Audit Logging per il monitoraggio delle attività
// Registra e traccia tutte le azioni degli utenti nel sistema

import { EmbedBuilder } from 'discord.js';

// Tipi di azioni per l'audit log
export const AUDIT_ACTIONS = {
  // Azioni di sistema
  SYSTEM_START: 'system_start',
  SYSTEM_STOP: 'system_stop',
  SYSTEM_CONFIG_CHANGE: 'system_config_change',
  
  // Azioni utente
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_MODIFY: 'user_modify',
  USER_DELETE: 'user_delete',
  USER_ROLE_CHANGE: 'user_role_change',
  USER_INVITE: 'user_invite',
  
  // Azioni server
  SERVER_CREATE: 'server_create',
  SERVER_DELETE: 'server_delete',
  SERVER_MODIFY: 'server_modify',
  SERVER_START: 'server_start',
  SERVER_STOP: 'server_stop',
  SERVER_RESTART: 'server_restart',
  SERVER_BACKUP: 'server_backup',
  SERVER_RESTORE: 'server_restore',
  
  // Azioni di rete
  WIREGUARD_PEER_ADD: 'wireguard_peer_add',
  WIREGUARD_PEER_REMOVE: 'wireguard_peer_remove',
  WIREGUARD_PEER_MODIFY: 'wireguard_peer_modify',
  WIREGUARD_CONFIG_CHANGE: 'wireguard_config_change',
  
  // Azioni discord
  DISCORD_COMMAND: 'discord_command',
  DISCORD_CONFIG_CHANGE: 'discord_config_change',
  
  // Azioni API
  API_REQUEST: 'api_request',
  API_ERROR: 'api_error'
};

// Livelli di severità per l'audit log
export const AUDIT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Impostazioni per l'audit log
let auditConfig = {
  enabled: true,
  logToConsole: true,
  logToDatabase: true,
  logToDiscord: false,
  discordChannel: null,
  detailLevel: 'medium', // 'minimal', 'medium', 'full'
  retentionPeriod: 90 // giorni
};

// Riferimenti esterni
let discordClient = null;
let databaseConnector = null;

// Cache per gli audit log recenti
let recentLogs = [];
const MAX_CACHE_SIZE = 100;

// ==========================================
// FUNZIONI DI REGISTRAZIONE AUDIT
// ==========================================

/**
 * Registra un'azione nell'audit log
 * @param {Object} logData - Dati dell'azione da registrare
 * @param {string} logData.action - Tipo di azione (da AUDIT_ACTIONS)
 * @param {string} logData.level - Livello di severità (da AUDIT_LEVELS)
 * @param {string} logData.userId - ID dell'utente che ha eseguito l'azione
 * @param {string} logData.username - Nome dell'utente che ha eseguito l'azione
 * @param {string} logData.userRole - Ruolo dell'utente che ha eseguito l'azione
 * @param {string} logData.description - Descrizione dell'azione
 * @param {Object} logData.details - Dettagli aggiuntivi sull'azione
 * @param {string} logData.ip - Indirizzo IP da cui è stata eseguita l'azione
 * @returns {Promise<Object>} - Oggetto log creato
 */
export async function logAction(logData) {
  if (!auditConfig.enabled) return null;
  
  // Verifica che i dati minimi siano presenti
  if (!logData.action) {
    console.error('Audit log richiede un\'azione');
    return null;
  }
  
  // Imposta valori predefiniti
  const timestamp = new Date();
  const level = logData.level || AUDIT_LEVELS.INFO;
  
  // Crea l'oggetto di log completo
  const auditLog = {
    id: generateUniqueId(),
    timestamp,
    action: logData.action,
    level,
    userId: logData.userId || 'system',
    username: logData.username || 'System',
    userRole: logData.userRole || 'system',
    description: logData.description || getDefaultDescription(logData.action),
    details: processDetails(logData.details, auditConfig.detailLevel),
    ip: logData.ip || '127.0.0.1'
  };
  
  // Registra nel log della console
  if (auditConfig.logToConsole) {
    logToConsole(auditLog);
  }
  
  // Registra nel database
  if (auditConfig.logToDatabase && databaseConnector) {
    try {
      await logToDatabase(auditLog);
    } catch (error) {
      console.error('Errore durante la registrazione dell\'audit log nel database:', error);
    }
  }
  
  // Registra su Discord
  if (auditConfig.logToDiscord && discordClient && auditConfig.discordChannel) {
    try {
      await logToDiscord(auditLog);
    } catch (error) {
      console.error('Errore durante la registrazione dell\'audit log su Discord:', error);
    }
  }
  
  // Aggiungi alla cache dei log recenti
  addToRecentLogs(auditLog);
  
  return auditLog;
}

// Genera un ID univoco per il log
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Ottiene una descrizione predefinita per un'azione
function getDefaultDescription(action) {
  const descriptions = {
    [AUDIT_ACTIONS.SYSTEM_START]: 'Sistema avviato',
    [AUDIT_ACTIONS.SYSTEM_STOP]: 'Sistema arrestato',
    [AUDIT_ACTIONS.SYSTEM_CONFIG_CHANGE]: 'Configurazione di sistema modificata',
    [AUDIT_ACTIONS.USER_LOGIN]: 'Accesso utente',
    [AUDIT_ACTIONS.USER_LOGOUT]: 'Disconnessione utente',
    [AUDIT_ACTIONS.USER_REGISTER]: 'Registrazione nuovo utente',
    [AUDIT_ACTIONS.USER_MODIFY]: 'Modifica dati utente',
    [AUDIT_ACTIONS.USER_DELETE]: 'Eliminazione utente',
    [AUDIT_ACTIONS.USER_ROLE_CHANGE]: 'Cambio ruolo utente',
    [AUDIT_ACTIONS.USER_INVITE]: 'Invito utente creato',
    [AUDIT_ACTIONS.SERVER_CREATE]: 'Server creato',
    [AUDIT_ACTIONS.SERVER_DELETE]: 'Server eliminato',
    [AUDIT_ACTIONS.SERVER_MODIFY]: 'Server modificato',
    [AUDIT_ACTIONS.SERVER_START]: 'Server avviato',
    [AUDIT_ACTIONS.SERVER_STOP]: 'Server arrestato',
    [AUDIT_ACTIONS.SERVER_RESTART]: 'Server riavviato',
    [AUDIT_ACTIONS.SERVER_BACKUP]: 'Backup server eseguito',
    [AUDIT_ACTIONS.SERVER_RESTORE]: 'Ripristino server eseguito',
    [AUDIT_ACTIONS.WIREGUARD_PEER_ADD]: 'Peer WireGuard aggiunto',
    [AUDIT_ACTIONS.WIREGUARD_PEER_REMOVE]: 'Peer WireGuard rimosso',
    [AUDIT_ACTIONS.WIREGUARD_PEER_MODIFY]: 'Peer WireGuard modificato',
    [AUDIT_ACTIONS.WIREGUARD_CONFIG_CHANGE]: 'Configurazione WireGuard modificata',
    [AUDIT_ACTIONS.DISCORD_COMMAND]: 'Comando Discord eseguito',
    [AUDIT_ACTIONS.DISCORD_CONFIG_CHANGE]: 'Configurazione Discord modificata',
    [AUDIT_ACTIONS.API_REQUEST]: 'Richiesta API effettuata',
    [AUDIT_ACTIONS.API_ERROR]: 'Errore API riscontrato'
  };
  
  return descriptions[action] || 'Azione non specificata';
}

// Processa i dettagli in base al livello di dettaglio configurato
function processDetails(details, detailLevel) {
  if (!details) return null;
  
  if (detailLevel === 'minimal') {
    // Ritorna solo informazioni di base
    const minimalDetails = {};
    
    // Include solo campi selezionati
    ['id', 'name', 'type', 'status'].forEach(key => {
      if (details[key] !== undefined) {
        minimalDetails[key] = details[key];
      }
    });
    
    return minimalDetails;
  } else if (detailLevel === 'medium') {
    // Filtra eventuali informazioni sensibili
    const filteredDetails = { ...details };
    
    // Rimuovi campi sensibili
    ['password', 'token', 'secret', 'key', 'privateKey'].forEach(sensitiveField => {
      if (filteredDetails[sensitiveField]) {
        filteredDetails[sensitiveField] = '***REDACTED***';
      }
    });
    
    return filteredDetails;
  } else {
    // Dettaglio completo, log tutto
    return details;
  }
}

// Registra l'audit log nella console
function logToConsole(auditLog) {
  const timestamp = auditLog.timestamp.toISOString();
  const level = auditLog.level.toUpperCase();
  
  let logMessage = `[${timestamp}] [AUDIT] [${level}] [${auditLog.action}] `;
  logMessage += `[${auditLog.username}] ${auditLog.description}`;
  
  switch (auditLog.level) {
    case AUDIT_LEVELS.ERROR:
    case AUDIT_LEVELS.CRITICAL:
      console.error(logMessage);
      break;
    case AUDIT_LEVELS.WARNING:
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

// Registra l'audit log nel database
async function logToDatabase(auditLog) {
  if (!databaseConnector) {
    console.error('Database connector non configurato per audit logging');
    return false;
  }
  
  try {
    // Converti i dettagli in JSON se necessario
    const details = auditLog.details ? JSON.stringify(auditLog.details) : null;
    
    // Inserisci nel database
    await databaseConnector.query(
      `INSERT INTO audit_logs 
      (id, timestamp, action, level, user_id, username, user_role, description, details, ip) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        auditLog.id,
        auditLog.timestamp,
        auditLog.action,
        auditLog.level,
        auditLog.userId,
        auditLog.username,
        auditLog.userRole,
        auditLog.description,
        details,
        auditLog.ip
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Errore durante la registrazione dell\'audit log nel database:', error);
    return false;
  }
}

// Registra l'audit log su Discord
async function logToDiscord(auditLog) {
  if (!discordClient || !auditConfig.discordChannel) {
    console.error('Discord client o canale non configurati per audit logging');
    return false;
  }
  
  try {
    // Ottieni il canale Discord
    const channel = await discordClient.channels.fetch(auditConfig.discordChannel);
    
    if (!channel) {
      console.error(`Canale Discord ${auditConfig.discordChannel} non trovato`);
      return false;
    }
    
    // Definisci il colore in base al livello
    let color = 0x00AAFF; // blue (default)
    
    switch (auditLog.level) {
      case AUDIT_LEVELS.INFO:
        color = 0x00AAFF; // blue
        break;
      case AUDIT_LEVELS.WARNING:
        color = 0xFFAA00; // orange
        break;
      case AUDIT_LEVELS.ERROR:
        color = 0xFF5500; // red
        break;
      case AUDIT_LEVELS.CRITICAL:
        color = 0xFF0000; // bright red
        break;
    }
    
    // Crea l'embed
    const embed = new EmbedBuilder()
      .setTitle(`${getEmojiForAction(auditLog.action)} Audit Log: ${formatActionName(auditLog.action)}`)
      .setDescription(auditLog.description)
      .setColor(color)
      .addFields(
        { name: 'Utente', value: auditLog.username, inline: true },
        { name: 'Ruolo', value: auditLog.userRole, inline: true },
        { name: 'Livello', value: formatLevel(auditLog.level), inline: true },
        { name: 'Timestamp', value: auditLog.timestamp.toISOString(), inline: false }
      )
      .setTimestamp();
    
    // Aggiungi dettagli se presenti
    if (auditLog.details && Object.keys(auditLog.details).length > 0) {
      // Formatta i dettagli in modo leggibile
      const detailsString = formatDetailsForDiscord(auditLog.details);
      
      if (detailsString.length <= 1024) {
        embed.addFields({ name: 'Dettagli', value: detailsString });
      } else {
        // Se i dettagli sono troppo lunghi, li dividiamo
        const parts = splitString(detailsString, 1024);
        embed.addFields({ name: 'Dettagli (1/2)', value: parts[0] });
        
        if (parts.length > 1) {
          embed.addFields({ name: 'Dettagli (2/2)', value: parts[1] });
        }
      }
    }
    
    // Invia l'embed
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('Errore durante la registrazione dell\'audit log su Discord:', error);
    return false;
  }
}

// Aggiungi un log alla cache dei log recenti
function addToRecentLogs(auditLog) {
  recentLogs.unshift(auditLog);
  
  // Mantieni solo gli ultimi MAX_CACHE_SIZE log
  if (recentLogs.length > MAX_CACHE_SIZE) {
    recentLogs.pop();
  }
}

// ==========================================
// FUNZIONI DI UTILITÀ
// ==========================================

// Formatta il nome dell'azione in modo leggibile
function formatActionName(action) {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Formatta il livello in modo leggibile
function formatLevel(level) {
  switch (level) {
    case AUDIT_LEVELS.INFO:
      return 'Informazione';
    case AUDIT_LEVELS.WARNING:
      return 'Avviso';
    case AUDIT_LEVELS.ERROR:
      return 'Errore';
    case AUDIT_LEVELS.CRITICAL:
      return 'Critico';
    default:
      return level.charAt(0).toUpperCase() + level.slice(1);
  }
}

// Ottiene un'emoji appropriata per il tipo di azione
function getEmojiForAction(action) {
  if (action.startsWith('system_')) return '🖥️';
  if (action.startsWith('user_')) return '👤';
  if (action.startsWith('server_')) return '🖥️';
  if (action.startsWith('wireguard_')) return '🔒';
  if (action.startsWith('discord_')) return '🤖';
  if (action.startsWith('api_')) return '🌐';
  return '📝';
}

// Formatta i dettagli per l'invio su Discord
function formatDetailsForDiscord(details) {
  if (!details) return 'Nessun dettaglio disponibile';
  
  let formattedDetails = '';
  
  for (const [key, value] of Object.entries(details)) {
    // Formatta l'output in base al tipo di valore
    let formattedValue;
    
    if (value === null || value === undefined) {
      formattedValue = 'null';
    } else if (typeof value === 'object') {
      formattedValue = '```\n' + JSON.stringify(value, null, 2) + '\n```';
    } else {
      formattedValue = String(value);
    }
    
    formattedDetails += `**${key}**: ${formattedValue}\n`;
  }
  
  return formattedDetails || 'Nessun dettaglio disponibile';
}

// Divide una stringa in parti di dimensione massima specificata
function splitString(str, maxLength) {
  const result = [];
  
  for (let i = 0; i < str.length; i += maxLength) {
    result.push(str.substring(i, i + maxLength));
  }
  
  return result;
}

// ==========================================
// API PUBBLICHE
// ==========================================

/**
 * Inizializza il sistema di audit logging
 * @param {Object} options - Opzioni di configurazione
 * @param {boolean} options.enabled - Abilita o disabilita l'audit logging
 * @param {boolean} options.logToConsole - Abilita il logging nella console
 * @param {boolean} options.logToDatabase - Abilita il logging nel database
 * @param {boolean} options.logToDiscord - Abilita il logging su Discord
 * @param {string} options.discordChannel - ID del canale Discord per il logging
 * @param {string} options.detailLevel - Livello di dettaglio ('minimal', 'medium', 'full')
 * @param {number} options.retentionPeriod - Periodo di conservazione in giorni
 * @param {Object} options.discordClient - Istanza client Discord
 * @param {Object} options.databaseConnector - Connettore al database
 * @returns {boolean} - True se l'inizializzazione è riuscita
 */
export function initAuditLogging(options = {}) {
  // Aggiorna la configurazione
  auditConfig = {
    ...auditConfig,
    ...options
  };
  
  // Imposta i riferimenti esterni
  if (options.discordClient) {
    discordClient = options.discordClient;
  }
  
  if (options.databaseConnector) {
    databaseConnector = options.databaseConnector;
  }
  
  // Crea la tabella di audit log se non esiste
  if (auditConfig.logToDatabase && databaseConnector) {
    try {
      databaseConnector.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(255) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          action VARCHAR(255) NOT NULL,
          level VARCHAR(50) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NOT NULL,
          user_role VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          details JSONB,
          ip VARCHAR(50) NOT NULL
        )
      `);
      
      // Crea un indice per migliorare le prestazioni delle query
      databaseConnector.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
      `);
      
      console.log('Tabella audit_logs creata con successo');
    } catch (error) {
      console.error('Errore durante la creazione della tabella audit_logs:', error);
    }
  }
  
  console.log('Sistema di audit logging inizializzato con successo');
  return true;
}

/**
 * Registra un'azione utente
 * @param {Object} req - Richiesta Express
 * @param {string} action - Tipo di azione (da AUDIT_ACTIONS)
 * @param {string} description - Descrizione dell'azione
 * @param {Object} details - Dettagli aggiuntivi
 * @param {string} level - Livello di severità (default: 'info')
 * @returns {Promise<Object>} - L'oggetto log creato
 */
export async function logUserAction(req, action, description, details = null, level = AUDIT_LEVELS.INFO) {
  // Estrai informazioni sull'utente dalla richiesta
  const userId = req.user?.id || 'anonymous';
  const username = req.user?.username || 'Anonymous';
  const userRole = req.user?.role || 'guest';
  
  // Ottieni l'indirizzo IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Registra l'azione
  return await logAction({
    action,
    level,
    userId,
    username,
    userRole,
    description,
    details,
    ip
  });
}

/**
 * Registra un comando Discord
 * @param {Object} interaction - Interazione Discord
 * @param {string} commandName - Nome del comando
 * @param {Object} options - Opzioni del comando
 * @returns {Promise<Object>} - L'oggetto log creato
 */
export async function logDiscordCommand(interaction, commandName, options = null) {
  // Estrai informazioni sull'utente
  const userId = interaction.user.id;
  const username = interaction.user.tag;
  const userRole = interaction.member?.roles.highest.name || 'member';
  
  // Crea la descrizione
  const description = `Comando Discord /${commandName} eseguito`;
  
  // Registra l'azione
  return await logAction({
    action: AUDIT_ACTIONS.DISCORD_COMMAND,
    level: AUDIT_LEVELS.INFO,
    userId,
    username,
    userRole,
    description,
    details: {
      command: commandName,
      options,
      channel: interaction.channel?.name || 'DM',
      guild: interaction.guild?.name || 'DM'
    }
  });
}

/**
 * Cerca nei log di audit
 * @param {Object} filters - Filtri per la ricerca
 * @param {string} filters.userId - Filtra per ID utente
 * @param {string} filters.action - Filtra per tipo di azione
 * @param {string} filters.level - Filtra per livello di severità
 * @param {Date} filters.startDate - Data di inizio
 * @param {Date} filters.endDate - Data di fine
 * @param {number} limit - Numero massimo di risultati
 * @param {number} offset - Offset per la paginazione
 * @returns {Promise<Array>} - Array di log di audit
 */
export async function searchAuditLogs(filters = {}, limit = 50, offset = 0) {
  if (!auditConfig.logToDatabase || !databaseConnector) {
    // Se il database non è configurato, restituisci i log recenti dalla cache
    return filterRecentLogs(filters, limit, offset);
  }
  
  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    // Aggiungi filtri
    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }
    
    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }
    
    if (filters.level) {
      query += ` AND level = $${paramIndex++}`;
      params.push(filters.level);
    }
    
    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    
    // Ordina per timestamp decrescente
    query += ' ORDER BY timestamp DESC';
    
    // Aggiungi limit e offset
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    // Esegui la query
    const result = await databaseConnector.query(query, params);
    
    // Converti i dettagli da JSON a oggetto
    return result.rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  } catch (error) {
    console.error('Errore durante la ricerca nei log di audit:', error);
    
    // In caso di errore, restituisci i log recenti dalla cache
    return filterRecentLogs(filters, limit, offset);
  }
}

// Filtra i log recenti dalla cache
function filterRecentLogs(filters, limit, offset) {
  let filteredLogs = [...recentLogs];
  
  // Applica i filtri
  if (filters.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
  }
  
  if (filters.action) {
    filteredLogs = filteredLogs.filter(log => log.action === filters.action);
  }
  
  if (filters.level) {
    filteredLogs = filteredLogs.filter(log => log.level === filters.level);
  }
  
  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
  }
  
  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
  }
  
  // Applica limit e offset
  return filteredLogs.slice(offset, offset + limit);
}

/**
 * Imposta il canale Discord per l'audit logging
 * @param {string} channelId - ID del canale Discord
 * @returns {boolean} - True se l'impostazione è riuscita
 */
export function setDiscordChannel(channelId) {
  auditConfig.discordChannel = channelId;
  auditConfig.logToDiscord = !!channelId;
  
  console.log(`Canale Discord per l'audit logging impostato su: ${channelId}`);
  return true;
}

/**
 * Abilita o disabilita l'audit logging
 * @param {boolean} enabled - True per abilitare, false per disabilitare
 * @returns {boolean} - Lo stato corrente
 */
export function setEnabled(enabled) {
  auditConfig.enabled = !!enabled;
  console.log(`Audit logging ${auditConfig.enabled ? 'abilitato' : 'disabilitato'}`);
  return auditConfig.enabled;
}

/**
 * Imposta il livello di dettaglio per l'audit logging
 * @param {string} level - Livello di dettaglio ('minimal', 'medium', 'full')
 * @returns {boolean} - True se l'impostazione è riuscita
 */
export function setDetailLevel(level) {
  if (['minimal', 'medium', 'full'].includes(level)) {
    auditConfig.detailLevel = level;
    console.log(`Livello di dettaglio dell'audit logging impostato su: ${level}`);
    return true;
  }
  
  console.error(`Livello di dettaglio non valido: ${level}`);
  return false;
}

/**
 * Ottieni la configurazione corrente dell'audit logging
 * @returns {Object} - La configurazione corrente
 */
export function getConfig() {
  return { ...auditConfig };
}

/**
 * Ottieni le statistiche dell'audit logging
 * @returns {Promise<Object>} - Statistiche sui log di audit
 */
export async function getStats() {
  const stats = {
    totalLogs: recentLogs.length,
    recentLogs: recentLogs.length,
    byLevel: {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    },
    byAction: {}
  };
  
  // Conta i log per livello
  recentLogs.forEach(log => {
    stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
  });
  
  // Se il database è configurato, ottieni anche il conteggio totale
  if (auditConfig.logToDatabase && databaseConnector) {
    try {
      const result = await databaseConnector.query('SELECT COUNT(*) as total FROM audit_logs');
      stats.totalLogs = parseInt(result.rows[0].total, 10);
      
      // Ottieni conteggi per livello
      const levelCounts = await databaseConnector.query(
        'SELECT level, COUNT(*) as count FROM audit_logs GROUP BY level'
      );
      
      levelCounts.rows.forEach(row => {
        stats.byLevel[row.level] = parseInt(row.count, 10);
      });
      
      // Ottieni conteggi per azione
      const actionCounts = await databaseConnector.query(
        'SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action'
      );
      
      actionCounts.rows.forEach(row => {
        stats.byAction[row.action] = parseInt(row.count, 10);
      });
    } catch (error) {
      console.error('Errore durante il recupero delle statistiche dell\'audit log:', error);
    }
  }
  
  return stats;
}

// Esporta tutte le funzioni pubbliche
export default {
  AUDIT_ACTIONS,
  AUDIT_LEVELS,
  initAuditLogging,
  logAction,
  logUserAction,
  logDiscordCommand,
  searchAuditLogs,
  setDiscordChannel,
  setEnabled,
  setDetailLevel,
  getConfig,
  getStats
};