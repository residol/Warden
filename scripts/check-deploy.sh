#!/bin/bash
# Script per verificare la correttezza dell'ambiente di produzione
# Da eseguire sulla VPS dopo aver installato i requisiti base

# Colori per l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Verifica dell'ambiente per Server di Gioco su VPS ===${NC}"

# Verifica Node.js
echo -e "\n${YELLOW}Verifica Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js è installato: $NODE_VERSION${NC}"
    
    if [[ "$NODE_VERSION" =~ ^v1[8-9] || "$NODE_VERSION" =~ ^v[2-9][0-9] ]]; then
        echo -e "${GREEN}✓ La versione di Node.js è compatibile${NC}"
    else
        echo -e "${RED}✗ La versione di Node.js dovrebbe essere 18 o superiore${NC}"
    fi
else
    echo -e "${RED}✗ Node.js non è installato${NC}"
fi

# Verifica npm
echo -e "\n${YELLOW}Verifica npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm è installato: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm non è installato${NC}"
fi

# Verifica PostgreSQL
echo -e "\n${YELLOW}Verifica PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    echo -e "${GREEN}✓ PostgreSQL è installato: $PSQL_VERSION${NC}"
    
    # Verifica se il servizio è attivo
    if systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}✓ Il servizio PostgreSQL è attivo${NC}"
    else
        echo -e "${RED}✗ Il servizio PostgreSQL non è attivo${NC}"
    fi
else
    echo -e "${RED}✗ PostgreSQL non è installato${NC}"
fi

# Verifica WireGuard
echo -e "\n${YELLOW}Verifica WireGuard...${NC}"
if command -v wg &> /dev/null; then
    echo -e "${GREEN}✓ WireGuard è installato${NC}"
    
    # Verifica se il modulo del kernel è caricato
    if lsmod | grep -q wireguard; then
        echo -e "${GREEN}✓ Il modulo WireGuard è caricato${NC}"
    else
        echo -e "${RED}✗ Il modulo WireGuard non è caricato${NC}"
    fi
else
    echo -e "${RED}✗ WireGuard non è installato${NC}"
fi

# Verifica DNS e connettività di rete
echo -e "\n${YELLOW}Verifica DNS e connettività di rete...${NC}"
if ping -c 1 -W 2 google.com &> /dev/null; then
    echo -e "${GREEN}✓ La risoluzione DNS e la connettività di rete funzionano${NC}"
else
    echo -e "${RED}✗ Problema con la risoluzione DNS o la connettività di rete${NC}"
fi

# Verifica porte aperte
echo -e "\n${YELLOW}Verifica porte necessarie...${NC}"
PORTS=(22 80 443 51820)
for PORT in "${PORTS[@]}"; do
    if netstat -tuln | grep -q ":$PORT "; then
        echo -e "${GREEN}✓ Porta $PORT è aperta${NC}"
    else
        echo -e "${YELLOW}⚠ Porta $PORT non sembra essere in ascolto${NC}"
    fi
done

# Verifica presenza dei file di progetto
echo -e "\n${YELLOW}Verifica directory del progetto...${NC}"
DIR="/opt/wireguardbot"
if [ -d "$DIR" ]; then
    echo -e "${GREEN}✓ Directory $DIR esiste${NC}"
    
    # Conta i file nella directory
    FILE_COUNT=$(find "$DIR" -type f | wc -l)
    echo -e "${GREEN}  → Contiene $FILE_COUNT file${NC}"
    
    # Verifica file importanti
    IMPORTANT_FILES=(".env" "server/index.js" "shared/schema.ts")
    for FILE in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$DIR/$FILE" ]; then
            echo -e "${GREEN}✓ File $FILE trovato${NC}"
        else
            echo -e "${RED}✗ File $FILE non trovato${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ Directory $DIR non esiste (normale se non hai ancora installato l'app)${NC}"
fi

# Verifica variabili d'ambiente
echo -e "\n${YELLOW}Verifica variabili d'ambiente...${NC}"
ENV_FILE="$DIR/.env"
if [ -f "$ENV_FILE" ]; then
    # Lista delle variabili attese (senza mostrare valori)
    EXPECTED_VARS=("DATABASE_URL" "BOT_TOKEN" "GUILD_ID" "CLIENT_ID" "WG_SERVER_ENDPOINT" "WG_SERVER_PUBLIC_KEY" "WG_PRIVATE_KEY")
    for VAR in "${EXPECTED_VARS[@]}"; do
        if grep -q "^$VAR=" "$ENV_FILE"; then
            echo -e "${GREEN}✓ Variabile $VAR impostata${NC}"
        else
            echo -e "${RED}✗ Variabile $VAR mancante${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ File .env non trovato (normale se non hai ancora installato l'app)${NC}"
fi

# Verifica spazio su disco
echo -e "\n${YELLOW}Verifica spazio su disco...${NC}"
DISK_SPACE=$(df -h / | awk 'NR==2 {print $4}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
echo -e "${GREEN}→ Spazio disponibile: $DISK_SPACE (Utilizzo: $DISK_USAGE)${NC}"

if [[ "${DISK_USAGE/\%/}" -gt 85 ]]; then
    echo -e "${RED}⚠ Lo spazio su disco è quasi esaurito!${NC}"
fi

# Verifica memoria disponibile
echo -e "\n${YELLOW}Verifica memoria disponibile...${NC}"
MEM_TOTAL=$(free -h | awk 'NR==2 {print $2}')
MEM_USED=$(free -h | awk 'NR==2 {print $3}')
MEM_FREE=$(free -h | awk 'NR==2 {print $4}')
echo -e "${GREEN}→ Memoria totale: $MEM_TOTAL (Utilizzata: $MEM_USED, Libera: $MEM_FREE)${NC}"

# Riepilogo e suggerimenti
echo -e "\n${YELLOW}=== Riepilogo e Suggerimenti ===${NC}"
echo -e "1. Assicurati di aver configurato correttamente il file .env"
echo -e "2. Esegui 'npm run db:push' dopo aver installato l'app per creare le tabelle del database"
echo -e "3. Configura il servizio systemd come descritto nella guida di migrazione"
echo -e "4. Verifica i permessi sudo per eseguire comandi WireGuard"
echo -e "5. Configura Nginx come reverse proxy per esporre il pannello web"

echo -e "\n${GREEN}Per testare il bot Discord dopo l'installazione:${NC}"
echo -e "systemctl status wireguardbot    # Verifica lo stato del servizio"
echo -e "journalctl -u wireguardbot -f    # Visualizza i log in tempo reale"

echo -e "\n${YELLOW}Esegui questo script dopo aver seguito i passi di installazione nella guida di migrazione.${NC}"
echo -e "${YELLOW}In caso di problemi, consulta la sezione 'Risoluzione dei problemi' nella guida.${NC}"