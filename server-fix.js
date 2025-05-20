import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

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

// API Routes

// Stato del server
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development' 
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
            </ul>
          </div>
        </body>
      </html>
    `);
  });
}

// Avvia il server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️ Server attivo su http://0.0.0.0:${PORT}`);
  console.log(`🌐 Modalità: ${process.env.NODE_ENV || 'development'}`);
  
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
  
  // JWT
  const jwtSecret = process.env.JWT_SECRET;
  
  if (jwtSecret) {
    console.log('- JWT: ✅ Configurato');
  } else {
    console.log('- JWT: ⚠️ Secret non definito (generato casualmente)');
  }
});