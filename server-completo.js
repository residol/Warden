import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection, REST, Routes, Events } from 'discord.js';
import axios from 'axios';

// Carica le variabili d'ambiente
dotenv.config();

// Ottieni il percorso corrente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crea l'app Express
const app = express();
app.use(express.json());

// Crea il server HTTP
const httpServer = createServer(app);

// Configurazione Pterodactyl
const PTERODACTYL_URL = process.env.PTERODACTYL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;

// Configurazione WireGuard
const WG_SERVER_ENDPOINT = process.env.WG_SERVER_ENDPOINT;
const WG_SERVER_PUBLIC_KEY = process.env.WG_SERVER_PUBLIC_KEY;
const WG_PRIVATE_KEY = process.env.WG_PRIVATE_KEY;

// Setup WebSocket server
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

// Gestione connessioni WebSocket
wss.on('connection', (ws) => {
  console.log('WebSocket client connected to /ws');
  
  // Invia dati iniziali
  ws.send(JSON.stringify({ type: 'init', message: 'Connessione WebSocket stabilita' }));
  
  // Gestione chiusura connessione
  ws.on('close', () => {
    console.log('WebSocket client disconnected from /ws');
  });
});

// Broadcast a tutti i client connessi
const broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
};

// ======================
// PTERODACTYL INTEGRATION
// ======================

// Servizio Pterodactyl
class PterodactylService {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
    this.baseURL = url.endsWith('/') ? url : `${url}/`;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  // Verifica connessione con Pterodactyl
  async checkConnection() {
    try {
      const response = await this.axiosInstance.get('api/application/nodes');
      return response.status === 200;
    } catch (error) {
      console.error('Errore durante la verifica della connessione Pterodactyl:', error.message);
      return false;
    }
  }

  // Ottieni lista server
  async getServers() {
    try {
      const response = await this.axiosInstance.get('api/application/servers');
      return response.data.data;
    } catch (error) {
      console.error('Errore durante il recupero dei server Pterodactyl:', error.message);
      return [];
    }
  }

  // Ottieni informazioni su un server specifico
  async getServer(serverId) {
    try {
      const response = await this.axiosInstance.get(`api/application/servers/${serverId}`);
      return response.data.attributes;
    } catch (error) {
      console.error(`Errore durante il recupero del server ${serverId}:`, error.message);
      return null;
    }
  }

  // Avvia un server
  async startServer(serverId) {
    try {
      await this.axiosInstance.post(`api/client/servers/${serverId}/power`, {
        signal: 'start'
      });
      return true;
    } catch (error) {
      console.error(`Errore durante l'avvio del server ${serverId}:`, error.message);
      return false;
    }
  }

  // Ferma un server
  async stopServer(serverId) {
    try {
      await this.axiosInstance.post(`api/client/servers/${serverId}/power`, {
        signal: 'stop'
      });
      return true;
    } catch (error) {
      console.error(`Errore durante l'arresto del server ${serverId}:`, error.message);
      return false;
    }
  }

  // Riavvia un server
  async restartServer(serverId) {
    try {
      await this.axiosInstance.post(`api/client/servers/${serverId}/power`, {
        signal: 'restart'
      });
      return true;
    } catch (error) {
      console.error(`Errore durante il riavvio del server ${serverId}:`, error.message);
      return false;
    }
  }

  // Ottieni risorse utilizzate da un server
  async getServerResources(serverId) {
    try {
      const response = await this.axiosInstance.get(`api/client/servers/${serverId}/resources`);
      return response.data.attributes;
    } catch (error) {
      console.error(`Errore durante il recupero delle risorse per il server ${serverId}:`, error.message);
      return null;
    }
  }

  // Ottieni tutti i nodi disponibili
  async getNodes() {
    try {
      const response = await this.axiosInstance.get('api/application/nodes');
      return response.data.data;
    } catch (error) {
      console.error('Errore durante il recupero dei nodi Pterodactyl:', error.message);
      return [];
    }
  }
}

// Inizializza il servizio Pterodactyl se le credenziali sono disponibili
let pterodactyl = null;
if (PTERODACTYL_URL && PTERODACTYL_API_KEY) {
  pterodactyl = new PterodactylService(PTERODACTYL_URL, PTERODACTYL_API_KEY);
  console.log('🦖 Servizio Pterodactyl inizializzato');
} else {
  console.warn('⚠️ Credenziali Pterodactyl mancanti, servizio non disponibile');
}

