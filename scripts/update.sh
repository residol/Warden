#!/bin/bash
# Script di aggiornamento per BellionManager
# Questo script aggiorna il sistema senza una completa reinstallazione

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per mostrare messaggi
print_message() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESSO]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[ATTENZIONE]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERRORE]${NC} $1"
}

# Verifica se il processo è in esecuzione come root
if [ "$EUID" -ne 0 ]; then
  print_error "Questo script deve essere eseguito come root"
  exit 1
fi

# Directory dell'installazione
INSTALL_DIR="/opt/bellion-manager"
BACKUP_DIR="${INSTALL_DIR}/backups/$(date +%Y%m%d%H%M%S)"
TEMP_DIR="/tmp/bellion-update"

# Verifica se il sistema è già installato
if [ ! -d "$INSTALL_DIR" ]; then
  print_error "BellionManager non sembra essere installato in $INSTALL_DIR"
  exit 1
fi

# Verifica se PM2 è installato
if ! command -v pm2 &> /dev/null; then
  print_error "PM2 non è installato. Impossibile gestire i processi."
  exit 1
fi

# Funzione per eseguire backup
backup_system() {
  print_message "Creazione backup dell'installazione corrente..."
  
  # Crea directory di backup
  mkdir -p "$BACKUP_DIR"
  
  # Backup configurazioni
  if [ -f "${INSTALL_DIR}/.env" ]; then
    cp "${INSTALL_DIR}/.env" "${BACKUP_DIR}/"
    print_message "File .env salvato"
  fi
  
  # Backup database (se PostgreSQL è in esecuzione)
  if command -v pg_dump &> /dev/null && pg_isready -q; then
    print_message "Esecuzione backup del database..."
    
    # Estrai parametri di connessione dal file .env se esiste
    if [ -f "${INSTALL_DIR}/.env" ]; then
      source <(grep -E "^(PGDATABASE|PGUSER|PGPASSWORD|PGHOST|PGPORT)=" "${INSTALL_DIR}/.env" | sed 's/^/export /')
    fi
    
    # Esegui il backup
    if [ ! -z "$PGDATABASE" ] && [ ! -z "$PGUSER" ]; then
      PGPASSWORD="$PGPASSWORD" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" -F c -f "${BACKUP_DIR}/database.dump"
      if [ $? -eq 0 ]; then
        print_success "Backup del database completato"
      else
        print_error "Errore durante il backup del database"
      fi
    else
      print_warning "Parametri database mancanti, backup database saltato"
    fi
  else
    print_warning "PostgreSQL non disponibile, backup database saltato"
  fi
  
  # Backup configurazione WireGuard se presente
  if [ -d "/etc/wireguard" ]; then
    cp -r /etc/wireguard "${BACKUP_DIR}/wireguard"
    print_message "Configurazioni WireGuard salvate"
  fi
  
  # Backup file personalizzati (escludendo node_modules e altri file temporanei)
  rsync -av --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.log' "${INSTALL_DIR}/" "${BACKUP_DIR}/app/"
  
  print_success "Backup completato in $BACKUP_DIR"
}

# Funzione per aggiornare il codice
update_code() {
  print_message "Aggiornamento codice sorgente..."
  
  # Crea directory temporanea
  mkdir -p "$TEMP_DIR"
  cd "$TEMP_DIR"
  
  # Controlla se è stato specificato un repository
  if [ -z "$REPO_URL" ]; then
    read -p "Inserisci l'URL del repository (lascia vuoto per utilizzare il pacchetto locale): " REPO_URL
  fi
  
  if [ -n "$REPO_URL" ]; then
    # Scarica dal repository
    print_message "Clonazione repository da $REPO_URL..."
    git clone "$REPO_URL" .
    if [ $? -ne 0 ]; then
      print_error "Errore durante il download del codice sorgente"
      return 1
    fi
  else
    # Controlla se è stato specificato un pacchetto
    if [ -z "$PACKAGE_PATH" ]; then
      read -p "Inserisci il percorso del pacchetto di aggiornamento: " PACKAGE_PATH
    fi
    
    if [ -z "$PACKAGE_PATH" ] || [ ! -f "$PACKAGE_PATH" ]; then
      print_error "Pacchetto di aggiornamento non valido"
      return 1
    fi
    
    # Estrai il pacchetto
    print_message "Estrazione pacchetto di aggiornamento..."
    
    # Determina il tipo di pacchetto
    if [[ "$PACKAGE_PATH" == *.zip ]]; then
      unzip "$PACKAGE_PATH" -d .
    elif [[ "$PACKAGE_PATH" == *.tar.gz ]] || [[ "$PACKAGE_PATH" == *.tgz ]]; then
      tar -xzf "$PACKAGE_PATH" -C .
    else
      print_error "Formato pacchetto non supportato. Utilizza .zip o .tar.gz"
      return 1
    fi
  fi
  
  # Ferma i servizi
  print_message "Arresto servizi in corso..."
  pm2 stop all
  
  # Preserva file di configurazione
  if [ -f "${INSTALL_DIR}/.env" ]; then
    cp "${INSTALL_DIR}/.env" .
    print_message "File di configurazione .env preservato"
  fi
  
  # Copia i nuovi file (escludendo configurazioni e altri file da preservare)
  print_message "Installazione nuovi file..."
  rsync -av --exclude='.env' --exclude='config.json' --exclude='wg-config' --exclude='data' --exclude='backups' ./ "${INSTALL_DIR}/"
  
  # Aggiorna le dipendenze
  print_message "Aggiornamento dipendenze..."
  cd "$INSTALL_DIR"
  npm ci --production
  
  print_success "Codice aggiornato con successo"
  return 0
}

