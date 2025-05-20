#!/usr/bin/env node

// Script per la correzione dell'applicazione in produzione
// Utilizza l'estensione .mjs per essere eseguito con sintassi ES modules

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Ottieni il percorso corrente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

console.log('🔧 Avvio correzione per VPS (ES modules)...');

// 1. Crea la directory dist se non esiste
console.log('📁 Creazione directory dist...');
const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Crea un file server.js minimale che funzionerà in produzione
console.log('📝 Creazione server.js minimale...');
const serverJs = `
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

// Configurazione dei percorsi
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crea l'app Express
const app = express();
app.use(express.json());

// Verifica WireGuard
const wgPublicKey = process.env.WG_SERVER_PUBLIC_KEY;
const wgEndpoint = process.env.WG_SERVER_ENDPOINT;

if (wgPublicKey && wgEndpoint) {
  console.log('📡 Configurazione WireGuard trovata:');
  console.log(\`  Endpoint: \${wgEndpoint}\`);
  console.log(\`  Chiave pubblica: \${wgPublicKey.substring(0, 10)}...\`);
} else {
  console.warn('⚠️ Configurazione WireGuard incompleta');
}

// Verifica Pterodactyl
const pteroUrl = process.env.PTERODACTYL_URL;
const pteroApiKey = process.env.PTERODACTYL_API_KEY;

if (pteroUrl && pteroApiKey) {
  console.log('🦖 Configurazione Pterodactyl trovata:');
  console.log(\`  URL: \${pteroUrl}\`);
  console.log(\`  API Key: \${pteroApiKey.substring(0, 10)}...\`);
} else {
  console.warn('⚠️ Configurazione Pterodactyl incompleta');
}

// Servi i file statici se disponibili
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('🌐 Servizio file statici dalla directory public');
}

// Crea il server HTTP
const server = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ 
  server: server,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected to /ws');
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected from /ws');
  });
});

// Aggiungi rotte API di base
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
});

app.get('/api/servers', (req, res) => {
  res.json({ servers: [], message: 'Funzionalità server disabilitata in modalità compatibilità' });
});

app.get('/api/wireguard/status', (req, res) => {
  res.json({ 
    status: 'active', 
    endpoint: wgEndpoint || 'non configurato',
    peers: [],
    message: 'Funzionalità WireGuard disabilitata in modalità compatibilità'
  });
});

// Gestisci tutte le altre richieste inviando l'app React se disponibile
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    res.sendFile(path.join(publicDir, 'index.html'));
  } else {
    res.json({ message: 'Server in modalità compatibilità, interfaccia web non disponibile' });
  }
});

// Avvia il server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(\`✅ Server attivo su http://0.0.0.0:\${PORT}\`);
  console.log(\`🌍 Modalità: \${process.env.NODE_ENV || 'development'}\`);
  console.log('⚠️ Avviso: Questo è un server in modalità compatibilità con funzionalità limitate');
});
`;

fs.writeFileSync(path.join(distDir, 'server.js'), serverJs);

// 3. Crea uno script per avviare il server
console.log('📝 Creazione script di avvio...');
const startScript = `#!/bin/bash

# Script per avviare il server in modalità produzione
NODE_ENV=production node dist/server.js
`;

fs.writeFileSync(path.join(projectRoot, 'start-production.sh'), startScript);
execSync('chmod +x start-production.sh');

// 4. Copia i file statici compilati se esistono
console.log('📁 Copia dei file statici...');
const buildDir = path.join(projectRoot, 'dist', 'public');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
  
  // Controlla dove potrebbero essere i file compilati
  const possibleBuildDirs = [
    path.join(projectRoot, 'client', 'dist'),
    path.join(projectRoot, 'dist', 'public'),
    path.join(projectRoot, 'build')
  ];
  
  let foundBuildDir = false;
  
  for (const dir of possibleBuildDirs) {
    if (fs.existsSync(dir)) {
      try {
        console.log(`Copio i file da ${dir}...`);
        // Usa cp -r per copiare i file
        execSync(`cp -r ${dir}/* ${buildDir}`);
        console.log('✅ File statici copiati con successo');
        foundBuildDir = true;
        break;
      } catch (error) {
        console.warn(`⚠️ Errore durante la copia da ${dir}:`, error.message);
      }
    }
  }
  
  if (!foundBuildDir) {
    console.log('⚠️ Nessuna directory di build trovata. Compilazione del frontend...');
    try {
      // Prova a compilare il frontend
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Frontend compilato con successo');
      
      // Controlla di nuovo per i file compilati
      for (const dir of possibleBuildDirs) {
        if (fs.existsSync(dir)) {
          try {
            console.log(`Copio i file da ${dir}...`);
            execSync(`cp -r ${dir}/* ${buildDir}`);
            console.log('✅ File statici copiati con successo');
            break;
          } catch (error) {
            console.warn(`⚠️ Errore durante la copia da ${dir}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Errore durante la compilazione del frontend:', error.message);
    }
  }
}

// 5. Crea un file HTML minimo se non ne è stato trovato uno
if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  console.log('📝 Creazione di un file index.html minimo...');
  const minimalHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server di Gioco - Modalità Compatibilità</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #2c3e50; }
    .card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .info { color: #2980b9; }
    .warning { color: #e67e22; }
    .error { color: #e74c3c; }
    .success { color: #27ae60; }
  </style>
</head>
<body>
  <h1>Server di Gioco - Modalità Compatibilità</h1>
  
  <div class="card">
    <h2>Stato del Server</h2>
    <p class="success">Il server è in esecuzione in modalità compatibilità.</p>
    <p>Questa è una versione semplificata del server che fornisce funzionalità di base.</p>
  </div>
  
  <div class="card">
    <h2>API Disponibili</h2>
    <ul>
      <li><code>/api/health</code> - Verifica lo stato del server</li>
      <li><code>/api/servers</code> - Elenco dei server (modalità compatibilità)</li>
      <li><code>/api/wireguard/status</code> - Stato WireGuard (modalità compatibilità)</li>
    </ul>
  </div>
  
  <div class="card">
    <h2>Informazioni</h2>
    <p class="info">Per ripristinare tutte le funzionalità, è necessario compilare correttamente il progetto TypeScript.</p>
    <p class="warning">Questa è una soluzione temporanea per consentire al server di funzionare in produzione.</p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(buildDir, 'index.html'), minimalHtml);
  console.log('✅ File index.html creato con successo');
}

console.log('\n✅ Correzione completata!');
console.log('\nPer avviare il server in modalità produzione, esegui:');
console.log('./start-production.sh');
console.log('\nQuesto è un server semplificato che permetterà all\'interfaccia web di funzionare.');
console.log('Nota: Questa è una soluzione temporanea. Per ripristinare tutte le funzionalità,');
console.log('sarà necessario completare il processo di build corretto per il progetto TypeScript.');