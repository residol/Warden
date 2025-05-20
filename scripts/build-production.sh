#!/bin/bash

# Script per compilare correttamente il progetto per produzione
# Risolve il problema con i file TypeScript (.ts) in produzione

echo "🚀 Avvio del processo di build per produzione..."

# 1. Compila il frontend con Vite
echo "🌐 Compilazione del frontend con Vite..."
npx vite build

# 2. Crea directory per i comandi compilati
echo "📁 Preparazione delle directory per i comandi..."
mkdir -p dist/commands

# 3. Compila i comandi Discord da TypeScript a JavaScript
echo "🤖 Compilazione dei comandi Discord..."
COMMANDS_DIR="server/commands"
for command_file in $COMMANDS_DIR/*.ts; do
  if [ -f "$command_file" ]; then
    filename=$(basename -- "$command_file")
    filename_no_ext="${filename%.ts}"
    output_file="dist/commands/${filename_no_ext}.js"
    
    echo "  🔨 Compilazione di $filename..."
    npx esbuild "$command_file" --platform=node --packages=external --bundle --format=esm --outfile="$output_file"
  fi
done

# 4. Crea un file indice per i comandi
echo "📝 Creazione dell'indice dei comandi..."
COMMANDS_INDEX="dist/commands/index.js"
echo "// File generato automaticamente da build-production.sh" > $COMMANDS_INDEX
echo "" >> $COMMANDS_INDEX
echo "// Importa ed esporta tutti i comandi" >> $COMMANDS_INDEX

for command_file in dist/commands/*.js; do
  if [ -f "$command_file" ] && [ "$(basename -- "$command_file")" != "index.js" ]; then
    command_name=$(basename -- "$command_file" .js)
    echo "export * from './${command_name}.js';" >> $COMMANDS_INDEX
  fi
done

# 5. Aggiungi un redirector per i comandi nel server
echo "🔄 Aggiunta del redirector per i comandi..."
REDIRECTOR_FILE="server/commands-prod.js"
echo "// File generato automaticamente da build-production.sh" > $REDIRECTOR_FILE
echo "// Questo file serve da redirector per i comandi in produzione" >> $REDIRECTOR_FILE
echo "" >> $REDIRECTOR_FILE
echo "export * from '../dist/commands/index.js';" >> $REDIRECTOR_FILE

# 6. Modifica temporaneamente il file del bot Discord per utilizzare i comandi compilati
echo "🔧 Modifica dei riferimenti ai comandi nel bot Discord..."
BOT_FILE="server/discord-bot.ts"
BOT_BACKUP="server/discord-bot.ts.bak"

# Crea backup
cp "$BOT_FILE" "$BOT_BACKUP"

# Sostituisci l'importazione dei comandi per la produzione
if grep -q "import.*from './commands/" "$BOT_FILE"; then
  sed -i "s|import.*from './commands/|import * as commands from './commands-prod.js'; // Modificato per produzione: |g" "$BOT_FILE"
fi

# 7. Compila il server
echo "🖥️ Compilazione del server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# 8. Ripristina il file originale del bot
echo "♻️ Ripristino dei file originali..."
mv "$BOT_BACKUP" "$BOT_FILE"

echo "✅ Build completata con successo!"
echo "Per avviare l'applicazione in modalità produzione, esegui: NODE_ENV=production node dist/index.js"