# Funzione per applicare migrazioni del database
apply_migrations() {
  print_message "Applicazione migrazioni database..."
  
  cd "$INSTALL_DIR"
  
  # Verifica se esiste uno script di migrazione
  if [ -f "npm run db:migrate" ] || grep -q "\"db:migrate\":" package.json; then
    npm run db:migrate
    if [ $? -eq 0 ]; then
      print_success "Migrazioni database applicate con successo"
    else
      print_error "Errore durante l'applicazione delle migrazioni"
      return 1
    fi
  else
    # Prova con metodi alternativi
    if [ -f "npm run db:push" ] || grep -q "\"db:push\":" package.json; then
      npm run db:push
      if [ $? -eq 0 ]; then
        print_success "Schema database aggiornato con successo"
      else
        print_error "Errore durante l'aggiornamento dello schema database"
        return 1
      fi
    else
      print_warning "Nessuno script di migrazione trovato, database non aggiornato"
    fi
  fi
  
  return 0
}

# Funzione per riavviare i servizi
restart_services() {
  print_message "Riavvio servizi in corso..."
  
  cd "$INSTALL_DIR"
  
  # Pulisci la cache di PM2
  pm2 flush
  
  # Riavvia tutte le applicazioni
  pm2 restart all
  
  # Assicura che PM2 si avvii al boot
  pm2 save
  
  print_success "Servizi riavviati con successo"
}

# Funzione per aggiungere un utente admin
add_admin_user() {
  print_message "Creazione di un nuovo utente amministratore..."
  
  read -p "Username: " ADMIN_USERNAME
  read -s -p "Password: " ADMIN_PASSWORD
  echo
  read -p "Email: " ADMIN_EMAIL
  
  # Verifica che i campi siano stati inseriti
  if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$ADMIN_EMAIL" ]; then
    print_error "Tutti i campi sono obbligatori"
    return 1
  fi
  
  cd "$INSTALL_DIR"
  
  # Crea uno script JavaScript temporaneo per aggiungere l'utente
  cat > /tmp/create-admin.js << EOF
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Cripta la password
    const hashedPassword = await bcrypt.hash('${ADMIN_PASSWORD}', 10);
    
    // Verifica se l'utente esiste già
    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', ['${ADMIN_USERNAME}', '${ADMIN_EMAIL}']);
    
    if (checkResult.rows.length > 0) {
      console.error('Utente o email già esistente');
      return;
    }
    
    // Crea l'utente
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role, is_verified, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      ['${ADMIN_USERNAME}', '${ADMIN_EMAIL}', hashedPassword, 'admin', true]
    );
    
    console.log('Utente amministratore creato con successo. ID:', result.rows[0].id);
  } catch (error) {
    console.error('Errore durante la creazione dell\'utente:', error);
  } finally {
    await pool.end();
  }
}

createAdminUser();
EOF
  
  # Esegui lo script
  node /tmp/create-admin.js
  
  # Rimuovi lo script temporaneo
  rm /tmp/create-admin.js
  
  print_success "Processo di creazione utente completato"
}

# Funzione per verifica e test
verify_installation() {
  print_message "Verifica dell'installazione in corso..."
  
  # Verifica servizi in esecuzione
  pm2 list
  
  # Verifica connessione al database
  if [ -f "${INSTALL_DIR}/.env" ]; then
    source <(grep -E "^(PGDATABASE|PGUSER|PGPASSWORD|PGHOST|PGPORT)=" "${INSTALL_DIR}/.env" | sed 's/^/export /')
    
    if command -v pg_isready &> /dev/null; then
      PGPASSWORD="$PGPASSWORD" pg_isready -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE"
      if [ $? -eq 0 ]; then
        print_success "Connessione al database verificata"
      else
        print_error "Impossibile connettersi al database"
      fi
    fi
  fi
  
  # Verifica stato Pterodactyl
  if [ -f "${INSTALL_DIR}/.env" ] && grep -q "PTERODACTYL_URL" "${INSTALL_DIR}/.env"; then
    source <(grep -E "^PTERODACTYL_URL=" "${INSTALL_DIR}/.env" | sed 's/^/export /')
    
    if command -v curl &> /dev/null; then
      curl -s --head "$PTERODACTYL_URL" | head -1
    fi
  fi
  
  # Verifica stato WireGuard
  if command -v wg &> /dev/null; then
    wg show
  fi
  
  print_message "Verifica completata. Controlla eventuali errori sopra."
}

# Menu principale
main_menu() {
  clear
  echo -e "${BLUE}===== BellionManager - Script di Aggiornamento =====${NC}"
  echo "1. Esegui aggiornamento completo (backup, aggiorna, migra, riavvia)"
  echo "2. Esegui solo backup"
  echo "3. Aggiorna solo codice"
  echo "4. Applica solo migrazioni database"
  echo "5. Riavvia servizi"
  echo "6. Aggiungi utente amministratore"
  echo "7. Verifica installazione"
  echo "8. Esci"
  echo -e "${BLUE}=================================================${NC}"
  
  read -p "Seleziona un'opzione: " option
  
  case $option in
    1)
      backup_system
      update_code
      apply_migrations
      restart_services
      verify_installation
      ;;
    2)
      backup_system
      ;;
    3)
      update_code
      ;;
    4)
      apply_migrations
      ;;
    5)
      restart_services
      ;;
    6)
      add_admin_user
      ;;
    7)
      verify_installation
      ;;
    8)
      exit 0
      ;;
    *)
      print_error "Opzione non valida"
      ;;
  esac
  
  read -p "Premi invio per continuare..."
  main_menu
}

# Esecuzione del menu principale o funzioni specifiche
if [ "$1" == "--non-interactive" ]; then
  # Modalità non interattiva per script automatizzati
  backup_system
  update_code
  apply_migrations
  restart_services
else
  main_menu
fi

exit 0