// ======================
// WIREGUARD SERVICE
// ======================

class WireguardService {
  constructor(endpoint, publicKey, privateKey) {
    this.endpoint = endpoint;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.peers = [];
    this.initialized = !!endpoint && !!publicKey && !!privateKey;
  }

  // Verifica lo stato di WireGuard
  async getStatus() {
    // In un ambiente reale, questo metodo potrebbe eseguire un comando shell
    // per verificare lo stato di WireGuard usando wg show
    return {
      active: this.initialized,
      endpoint: this.endpoint,
      publicKey: this.publicKey ? this.publicKey.substring(0, 10) + '...' : null,
      peers: this.peers,
      uptime: this.initialized ? '3d 5h 12m' : null // Esempio di uptime
    };
  }

  // Genera configurazione per nuovo peer
  async generatePeerConfig(name, ip) {
    if (!this.initialized) {
      throw new Error('WireGuard non è inizializzato correttamente');
    }

    // In un ambiente reale, qui genereresti effettivamente le chiavi e configurazione
    // Per ora restituiamo una configurazione di esempio
    const peerPrivateKey = 'PEER_PRIVATE_KEY_EXAMPLE';
    const peerPublicKey = 'PEER_PUBLIC_KEY_EXAMPLE';

    // Aggiungi il peer alla lista
    this.peers.push({
      name,
      publicKey: peerPublicKey,
      ip,
      lastSeen: null,
      status: 'disconnected'
    });

    // Genera configurazione client
    const config = `
[Interface]
PrivateKey = ${peerPrivateKey}
Address = ${ip}/24
DNS = 8.8.8.8, 1.1.1.1

[Peer]
PublicKey = ${this.publicKey}
Endpoint = ${this.endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
    `;

    return {
      config,
      privateKey: peerPrivateKey,
      publicKey: peerPublicKey,
      ip
    };
  }
}

// Inizializza il servizio WireGuard se le credenziali sono disponibili
let wireguard = null;
if (WG_SERVER_ENDPOINT && WG_SERVER_PUBLIC_KEY && WG_PRIVATE_KEY) {
  wireguard = new WireguardService(WG_SERVER_ENDPOINT, WG_SERVER_PUBLIC_KEY, WG_PRIVATE_KEY);
  console.log('📡 Servizio WireGuard inizializzato con successo');
} else {
  console.warn('⚠️ Credenziali WireGuard mancanti, servizio non disponibile');
}

// ======================
// BOT DISCORD
// ======================

// Inizializza il client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Collezione per i comandi
client.commands = new Collection();

