import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { registerRoutes } from './routes';
import { setupVite } from './vite';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

// Crea l'app Express
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Middleware per parsing JSON
app.use(express.json());

// Verifica che le variabili d'ambiente necessarie siano presenti
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set in environment variables');
  process.exit(1);
}

// Configurazione database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Avvia il server
async function startServer() {
  try {
    // Verifica connessione al database
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Verifica connessione a Pterodactyl se configurato
    if (process.env.PTERODACTYL_URL && process.env.PTERODACTYL_API_KEY) {
      console.log('🦖 Pterodactyl integration enabled');
    } else {
      console.warn('⚠️ Pterodactyl integration not configured');
    }

    // Verifica configurazione WireGuard se presente
    if (process.env.WG_SERVER_ENDPOINT && 
        process.env.WG_SERVER_PUBLIC_KEY && 
        process.env.WG_PRIVATE_KEY) {
      console.log('🔒 WireGuard integration enabled');
    } else {
      console.warn('⚠️ WireGuard integration not configured');
    }

    // Configura le rotte e ottieni il server HTTP
    const httpServer = await registerRoutes(app);

    // Configura WebSocket server
    const wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws' 
    });

    // Gestisci connessioni WebSocket
    wss.on('connection', (ws) => {
      console.log('🔌 WebSocket client connected');
      
      // Invia messaggio di benvenuto
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connesso al server WebSocket'
      }));
      
      // Gestisci messaggi in arrivo
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('📩 WebSocket message received:', data.type);
          
          // Gestisci i diversi tipi di messaggi
          switch (data.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
            // Altri tipi di messaggi possono essere gestiti qui
            default:
              console.warn('📩 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      });
      
      // Gestisci disconnessione
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
      });
    });

    // Configurazione del server di sviluppo Vite
    if (process.env.NODE_ENV !== 'production') {
      // In development mode, setup Vite middleware
      await setupVite(app, httpServer);
    } else {
      // In production mode, serve static files
      const clientDistPath = path.resolve(__dirname, '../client/dist');
      app.use(express.static(clientDistPath));
      
      // For SPA routing, serve index.html for all non-API paths
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
          next();
        } else {
          res.sendFile(path.join(clientDistPath, 'index.html'));
        }
      });
    }

    // Avvia il server sulla porta specificata
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`✅ Server is running at http://0.0.0.0:${port}`);
    });

    // Gestione graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM signal received: closing HTTP server');
      httpServer.close(() => {
        console.log('🛑 HTTP server closed');
        pool.end();
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Avvia il server
startServer();