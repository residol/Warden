// Script di correzione rapida per i problemi di produzione
// Usa sintassi ES module per compatibilità con Node.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Ottieni il percorso attuale
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

console.log('🔧 Avvio correzione rapida per produzione...');

// 1. Crea una cartella dist/commands se non esiste
console.log('📁 Creazione delle directory necessarie...');
const distCommandsDir = path.join(projectRoot, 'dist', 'commands');
if (!fs.existsSync(distCommandsDir)) {
  fs.mkdirSync(distCommandsDir, { recursive: true });
}

// 2. Crea un file di stub per i comandi
console.log('📝 Creazione del file di stub per i comandi...');
const commandsStub = `
// File generato automaticamente da quick-fix.js
// Questo fornisce stub per i comandi in produzione

// Esporta una funzione falsa per ogni comando
export function loadCommands() {
  console.log("Caricamento comandi in modalità compatibilità");
  return new Map();
}

export function registerCommands() {
  console.log("Registrazione comandi in modalità compatibilità");
  return true;
}
`;

fs.writeFileSync(path.join(distCommandsDir, 'index.js'), commandsStub);
console.log('✅ File di stub per i comandi creato con successo');

// 3. Crea un file index.js principale nella cartella dist
console.log('📝 Creazione del file index.js principale...');
const mainIndex = `
// File generato automaticamente da quick-fix.js
// Questo è un file index minimo per avviare il server in produzione

import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';

// Carica le variabili d'ambiente
dotenv.config();

// Imposta il percorso del file attuale
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crea l'app Express
const app = express();
app.use(express.json());

// Servi i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Crea il server HTTP
const httpServer = http.createServer(app);

// Configura WebSocket sul percorso /ws
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected to /ws');
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected from /ws');
  });
});

// Configura le API
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', version: '1.0.0' });
});

// Gestisci tutte le altre richieste inviando l'app React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvia il server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server avviato sulla porta \${PORT}\`);
  console.log(\`Modalità: \${process.env.NODE_ENV || 'development'}\`);
});
`;

fs.writeFileSync(path.join(projectRoot, 'dist', 'index.js'), mainIndex);
console.log('✅ File index.js principale creato con successo');

// 4. Mostra le istruzioni finali
console.log('\n✅ Correzione rapida completata!');
console.log('\nPer avviare l\'applicazione in modalità produzione, esegui:');
console.log('NODE_ENV=production node dist/index.js');
console.log('\nQuesta è una soluzione temporanea. Per una soluzione completa, bisogna ritornare al codice sorgente e correggere l\'utilizzo di TypeScript in produzione.');