// Funzione per inizializzare il bot Discord
async function startDiscordBot() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID;
  
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN non trovato nelle variabili d\'ambiente');
    return false;
  }
  
  try {
    console.log('🤖 Inizializzazione Bot Discord...');
    
    // Definisci comandi per il Discord bot
    const commands = [
      {
        name: 'ping',
        description: 'Verifica se il bot è attivo',
        execute: async (interaction) => {
          const start = Date.now();
          await interaction.reply('Pong!');
          const end = Date.now();
          await interaction.editReply(`Pong! (${end - start}ms)`);
        }
      },
      {
        name: 'status',
        description: 'Mostra lo stato del sistema',
        execute: async (interaction) => {
          await interaction.deferReply();
          
          let statusMessage = '## Stato del Sistema\n';
          
          // Verifica WireGuard
          if (wireguard?.initialized) {
            statusMessage += '✅ **WireGuard**: Online\n';
          } else {
            statusMessage += '❌ **WireGuard**: Non configurato\n';
          }
          
          // Verifica Pterodactyl
          if (pterodactyl) {
            try {
              const connected = await pterodactyl.checkConnection();
              if (connected) {
                statusMessage += '✅ **Pterodactyl**: Connesso\n';
                
                // Ottieni lista server se connesso
                try {
                  const servers = await pterodactyl.getServers();
                  statusMessage += `\n### Server (${servers.length})\n`;
                  
                  for (const server of servers.slice(0, 5)) { // Mostra solo i primi 5 server
                    const serverAttr = server.attributes;
                    statusMessage += `- **${serverAttr.name}**: ${serverAttr.status || 'Sconosciuto'}\n`;
                  }
                  
                  if (servers.length > 5) {
                    statusMessage += `- *...e altri ${servers.length - 5} server*\n`;
                  }
                } catch (error) {
                  statusMessage += '\n❌ **Errore**: Impossibile recuperare la lista dei server\n';
                }
              } else {
                statusMessage += '❌ **Pterodactyl**: Errore di connessione\n';
              }
            } catch (error) {
              statusMessage += '❌ **Pterodactyl**: Errore di connessione\n';
            }
          } else {
            statusMessage += '❌ **Pterodactyl**: Non configurato\n';
          }
          
          await interaction.editReply(statusMessage);
        }
      },
      {
        name: 'servers',
        description: 'Mostra la lista dei server',
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!pterodactyl) {
            await interaction.editReply('❌ Pterodactyl non è configurato');
            return;
          }
          
          try {
            const servers = await pterodactyl.getServers();
            
            if (servers.length === 0) {
              await interaction.editReply('Nessun server trovato');
              return;
            }
            
            let message = '## Server Disponibili\n';
            
            for (const server of servers) {
              const attr = server.attributes;
              message += `### ${attr.name}\n`;
              message += `- **ID**: ${attr.identifier}\n`;
              message += `- **Stato**: ${attr.status || 'Sconosciuto'}\n`;
              message += `- **Node**: ${attr.node}\n`;
              message += '\n';
            }
            
            await interaction.editReply(message);
          } catch (error) {
            console.error('Errore durante il recupero dei server:', error);
            await interaction.editReply('❌ Errore durante il recupero dei server');
          }
        }
      },
      {
        name: 'server',
        description: 'Mostra informazioni su un server specifico',
        options: [
          {
            name: 'id',
            description: 'ID del server',
            type: 3, // STRING
            required: true
          }
        ],
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!pterodactyl) {
            await interaction.editReply('❌ Pterodactyl non è configurato');
            return;
          }
          
          const serverId = interaction.options.getString('id');
          
          try {
            const server = await pterodactyl.getServer(serverId);
            
            if (!server) {
              await interaction.editReply(`❌ Server con ID ${serverId} non trovato`);
              return;
            }
            
            let message = `## Server: ${server.name}\n`;
            message += `- **ID**: ${server.identifier}\n`;
            message += `- **Stato**: ${server.status || 'Sconosciuto'}\n`;
            message += `- **Node**: ${server.node}\n`;
            message += `- **Allocazioni**: ${server.allocation}\n`;
            
            // Aggiungi informazioni sulle risorse se disponibili
            try {
              const resources = await pterodactyl.getServerResources(serverId);
              
              if (resources) {
                message += '\n### Risorse\n';
                message += `- **CPU**: ${resources.cpu.current}%\n`;
                message += `- **Memoria**: ${Math.round(resources.memory.current / 1024 / 1024)} MB / ${Math.round(resources.memory.limit / 1024 / 1024)} MB\n`;
                message += `- **Disco**: ${Math.round(resources.disk.current / 1024 / 1024)} MB / ${Math.round(resources.disk.limit / 1024 / 1024)} MB\n`;
              }
            } catch (error) {
              console.error('Errore durante il recupero delle risorse:', error);
              message += '\n❌ Impossibile recuperare le informazioni sulle risorse\n';
            }
            
            await interaction.editReply(message);
          } catch (error) {
            console.error('Errore durante il recupero del server:', error);
            await interaction.editReply('❌ Errore durante il recupero del server');
          }
        }
      },
      {
        name: 'start',
        description: 'Avvia un server',
        options: [
          {
            name: 'id',
            description: 'ID del server',
            type: 3, // STRING
            required: true
          }
        ],
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!pterodactyl) {
            await interaction.editReply('❌ Pterodactyl non è configurato');
            return;
          }
          
          const serverId = interaction.options.getString('id');
          
          try {
            const success = await pterodactyl.startServer(serverId);
            
            if (success) {
              await interaction.editReply(`✅ Server ${serverId} avviato con successo`);
            } else {
              await interaction.editReply(`❌ Impossibile avviare il server ${serverId}`);
            }
          } catch (error) {
            console.error('Errore durante l\'avvio del server:', error);
            await interaction.editReply('❌ Errore durante l\'avvio del server');
          }
        }
      },
      {
        name: 'stop',
        description: 'Ferma un server',
        options: [
          {
            name: 'id',
            description: 'ID del server',
            type: 3, // STRING
            required: true
          }
        ],
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!pterodactyl) {
            await interaction.editReply('❌ Pterodactyl non è configurato');
            return;
          }
          
          const serverId = interaction.options.getString('id');
          
          try {
            const success = await pterodactyl.stopServer(serverId);
            
            if (success) {
              await interaction.editReply(`✅ Server ${serverId} fermato con successo`);
            } else {
              await interaction.editReply(`❌ Impossibile fermare il server ${serverId}`);
            }
          } catch (error) {
            console.error('Errore durante l\'arresto del server:', error);
            await interaction.editReply('❌ Errore durante l\'arresto del server');
          }
        }
      },
      {
        name: 'restart',
        description: 'Riavvia un server',
        options: [
          {
            name: 'id',
            description: 'ID del server',
            type: 3, // STRING
            required: true
          }
        ],
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!pterodactyl) {
            await interaction.editReply('❌ Pterodactyl non è configurato');
            return;
          }
          
          const serverId = interaction.options.getString('id');
          
          try {
            const success = await pterodactyl.restartServer(serverId);
            
            if (success) {
              await interaction.editReply(`✅ Server ${serverId} riavviato con successo`);
            } else {
              await interaction.editReply(`❌ Impossibile riavviare il server ${serverId}`);
            }
          } catch (error) {
            console.error('Errore durante il riavvio del server:', error);
            await interaction.editReply('❌ Errore durante il riavvio del server');
          }
        }
      },
      {
        name: 'wireguard',
        description: 'Mostra lo stato di WireGuard',
        execute: async (interaction) => {
          await interaction.deferReply();
          
          if (!wireguard || !wireguard.initialized) {
            await interaction.editReply('❌ WireGuard non è configurato');
            return;
          }
          
          try {
            const status = await wireguard.getStatus();
            
            let message = '## Stato WireGuard\n';
            message += `- **Stato**: ${status.active ? 'Attivo' : 'Inattivo'}\n`;
            message += `- **Endpoint**: ${status.endpoint}\n`;
            message += `- **Chiave Pubblica**: ${status.publicKey}\n`;
            
            if (status.peers.length > 0) {
              message += '\n### Peers Connessi\n';
              
              for (const peer of status.peers) {
                message += `- **${peer.name}**: ${peer.status} (${peer.ip})\n`;
              }
            } else {
              message += '\nNessun peer connesso';
            }
            
            await interaction.editReply(message);
          } catch (error) {
            console.error('Errore durante il recupero dello stato WireGuard:', error);
            await interaction.editReply('❌ Errore durante il recupero dello stato WireGuard');
          }
        }
      },
      {
        name: 'help',
        description: 'Mostra la lista dei comandi disponibili',
        execute: async (interaction) => {
          let helpMessage = '## Comandi Disponibili\n';
          
          client.commands.forEach(cmd => {
            helpMessage += `- **/${cmd.name}**: ${cmd.description}\n`;
          });
          
          await interaction.reply(helpMessage);
        }
      }
    ];
    
    // Registra i comandi nella collezione
    for (const command of commands) {
      client.commands.set(command.name, command);
    }
    
    // Registra i comandi slash con l'API Discord se CLIENT_ID e GUILD_ID sono disponibili
    if (CLIENT_ID && GUILD_ID) {
      try {
        console.log('Registrazione comandi slash...');
        
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        
        // Prepara i dati dei comandi per la registrazione
        const commandsData = commands.map(cmd => {
          const data = {
            name: cmd.name,
            description: cmd.description
          };
          
          // Aggiungi opzioni se presenti
          if (cmd.options) {
            data.options = cmd.options;
          }
          
          return data;
        });
        
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
          { body: commandsData }
        );
        
        console.log('✅ Comandi slash registrati con successo!');
      } catch (error) {
        console.error('❌ Errore durante la registrazione dei comandi slash:', error);
      }
    } else {
      console.warn('⚠️ CLIENT_ID o GUILD_ID non trovati. I comandi slash non saranno registrati.');
    }
    
    // Evento ready
    client.once(Events.ClientReady, () => {
      console.log(`✅ Bot Discord pronto! Loggato come ${client.user.tag}`);
      
      // Imposta lo stato del bot
      client.user.setPresence({
        activities: [{ name: 'Server di Gioco', type: 0 }],
        status: 'online'
      });
    });
    
    // Evento interactionCreate
    client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isChatInputCommand()) return;
      
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('❌ Errore durante l\'esecuzione del comando:', error);
        
        const errorMsg = 'Si è verificato un errore durante l\'esecuzione del comando';
        
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMsg }).catch(console.error);
        } else {
          await interaction.reply({ content: errorMsg, ephemeral: true }).catch(console.error);
        }
      }
    });
    
    // Login del bot
    await client.login(BOT_TOKEN);
    return true;
  } catch (error) {
    console.error('❌ Errore durante l\'avvio del bot Discord:', error);
    return false;
  }
}

