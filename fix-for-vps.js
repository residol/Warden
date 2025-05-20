const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Iniziando la correzione per la VPS...');

// Definisci la directory del progetto
const projectRoot = process.cwd();

// 1. Crea la directory dist se non esiste
console.log('📁 Creazione directory dist...');
const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Crea un file package.json con type: commonjs nella directory dist
console.log('📝 Creazione package.json nella directory dist...');
const packageJson = {
  "name": "bellion-manager-prod",
  "version": "1.0.0",
  "type": "commonjs",
  "private": true
};
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// 3. Crea un file server.js minimale che funzionerà in produzione
console.log('📝 Creazione server.js minimale...');
const serverJs = `
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Carica le variabili d'ambiente se è disponibile dotenv
try {
  require('dotenv').config();
} catch (err) {
  console.log('dotenv non disponibile, uso le variabili d\'ambiente del sistema');
}

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
const wss = new WebSocket.Server({ 
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

// 4. Crea uno script per avviare il server
console.log('📝 Creazione script di avvio...');
const startScript = `#!/bin/bash

# Script per avviare il server in modalità produzione
NODE_ENV=production node dist/server.js
`;

fs.writeFileSync(path.join(projectRoot, 'start-production.sh'), startScript);
execSync('chmod +x start-production.sh');

// 5. Copia i file statici compilati se esistono
console.log('📁 Copia dei file statici...');
const buildDir = path.join(projectRoot, 'dist', 'public');
if (!fs.existsSync(buildDir) && fs.existsSync(path.join(projectRoot, 'client', 'dist'))) {
  fs.mkdirSync(buildDir, { recursive: true });
  
  // Copia il contenuto della directory client/dist in dist/public
  try {
    execSync(`cp -r ${path.join(projectRoot, 'client', 'dist')}/* ${buildDir}`);
    console.log('✅ File statici copiati con successo');
  } catch (error) {
    console.warn('⚠️ Errore durante la copia dei file statici:', error.message);
  }
}

console.log('\n✅ Correzione completata!');
console.log('\nPer avviare il server in modalità produzione, esegui:');
console.log('./start-production.sh');
console.log('\nQuesto è un server semplificato che permetterà all\'interfaccia web di funzionare.');
console.log('Nota: Questa è una soluzione temporanea. Per ripristinare tutte le funzionalità,');
console.log('sarà necessario completare il processo di build corretto per il progetto TypeScript.');