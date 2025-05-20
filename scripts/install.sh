#!/bin/bash
# Script di installazione per BellionManager
# Questo script installa tutti i componenti necessari e configura il sistema

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variabili di configurazione
INSTALL_DIR="/opt/bellion-manager"
GIT_REPO=""
BRANCH="main"
PORT=3000
DB_NAME="bellionmanager"
USE_EXISTING_DB=false
USE_EXISTING_WG=false
INSTALL_DEPS=true
INSTALL_SERVICE=true
ADMIN_SETUP=true

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

# Funzione per controllare le dipendenze
check_dependencies() {
  print_message "Verifica dipendenze di sistema..."
  
  # Lista delle dipendenze
  DEPS=("curl" "wget" "git" "nodejs" "npm" "postgresql" "wireguard")
  MISSING=()
  
  for dep in "${DEPS[@]}"; do
    if ! command -v $dep &> /dev/null; then
      MISSING+=($dep)
    fi
  done
  
  # Verifica la versione di Node.js
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
      print_warning "La versione di Node.js è inferiore alla 18. È consigliato aggiornare."
      MISSING+=("nodejs>=18")
    fi
  fi
  
  # Se ci sono dipendenze mancanti, chiedere se installarle
  if [ ${#MISSING[@]} -gt 0 ]; then
    print_warning "Le seguenti dipendenze sono mancanti: ${MISSING[*]}"
    
    if [ "$INSTALL_DEPS" = true ]; then
      print_message "Installazione dipendenze in corso..."
      
      # Aggiorna cache apt
      apt-get update
      
      # Installa dipendenze base
      apt-get install -y curl wget git
      
      # Installa Node.js se mancante o obsoleto
      if [[ " ${MISSING[*]} " =~ "nodejs" ]] || [[ " ${MISSING[*]} " =~ "nodejs>=18" ]]; then
        print_message "Installazione Node.js 18.x..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
      fi
      
      # Installa PostgreSQL se mancante
      if [[ " ${MISSING[*]} " =~ "postgresql" ]]; then
        print_message "Installazione PostgreSQL..."
        apt-get install -y postgresql postgresql-contrib
        # Avvia il servizio
        systemctl enable postgresql
        systemctl start postgresql
      fi
      
      # Installa WireGuard se mancante
      if [[ " ${MISSING[*]} " =~ "wireguard" ]]; then
        print_message "Installazione WireGuard..."
        apt-get install -y wireguard
      fi
      
      print_success "Dipendenze installate con successo"
    else
      print_error "Installa queste dipendenze manualmente e poi esegui di nuovo lo script"
      exit 1
    fi
  else
    print_success "Tutte le dipendenze sono soddisfatte"
  fi
}

# Funzione per configurare PostgreSQL
setup_database() {
  print_message "Configurazione database PostgreSQL..."
  
  # Controlla se il database esiste già
  DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")
  
  if [ "$DB_EXISTS" = "1" ]; then
    print_warning "Il database '$DB_NAME' esiste già."
    
    if [ "$USE_EXISTING_DB" = true ]; then
      print_message "Utilizzo del database esistente."
      return 0
    else
      read -p "Vuoi eliminare e ricreare il database? [s/N] " RECREATE_DB
      if [[ "$RECREATE_DB" =~ ^[Ss]$ ]]; then
        print_message "Eliminazione database esistente..."
        sudo -u postgres dropdb "$DB_NAME"
      else
        print_message "Utilizzo del database esistente."
        return 0
      fi
    fi
  fi
  
  # Crea l'utente del database se non esiste
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='bellion'")
  
  if [ "$USER_EXISTS" != "1" ]; then
    print_message "Creazione utente 'bellion'..."
    # Genera password casuale
    DB_PASSWORD=$(openssl rand -hex 12)
    sudo -u postgres psql -c "CREATE USER bellion WITH PASSWORD '$DB_PASSWORD';"
  else
    print_message "L'utente 'bellion' esiste già."
    # Genera password casuale comunque per aggiornare
    DB_PASSWORD=$(openssl rand -hex 12)
    sudo -u postgres psql -c "ALTER USER bellion WITH PASSWORD '$DB_PASSWORD';"
  fi
  
  # Crea il database
  print_message "Creazione database '$DB_NAME'..."
  sudo -u postgres createdb "$DB_NAME" -O bellion
  
  # Concedi i privilegi necessari
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO bellion;"
  
  # Salva le credenziali per dopo
  DB_URL="postgresql://bellion:$DB_PASSWORD@localhost:5432/$DB_NAME"
  
  print_success "Database configurato con successo"
}

# Funzione per configurare WireGuard
setup_wireguard() {
  print_message "Configurazione WireGuard..."
  
  # Controlla se WireGuard è già configurato
  if [ -f "/etc/wireguard/wg0.conf" ] && [ "$USE_EXISTING_WG" = true ]; then
    print_message "Configurazione WireGuard esistente rilevata, utilizzo della configurazione esistente."
    
    # Estrai la chiave pubblica del server
    WG_SERVER_PUBLIC_KEY=$(grep "PublicKey" /etc/wireguard/wg0.conf | cut -d '=' -f 2 | xargs)
    
    # Estrai l'endpoint (indirizzo IP:porta)
    WG_SERVER_ENDPOINT=$(hostname -I | awk '{print $1}')":51820"
    
    print_message "Chiave pubblica server: $WG_SERVER_PUBLIC_KEY"
    print_message "Endpoint server: $WG_SERVER_ENDPOINT"
    
    return 0
  fi
  
  # Genera chiave privata e pubblica per il server
  print_message "Generazione chiavi WireGuard..."
  mkdir -p /etc/wireguard
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
  
  WG_PRIVATE_KEY=$(cat /etc/wireguard/server_private.key)
  WG_SERVER_PUBLIC_KEY=$(cat /etc/wireguard/server_public.key)
  
  # Crea la configurazione del server
  print_message "Creazione configurazione WireGuard..."
  WG_SERVER_ENDPOINT=$(hostname -I | awk '{print $1}')":51820"
  
  cat > /etc/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = $WG_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o $(ip route | grep default | cut -d ' ' -f 5) -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o $(ip route | grep default | cut -d ' ' -f 5) -j MASQUERADE
EOF
  
  # Abilita il forwarding IP
  echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-wireguard.conf
  sysctl -p /etc/sysctl.d/99-wireguard.conf
  
  # Abilita e avvia il servizio
  systemctl enable wg-quick@wg0
  systemctl start wg-quick@wg0
  
  print_success "WireGuard configurato con successo"
}

# Funzione per installare BellionManager
install_bellion() {
  print_message "Installazione BellionManager in corso..."
  
  # Crea la directory di installazione
  mkdir -p "$INSTALL_DIR"
  
  # Clona il repository
  if [ -n "$GIT_REPO" ]; then
    print_message "Clonazione repository da $GIT_REPO..."
    git clone --branch $BRANCH "$GIT_REPO" "$INSTALL_DIR"
    
    if [ $? -ne 0 ]; then
      print_error "Errore durante il cloning del repository."
      exit 1
    fi
  else
    print_error "URL del repository Git non specificato."
    exit 1
  fi
  
  # Entra nella directory di installazione
  cd "$INSTALL_DIR"
  
  # Installa le dipendenze npm
  print_message "Installazione dipendenze Node.js..."
  npm ci --production
  
  # Crea file .env con le configurazioni
  print_message "Creazione file di configurazione..."
  
  cat > "$INSTALL_DIR/.env" << EOF
# Configurazione Server
PORT=$PORT
NODE_ENV=production

# Database
DATABASE_URL=$DB_URL
PGDATABASE=$DB_NAME
PGHOST=localhost
PGPORT=5432
PGUSER=bellion
PGPASSWORD=$DB_PASSWORD

# Autenticazione
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Pterodactyl
PTERODACTYL_URL=
PTERODACTYL_API_KEY=

# WireGuard
WG_SERVER_ENDPOINT=$WG_SERVER_ENDPOINT
WG_SERVER_PUBLIC_KEY=$WG_SERVER_PUBLIC_KEY
WG_PRIVATE_KEY=$WG_PRIVATE_KEY

# Discord Bot
BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_ALERT_CHANNEL_ID=
EOF
  
  # Imposta permessi
  chown -R $(whoami):$(whoami) "$INSTALL_DIR"
  chmod 600 "$INSTALL_DIR/.env"
  
  # Compila il progetto
  print_message "Compilazione del progetto..."
  npm run build
  
  # Applica lo schema del database
  print_message "Inizializzazione database..."
  npm run db:push
  
  print_success "BellionManager installato con successo in $INSTALL_DIR"
}

# Funzione per creare un utente amministratore
create_admin() {
  print_message "Creazione utente amministratore..."
  
  if [ "$ADMIN_SETUP" = true ]; then
    cd "$INSTALL_DIR"
    node scripts/admin-account.js
  else
    print_message "Setup amministratore saltato. Esegui manualmente:"
    print_message "cd $INSTALL_DIR && node scripts/admin-account.js"
  fi
}

# Funzione per installare come servizio systemd
install_service() {
  print_message "Installazione come servizio systemd..."
  
  if [ "$INSTALL_SERVICE" = true ]; then
    # Crea il file di servizio
    cat > /etc/systemd/system/bellion-manager.service << EOF
[Unit]
Description=BellionManager
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    # Ricarica systemd
    systemctl daemon-reload
    
    # Abilita e avvia il servizio
    systemctl enable bellion-manager
    systemctl start bellion-manager
    
    print_success "Servizio bellion-manager installato e avviato"
  else
    print_message "Installazione servizio saltata. Per avviare manualmente:"
    print_message "cd $INSTALL_DIR && npm run start"
  fi
}

# Menu interattivo
show_menu() {
  clear
  echo -e "${BLUE}===== BellionManager - Installazione =====${NC}"
  echo "1. Installa BellionManager"
  echo "2. Configura solo PostgreSQL"
  echo "3. Configura solo WireGuard"
  echo "4. Crea utente amministratore"
  echo "5. Installa come servizio systemd"
  echo "6. Verifica dipendenze"
  echo "7. Esci"
  echo -e "${BLUE}=========================================${NC}"
  
  read -p "Seleziona un'opzione: " option
  
  case $option in
    1)
      check_dependencies
      setup_database
      setup_wireguard
      read -p "Inserisci l'URL del repository Git: " GIT_REPO
      read -p "Inserisci il branch (default: main): " input_branch
      BRANCH=${input_branch:-main}
      install_bellion
      create_admin
      install_service
      
      print_success "Installazione completata!"
      echo "Accedi al pannello web all'indirizzo http://$(hostname -I | awk '{print $1}'):$PORT"
      ;;
    2)
      setup_database
      ;;
    3)
      setup_wireguard
      ;;
    4)
      cd "$INSTALL_DIR" || { print_error "Directory di installazione non trovata"; exit 1; }
      create_admin
      ;;
    5)
      install_service
      ;;
    6)
      check_dependencies
      ;;
    7)
      exit 0
      ;;
    *)
      print_error "Opzione non valida"
      ;;
  esac
  
  read -p "Premi invio per continuare..."
  show_menu
}