// ======================
// API ROUTES
// ======================

// Stato del server
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    discord_bot: client.isReady() ? 'online' : 'offline',
    pterodactyl: pterodactyl ? 'configured' : 'not_configured',
    wireguard: wireguard?.initialized ? 'configured' : 'not_configured'
  });
});

// WireGuard status
app.get('/api/wireguard/status', async (req, res) => {
  if (!wireguard || !wireguard.initialized) {
    return res.json({
      status: 'inactive',
      message: 'WireGuard non è configurato'
    });
  }
  
  try {
    const status = await wireguard.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Errore durante il recupero dello stato WireGuard:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante il recupero dello stato WireGuard' 
    });
  }
});

// Lista server Pterodactyl
app.get('/api/servers', async (req, res) => {
  if (!pterodactyl) {
    return res.json({
      servers: [],
      message: 'Pterodactyl non è configurato'
    });
  }
  
  try {
    const servers = await pterodactyl.getServers();
    
    // Trasforma i dati in un formato più semplice
    const simpleServers = servers.map(server => {
      const attr = server.attributes;
      return {
        id: attr.identifier,
        name: attr.name,
        node: attr.node,
        status: attr.status || 'unknown'
      };
    });
    
    res.json({ servers: simpleServers });
  } catch (error) {
    console.error('Errore durante il recupero dei server Pterodactyl:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante il recupero dei server' 
    });
  }
});

