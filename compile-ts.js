#!/usr/bin/env node

/**
 * Script per compilare i file TypeScript per la produzione
 * Esegui questo script prima di avviare l'applicazione in produzione
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Directory da compilare
const DIRS_TO_COMPILE = [
  'server/commands',
  'server/services',
  'server/controllers',
  'server/middleware'
];

// Output directory
const OUTPUT_DIR = 'dist';

// Crea la directory di output se non esiste
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔨 Compilazione dei file TypeScript per la produzione...');

// Compila tutti i file TypeScript nelle directory specificate
DIRS_TO_COMPILE.forEach(dir => {
  console.log(`\n📁 Elaborazione directory: ${dir}`);
  
  // Verifica se la directory esiste
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️ La directory ${dir} non esiste, saltata`);
    return;
  }
  
  // Crea la directory di output
  const outDir = path.join(OUTPUT_DIR, path.basename(dir));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  // Leggi i file nella directory
  const files = fs.readdirSync(dir);
  
  // Filtra i file TypeScript
  const tsFiles = files.filter(file => file.endsWith('.ts'));
  
  // Compila ogni file
  tsFiles.forEach(file => {
    const inputFile = path.join(dir, file);
    const baseName = path.basename(file, '.ts');
    const outputFile = path.join(outDir, `${baseName}.js`);
    
    console.log(`  🔄 Compilazione di ${file} in ${outputFile}`);
    
    try {
      execSync(`npx esbuild ${inputFile} --platform=node --packages=external --bundle --format=esm --outfile=${outputFile}`);
      console.log(`  ✅ ${file} compilato con successo`);
    } catch (error) {
      console.error(`  ❌ Errore durante la compilazione di ${file}:`, error.message);
    }
  });
  
  // Crea un file indice per la directory
  const indexFile = path.join(outDir, 'index.js');
  console.log(`  📝 Creazione del file indice: ${indexFile}`);
  
  let indexContent = '// File generato automaticamente\n\n';
  tsFiles.forEach(file => {
    const baseName = path.basename(file, '.ts');
    indexContent += `export * from './${baseName}.js';\n`;
  });
  
  fs.writeFileSync(indexFile, indexContent);
  console.log(`  ✅ File indice creato`);
});

// Crea un file principale per il server
console.log('\n📝 Compilazione del file principale del server...');
try {
  execSync(`npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=${OUTPUT_DIR}`);
  console.log('  ✅ File principale compilato con successo');
} catch (error) {
  console.error('  ❌ Errore durante la compilazione del file principale:', error.message);
}

// Crea un file .env se non esiste
if (!fs.existsSync('.env')) {
  console.log('\n📝 Creazione del file .env di esempio...');
  
  const envContent = `# Configurazione del database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Configurazione JWT
JWT_SECRET=supersecret

# Configurazione Discord
BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_guild_id
CLIENT_ID=your_discord_client_id

# Configurazione WireGuard
WG_SERVER_ENDPOINT=your_server_ip:51820
WG_SERVER_PUBLIC_KEY=your_public_key
WG_PRIVATE_KEY=your_private_key

# Configurazione Pterodactyl
PTERODACTYL_URL=https://your-pterodactyl-panel.com
PTERODACTYL_API_KEY=your_api_key
`;
  
  fs.writeFileSync('.env.example', envContent);
  console.log('  ✅ File .env.example creato');
}

console.log('\n✨ Compilazione completata con successo!');
console.log('Puoi avviare l\'applicazione in produzione con:');
console.log('NODE_ENV=production node dist/index.js');