# Funzione principale
main() {
  # Analizza gli argomenti della riga di comando
  while [[ $# -gt 0 ]]; do
    case $1 in
      --non-interactive)
        NON_INTERACTIVE=true
        shift
        ;;
      --repo-url=*)
        GIT_REPO="${1#*=}"
        shift
        ;;
      --branch=*)
        BRANCH="${1#*=}"
        shift
        ;;
      --port=*)
        PORT="${1#*=}"
        shift
        ;;
      --db-name=*)
        DB_NAME="${1#*=}"
        shift
        ;;
      --use-existing-db)
        USE_EXISTING_DB=true
        shift
        ;;
      --use-existing-wg)
        USE_EXISTING_WG=true
        shift
        ;;
      --skip-deps)
        INSTALL_DEPS=false
        shift
        ;;
      --skip-service)
        INSTALL_SERVICE=false
        shift
        ;;
      --skip-admin)
        ADMIN_SETUP=false
        shift
        ;;
      --help)
        echo "Utilizzo: $0 [opzioni]"
        echo "Opzioni:"
        echo "  --non-interactive         Esegui in modalità non interattiva"
        echo "  --repo-url=URL            URL del repository Git"
        echo "  --branch=BRANCH           Branch del repository da utilizzare (default: main)"
        echo "  --port=PORT               Porta su cui avviare il server (default: 3000)"
        echo "  --db-name=NAME            Nome del database PostgreSQL (default: bellionmanager)"
        echo "  --use-existing-db         Usa il database esistente se presente"
        echo "  --use-existing-wg         Usa la configurazione WireGuard esistente se presente"
        echo "  --skip-deps               Salta l'installazione delle dipendenze"
        echo "  --skip-service            Salta l'installazione come servizio systemd"
        echo "  --skip-admin              Salta la creazione dell'utente amministratore"
        echo "  --help                    Mostra questo messaggio di aiuto"
        exit 0
        ;;
      *)
        print_error "Opzione non riconosciuta: $1"
        exit 1
        ;;
    esac
  done
  
  # Esegui in modalità interattiva o non interattiva
  if [ "$NON_INTERACTIVE" = true ]; then
    # Verifica che siano specificate le opzioni richieste
    if [ -z "$GIT_REPO" ]; then
      print_error "URL del repository Git non specificato. Usa --repo-url=URL"
      exit 1
    fi
    
    check_dependencies
    setup_database
    setup_wireguard
    install_bellion
    create_admin
    install_service
    
    print_success "Installazione completata!"
    echo "Accedi al pannello web all'indirizzo http://$(hostname -I | awk '{print $1}'):$PORT"
  else
    show_menu
  fi
}

main "$@"
exit 0