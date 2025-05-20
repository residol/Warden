#!/usr/bin/env node

/**
 * Script per compilare i comandi Discord da TypeScript a JavaScript
 * Questo script viene eseguito durante il processo di build per assicurarsi che
 * i comandi .ts vengano compilati correttamente prima dell'esecuzione in produzione
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Compilo i comandi Discord da TypeScript a JavaScript...');

// Directory dei comandi
const COMMANDS_DIR = path.join(__dirname, '..', 'server', 'commands');
const DIST_COMMANDS_DIR = path.join(__dirname, '..', 'dist', 'commands');

// Crea la directory di destinazione se non esiste
if (!fs.existsSync(DIST_COMMANDS_DIR)) {
  fs.mkdirSync(DIST_COMMANDS_DIR, { recursive: true });
}

// Funzione per compilare un file TypeScript
function compileTypeScript(filePath, outputPath) {
  try {
    console.log(`Compilazione di ${path.basename(filePath)}...`);
    
    // Usa esbuild per compilare il file
    execSync(`npx esbuild ${filePath} --platform=node --packages=external --bundle --format=esm --outfile=${outputPath}`);
    
    console.log(`✅ Compilato ${path.basename(filePath)} -> ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore durante la compilazione di ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

// Funzione per processare una directory ricorsivamente
function processDirectory(directory, outputDir) {
  // Controlla se la directory esiste
  if (!fs.existsSync(directory)) {
    console.warn(`⚠️ La directory ${directory} non esiste`);
    return;
  }

  // Crea la directory di output se non esiste
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Leggi il contenuto della directory
  const files = fs.readdirSync(directory);

  // Processa ogni file
  let successCount = 0;
  let errorCount = 0;

  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Se è una directory, processa ricorsivamente
      const subOutputDir = path.join(outputDir, file);
      processDirectory(filePath, subOutputDir);
    } else if (file.endsWith('.ts')) {
      // Se è un file TypeScript, compilalo
      const outputFile = path.join(outputDir, file.replace('.ts', '.js'));
      const success = compileTypeScript(filePath, outputFile);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    } else if (file.endsWith('.js')) {
      // Se è già un file JavaScript, copialo
      const outputFile = path.join(outputDir, file);
      fs.copyFileSync(filePath, outputFile);
      console.log(`📄 Copiato ${file}`);
      successCount++;
    }
  });

  console.log(`\nDirectory ${path.basename(directory)}:`);
  console.log(`✅ File compilati/copiati con successo: ${successCount}`);
  if (errorCount > 0) {
    console.log(`❌ File con errori: ${errorCount}`);
  }
}

// Avvia la compilazione dei comandi
console.log(`📁 Elaborazione dei comandi dalla directory: ${COMMANDS_DIR}`);
processDirectory(COMMANDS_DIR, DIST_COMMANDS_DIR);

// Crea un file index.js che esporta tutti i comandi
const commandFiles = fs.readdirSync(DIST_COMMANDS_DIR)
  .filter(file => file.endsWith('.js'));

let indexContent = `// File generato automaticamente dallo script build-commands.js\n\n`;
indexContent += `// Importa tutti i comandi\n`;

commandFiles.forEach(file => {
  const commandName = file.replace('.js', '');
  indexContent += `export * from './${commandName}.js';\n`;
});

fs.writeFileSync(path.join(DIST_COMMANDS_DIR, 'index.js'), indexContent);
console.log(`📝 Creato file index.js per esportare tutti i comandi`);

console.log('\n✨ Compilazione dei comandi completata!');