// Informazioni su un server specifico
app.get('/api/servers/:id', async (req, res) => {
  if (!pterodactyl) {
    return res.status(400).json({
      status: 'error',
      message: 'Pterodactyl non è configurato'
    });
  }
  
  const serverId = req.params.id;
  
  try {
    const server = await pterodactyl.getServer(serverId);
    
    if (!server) {
      return res.status(404).json({
        status: 'error',
        message: `Server ${serverId} non trovato`
      });
    }
    
    // Aggiungi informazioni sulle risorse se possibile
    let resources = null;
    try {
      resources = await pterodactyl.getServerResources(serverId);
    } catch (error) {
      console.warn(`Impossibile recuperare le risorse per il server ${serverId}:`, error.message);
    }
    
    res.json({
      ...server,
      resources
    });
  } catch (error) {
    console.error(`Errore durante il recupero del server ${serverId}:`, error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante il recupero del server' 
    });
  }
});

// Avvia un server
app.post('/api/servers/:id/start', async (req, res) => {
  if (!pterodactyl) {
    return res.status(400).json({
      status: 'error',
      message: 'Pterodactyl non è configurato'
    });
  }
  
  const serverId = req.params.id;
  
  try {
    const success = await pterodactyl.startServer(serverId);
    
    if (success) {
      res.json({
        status: 'success',
        message: `Server ${serverId} avviato con successo`
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: `Impossibile avviare il server ${serverId}`
      });
    }
  } catch (error) {
    console.error(`Errore durante l'avvio del server ${serverId}:`, error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante l\'avvio del server' 
    });
  }
});

