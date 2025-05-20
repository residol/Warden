import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';

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
    
    // Definisci alcuni comandi semplici
    const commands = [
      {
        name: 'ping',
        description: 'Risponde con pong!',
        execute: async (interaction) => {
          await interaction.reply('Pong!');
        }
      },
      {
        name: 'status',
        description: 'Mostra lo stato del server',
        execute: async (interaction) => {
          const wgPublicKey = process.env.WG_SERVER_PUBLIC_KEY;
          const wgEndpoint = process.env.WG_SERVER_ENDPOINT;
          const pteroUrl = process.env.PTERODACTYL_URL;
          
          let statusMessage = '## Stato del Server\n';
          statusMessage += '**Web Server**: ✅ Online\n';
          statusMessage += `**WireGuard**: ${wgPublicKey && wgEndpoint ? '✅ Configurato' : '❌ Non configurato'}\n`;
          statusMessage += `**Pterodactyl**: ${pteroUrl ? '✅ Configurato' : '❌ Non configurato'}\n`;
          
          await interaction.reply(statusMessage);
        }
      },
      {
        name: 'help',
        description: 'Mostra i comandi disponibili',
        execute: async (interaction) => {
          let helpMessage = '## Comandi Disponibili\n';
          client.commands.forEach(cmd => {
            helpMessage += `**/$ {cmd.name}**: ${cmd.description}\n`;
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
        const commandsData = commands.map(cmd => ({
          name: cmd.name,
          description: cmd.description
        }));
        
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
    client.once('ready', () => {
      console.log(`✅ Bot Discord pronto! Loggato come ${client.user.tag}`);
      
      // Imposta lo stato del bot
      client.user.setPresence({
        activities: [{ name: 'Server di Gioco', type: 0 }],
        status: 'online'
      });
    });
    
    // Evento interactionCreate
    client.on('interactionCreate', async interaction => {
      if (!interaction.isCommand()) return;
      
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('❌ Errore durante l\'esecuzione del comando:', error);
        await interaction.reply({ 
          content: 'Si è verificato un errore durante l\'esecuzione del comando', 
          ephemeral: true 
        }).catch(console.error);
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
    discord_bot: client.isReady() ? 'online' : 'offline' 
  });
});

// WireGuard status
app.get('/api/wireguard/status', (req, res) => {
  // Ottieni le informazioni WireGuard dalle variabili d'ambiente
  const wgPublicKey = process.env.WG_SERVER_PUBLIC_KEY;
  const wgEndpoint = process.env.WG_SERVER_ENDPOINT;

  res.json({
    status: wgPublicKey && wgEndpoint ? 'active' : 'inactive',
    endpoint: wgEndpoint || 'not_configured',
    publicKey: wgPublicKey ? `${wgPublicKey.substring(0, 8)}...` : 'not_configured',
    peers: []
  });
});

// Lista server
app.get('/api/servers', (req, res) => {
  // Verifica API Pterodactyl
  const pteroUrl = process.env.PTERODACTYL_URL;
  const pteroApiKey = process.env.PTERODACTYL_API_KEY;

  if (pteroUrl && pteroApiKey) {
    // In un'implementazione reale, qui faresti una chiamata a Pterodactyl
    res.json({
      servers: [
        {
          id: 1,
          name: 'Server Minecraft (Esempio)',
          type: 'minecraft',
          status: 'online',
          players: 0,
          maxPlayers: 20
        }
      ]
    });
  } else {
    res.json({
      servers: [],
      message: 'Configurazione Pterodactyl assente o incompleta'
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
  const wgPublicKey = process.env.WG_SERVER_PUBLIC_KEY;
  const wgEndpoint = process.env.WG_SERVER_ENDPOINT;
  
  if (wgPublicKey && wgEndpoint) {
    console.log('- WireGuard: ✅ Configurato');
  } else {
    console.log('- WireGuard: ❌ Configurazione incompleta');
  }
  
  // Pterodactyl
  const pteroUrl = process.env.PTERODACTYL_URL;
  const pteroApiKey = process.env.PTERODACTYL_API_KEY;
  
  if (pteroUrl && pteroApiKey) {
    console.log('- Pterodactyl: ✅ Configurato');
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