// Ferma un server
app.post('/api/servers/:id/stop', async (req, res) => {
  if (!pterodactyl) {
    return res.status(400).json({
      status: 'error',
      message: 'Pterodactyl non è configurato'
    });
  }
  
  const serverId = req.params.id;
  
  try {
    const success = await pterodactyl.stopServer(serverId);
    
    if (success) {
      res.json({
        status: 'success',
        message: `Server ${serverId} fermato con successo`
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: `Impossibile fermare il server ${serverId}`
      });
    }
  } catch (error) {
    console.error(`Errore durante l'arresto del server ${serverId}:`, error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante l\'arresto del server' 
    });
  }
});

// Riavvia un server
app.post('/api/servers/:id/restart', async (req, res) => {
  if (!pterodactyl) {
    return res.status(400).json({
      status: 'error',
      message: 'Pterodactyl non è configurato'
    });
  }
  
  const serverId = req.params.id;
  
  try {
    const success = await pterodactyl.restartServer(serverId);
    
    if (success) {
      res.json({
        status: 'success',
        message: `Server ${serverId} riavviato con successo`
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: `Impossibile riavviare il server ${serverId}`
      });
    }
  } catch (error) {
    console.error(`Errore durante il riavvio del server ${serverId}:`, error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Errore durante il riavvio del server' 
    });
  }
});

// Informazioni sul bot Discord
app.get('/api/discord/status', (req, res) => {
  if (client.isReady()) {
    res.json({
      status: 'online',
      username: client.user.tag,
      servers: client.guilds.cache.size,
      commands: client.commands.size
    });
  } else {
    res.json({
      status: 'offline',
      message: 'Il bot Discord non è connesso'
    });
  }
});

// Servi i file statici frontend
const clientDist = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  console.log(`Serving static files from ${clientDist}`);
  
  // Tutte le altre rotte servono l'app frontend
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  console.warn('Directory dist/public non trovata. L\'interfaccia web non sarà disponibile.');
  
  // Pagina di fallback
  app.get('*', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server di Gioco</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
            h1 { color: #333; }
            .card { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Server di Gioco</h1>
          <div class="card">
            <h2>Stato del Server</h2>
            <p>Il server API è in esecuzione, ma l'interfaccia web non è disponibile.</p>
            <p>Usa gli endpoint API per interagire con il sistema.</p>
          </div>
          <div class="card">
            <h2>API disponibili</h2>
            <ul>
              <li><code>/api/health</code> - Stato del server</li>
              <li><code>/api/wireguard/status</code> - Stato WireGuard</li>
              <li><code>/api/servers</code> - Lista server</li>
              <li><code>/api/discord/status</code> - Stato del bot Discord</li>
            </ul>
          </div>
        </body>
      </html>
    `);
  });
}

// ======================
// AVVIO SERVER
// ======================

// Avvia il server
const PORT = process.env.PORT || 5002; // Nota: porta cambiata per evitare conflitti
httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`⚡️ Server attivo su http://0.0.0.0:${PORT}`);
  console.log(`🌐 Modalità: ${process.env.NODE_ENV || 'development'}`);
  
  // Avvia il bot Discord
  const botStarted = await startDiscordBot();
  
  // Logga informazioni di configurazione
  console.log('\n📜 Configurazione:');
  
  // WireGuard
  if (wireguard?.initialized) {
    console.log('- WireGuard: ✅ Configurato');
  } else {
    console.log('- WireGuard: ❌ Configurazione incompleta');
  }
  
  // Pterodactyl
  if (pterodactyl) {
    try {
      const connected = await pterodactyl.checkConnection();
      if (connected) {
        console.log('- Pterodactyl: ✅ Connesso');
      } else {
        console.log('- Pterodactyl: ❌ Errore di connessione');
      }
    } catch (error) {
      console.log('- Pterodactyl: ❌ Errore di connessione');
    }
  } else {
    console.log('- Pterodactyl: ❌ Configurazione incompleta');
  }
  
  // Discord Bot
  if (botStarted) {
    console.log('- Discord Bot: ✅ Avviato');
  } else {
    console.log('- Discord Bot: ❌ Non avviato');
  }
  
  // JWT
  const jwtSecret = process.env.JWT_SECRET;
  
  if (jwtSecret) {
    console.log('- JWT: ✅ Configurato');
  } else {
    console.log('- JWT: ⚠️ Secret non definito (generato casualmente)');
  }
});