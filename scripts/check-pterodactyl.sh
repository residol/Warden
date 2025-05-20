#!/bin/bash
# Script per verificare e sistemare l'installazione di Pterodactyl Panel
# Da utilizzare come parte dell'installazione del sistema di gestione server di gioco

# Colori per l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="/var/log/pterodactyl_check.log"

# Funzione per registrare messaggi nel log
log() {
    echo "$(date): $1" | tee -a "$LOG_FILE"
}

# Funzione per mostrare il banner
show_banner() {
    clear
    echo -e "${BLUE}"
    echo -e "██████╗ ████████╗███████╗██████╗  ██████╗ ██████╗  █████╗  ██████╗████████╗██╗   ██╗██╗"
    echo -e "██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔════╝╚══██╔══╝╚██╗ ██╔╝██║"
    echo -e "██████╔╝   ██║   █████╗  ██████╔╝██║   ██║██║  ██║███████║██║        ██║    ╚████╔╝ ██║"
    echo -e "██╔═══╝    ██║   ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║██║        ██║     ╚██╔╝  ██║"
    echo -e "██║        ██║   ███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║╚██████╗   ██║      ██║   ██║"
    echo -e "╚═╝        ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝   ╚═╝      ╚═╝   ╚═╝"
    echo -e "${NC}"
    echo -e "${GREEN}VERIFICA E RIPARAZIONE DI PTERODACTYL PANEL${NC}"
    echo -e "${YELLOW}Questo script verifica e sistema l'installazione di Pterodactyl sulla tua VPS${NC}"
    echo -e ""
}

# Funzione per verificare se Pterodactyl è installato
check_pterodactyl_installed() {
    # Controlla la presenza dei file di Pterodactyl
    if [ -d "/var/www/pterodactyl" ] && [ -f "/var/www/pterodactyl/.env" ]; then
        echo -e "${GREEN}✓ Pterodactyl Panel è installato in /var/www/pterodactyl${NC}"
        log "Pterodactyl Panel è installato in /var/www/pterodactyl"
        return 0
    else
        echo -e "${RED}✗ Pterodactyl Panel non sembra essere installato in /var/www/pterodactyl${NC}"
        log "Pterodactyl Panel non sembra essere installato in /var/www/pterodactyl"
        
        # Cerca in altre posizioni comuni
        FOUND=0
        for DIR in /var/www/* /opt/* /home/*; do
            if [ -f "$DIR/.env" ] && grep -q "APP_NAME=Pterodactyl" "$DIR/.env" 2>/dev/null; then
                FOUND=1
                echo -e "${YELLOW}⚠ Trovata possibile installazione di Pterodactyl in $DIR${NC}"
                log "Trovata possibile installazione di Pterodactyl in $DIR"
                
                echo -e "${YELLOW}Vuoi utilizzare questa installazione? (s/n):${NC}"
                read -n 1 -r
                echo
                if [[ $REPLY =~ ^[Ss]$ ]]; then
                    echo -e "${GREEN}Utilizzerò l'installazione in $DIR${NC}"
                    PANEL_DIR="$DIR"
                    return 0
                fi
            fi
        done
        
        if [ $FOUND -eq 0 ]; then
            echo -e "${RED}Non è stata trovata alcuna installazione di Pterodactyl sul sistema.${NC}"
            log "Non è stata trovata alcuna installazione di Pterodactyl sul sistema."
            
            echo -e "${YELLOW}Vuoi installare Pterodactyl Panel? (s/n):${NC}"
            read -n 1 -r
            echo
            if [[ $REPLY =~ ^[Ss]$ ]]; then
                install_pterodactyl
                return $?
            else
                return 1
            fi
        else
            return 1
        fi
    fi
}

# Funzione per verificare la versione di Pterodactyl
check_pterodactyl_version() {
    PANEL_DIR=${1:-/var/www/pterodactyl}
    
    if [ -f "$PANEL_DIR/config/app.php" ]; then
        VERSION=$(grep -o "'version' => '[0-9.]*'" "$PANEL_DIR/config/app.php" | grep -o "[0-9.]*")
        
        if [ -n "$VERSION" ]; then
            echo -e "${GREEN}✓ Versione di Pterodactyl Panel: $VERSION${NC}"
            log "Versione di Pterodactyl Panel: $VERSION"
            
            # Verifica se è aggiornato (1.11.x è l'ultima al momento)
            if [[ "$VERSION" =~ ^1\.11\. ]]; then
                echo -e "${GREEN}✓ Pterodactyl Panel è aggiornato all'ultima versione${NC}"
                log "Pterodactyl Panel è aggiornato all'ultima versione"
            else
                echo -e "${YELLOW}⚠ Pterodactyl Panel potrebbe non essere aggiornato all'ultima versione${NC}"
                log "Pterodactyl Panel potrebbe non essere aggiornato all'ultima versione"
                
                echo -e "${YELLOW}Vuoi aggiornare Pterodactyl Panel? (s/n):${NC}"
                read -n 1 -r
                echo
                if [[ $REPLY =~ ^[Ss]$ ]]; then
                    update_pterodactyl "$PANEL_DIR"
                    return $?
                fi
            fi
        else
            echo -e "${RED}✗ Impossibile determinare la versione di Pterodactyl Panel${NC}"
            log "Impossibile determinare la versione di Pterodactyl Panel"
            return 1
        fi
    else
        echo -e "${RED}✗ File di configurazione di Pterodactyl Panel non trovato${NC}"
        log "File di configurazione di Pterodactyl Panel non trovato"
        return 1
    fi
    
    return 0
}

# Funzione per verificare i servizi di Pterodactyl
check_pterodactyl_services() {
    # Verifica se il servizio wings è in esecuzione
    if systemctl is-active --quiet wings; then
        echo -e "${GREEN}✓ Servizio Wings è attivo${NC}"
        log "Servizio Wings è attivo"
    else
        echo -e "${RED}✗ Servizio Wings non è attivo${NC}"
        log "Servizio Wings non è attivo"
        
        echo -e "${YELLOW}Vuoi avviare il servizio Wings? (s/n):${NC}"
        read -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            systemctl start wings
            systemctl enable wings
            
            if systemctl is-active --quiet wings; then
                echo -e "${GREEN}✓ Servizio Wings avviato con successo${NC}"
                log "Servizio Wings avviato con successo"
            else
                echo -e "${RED}✗ Impossibile avviare il servizio Wings${NC}"
                log "Impossibile avviare il servizio Wings"
                
                # Verifica i log per capire il problema
                echo -e "${YELLOW}Verifico i log di Wings...${NC}"
                journalctl -u wings -n 20
                
                echo -e "${YELLOW}Vuoi tentare una riparazione del servizio Wings? (s/n):${NC}"
                read -n 1 -r
                echo
                if [[ $REPLY =~ ^[Ss]$ ]]; then
                    repair_wings
                fi
            fi
        fi
    fi
    
    # Verifica se ci sono problemi con il worker di cron per Pterodactyl
    if systemctl is-active --quiet pteroq.service; then
        echo -e "${GREEN}✓ Servizio pteroq è attivo${NC}"
        log "Servizio pteroq è attivo"
    else
        if [ -f "/etc/systemd/system/pteroq.service" ]; then
            echo -e "${RED}✗ Servizio pteroq non è attivo${NC}"
            log "Servizio pteroq non è attivo"
            
            echo -e "${YELLOW}Vuoi avviare il servizio pteroq? (s/n):${NC}"
            read -n 1 -r
            echo
            if [[ $REPLY =~ ^[Ss]$ ]]; then
                systemctl start pteroq
                systemctl enable pteroq
                
                if systemctl is-active --quiet pteroq; then
                    echo -e "${GREEN}✓ Servizio pteroq avviato con successo${NC}"
                    log "Servizio pteroq avviato con successo"
                else
                    echo -e "${RED}✗ Impossibile avviare il servizio pteroq${NC}"
                    log "Impossibile avviare il servizio pteroq"
                fi
            fi
        else
            echo -e "${YELLOW}⚠ Servizio pteroq non trovato. Potrebbe essere configurato come cron job.${NC}"
            log "Servizio pteroq non trovato. Potrebbe essere configurato come cron job."
        fi
    fi
    
    return 0
}

# Funzione per verificare l'API di Pterodactyl
check_pterodactyl_api() {
    PANEL_DIR=${1:-/var/www/pterodactyl}
    
    # Verifica se è possibile ottenere una chiave API
    if [ -f "$PANEL_DIR/.env" ]; then
        # Estrai l'APP_URL dal file .env
        APP_URL=$(grep "^APP_URL=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        
        if [ -n "$APP_URL" ]; then
            echo -e "${GREEN}✓ URL dell'applicazione Pterodactyl: $APP_URL${NC}"
            log "URL dell'applicazione Pterodactyl: $APP_URL"
            
            # Verifica se è possibile raggiungere l'URL
            if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "2[0-9][0-9]\|3[0-9][0-9]"; then
                echo -e "${GREEN}✓ L'URL di Pterodactyl è raggiungibile${NC}"
                log "L'URL di Pterodactyl è raggiungibile"
                
                # Chiedi all'utente di fornire una chiave API esistente
                echo -e "${YELLOW}Hai una chiave API di Pterodactyl? (s/n):${NC}"
                read -n 1 -r
                echo
                if [[ $REPLY =~ ^[Ss]$ ]]; then
                    echo -e "${YELLOW}Inserisci la chiave API di Pterodactyl:${NC}"
                    read -r API_KEY
                    
                    # Tenta una richiesta semplice all'API
                    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                        -H "Authorization: Bearer $API_KEY" \
                        -H "Accept: application/json" \
                        "$APP_URL/api/application/servers")
                    
                    if [[ "$HTTP_CODE" == "200" ]]; then
                        echo -e "${GREEN}✓ La chiave API di Pterodactyl funziona correttamente${NC}"
                        log "La chiave API di Pterodactyl funziona correttamente"
                        
                        # Salva la chiave API per uso futuro
                        API_KEY_CONTENT="PTERODACTYL_API_KEY=$API_KEY"
                        echo -e "${YELLOW}Vuoi salvare questa chiave API nel file .env del programma? (s/n):${NC}"
                        read -n 1 -r
                        echo
                        if [[ $REPLY =~ ^[Ss]$ ]]; then
                            echo -e "${YELLOW}Inserisci il percorso completo al file .env del programma:${NC}"
                            read -r ENV_FILE
                            
                            if [ -f "$ENV_FILE" ]; then
                                # Verifica se la variabile esiste già
                                if grep -q "^PTERODACTYL_API_KEY=" "$ENV_FILE"; then
                                    # Sostituisci la variabile esistente
                                    sed -i "s|^PTERODACTYL_API_KEY=.*|PTERODACTYL_API_KEY=$API_KEY|g" "$ENV_FILE"
                                else
                                    # Aggiungi la variabile in fondo al file
                                    echo "" >> "$ENV_FILE"
                                    echo "# Pterodactyl" >> "$ENV_FILE"
                                    echo "PTERODACTYL_URL=$APP_URL" >> "$ENV_FILE"
                                    echo "PTERODACTYL_API_KEY=$API_KEY" >> "$ENV_FILE"
                                fi
                                
                                echo -e "${GREEN}✓ Chiave API salvata nel file .env${NC}"
                                log "Chiave API salvata nel file .env"
                            else
                                echo -e "${RED}✗ File .env non trovato${NC}"
                                log "File .env non trovato"
                            fi
                        fi
                    else
                        echo -e "${RED}✗ La chiave API di Pterodactyl non funziona (HTTP $HTTP_CODE)${NC}"
                        log "La chiave API di Pterodactyl non funziona (HTTP $HTTP_CODE)"
                        
                        echo -e "${YELLOW}Assicurati di aver creato una chiave API Application con i permessi necessari nel pannello di amministrazione di Pterodactyl.${NC}"
                    fi
                else
                    echo -e "${YELLOW}Per utilizzare l'integrazione con Pterodactyl, dovrai creare una chiave API Application dal pannello di amministrazione.${NC}"
                    echo -e "${YELLOW}Vai su Admin > Application API > Create New e assegna i permessi necessari.${NC}"
                fi
            else
                echo -e "${RED}✗ Impossibile raggiungere l'URL di Pterodactyl${NC}"
                log "Impossibile raggiungere l'URL di Pterodactyl"
                
                echo -e "${YELLOW}Verifica che:${NC}"
                echo -e "${YELLOW}- Il server web sia in esecuzione${NC}"
                echo -e "${YELLOW}- L'URL nel file .env sia corretto${NC}"
                echo -e "${YELLOW}- Non ci siano problemi di firewall o rete${NC}"
            fi
        else
            echo -e "${RED}✗ URL dell'applicazione Pterodactyl non trovato nel file .env${NC}"
            log "URL dell'applicazione Pterodactyl non trovato nel file .env"
        fi
    else
        echo -e "${RED}✗ File .env di Pterodactyl non trovato${NC}"
        log "File .env di Pterodactyl non trovato"
    fi
    
    return 0
}

# Funzione per riparare il servizio Wings
repair_wings() {
    echo -e "${YELLOW}Tentativo di riparazione del servizio Wings...${NC}"
    log "Tentativo di riparazione del servizio Wings..."
    
    # Verifica se il file di configurazione esiste
    if [ ! -f "/etc/pterodactyl/config.yml" ]; then
        echo -e "${RED}✗ File di configurazione di Wings non trovato${NC}"
        log "File di configurazione di Wings non trovato"
        
        # Chiedi all'utente se vuole reinstallare Wings
        echo -e "${YELLOW}Vuoi reinstallare Wings? (s/n):${NC}"
        read -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            # Reinstalla Wings
            bash <(curl -s https://pterodactyl-installer.se) --wings
            
            if systemctl is-active --quiet wings; then
                echo -e "${GREEN}✓ Wings reinstallato con successo${NC}"
                log "Wings reinstallato con successo"
            else
                echo -e "${RED}✗ Impossibile reinstallare Wings${NC}"
                log "Impossibile reinstallare Wings"
            fi
        fi
        
        return 1
    fi
    
    # Riavvia il servizio
    systemctl restart wings
    
    # Verifica se il servizio è stato avviato correttamente
    if systemctl is-active --quiet wings; then
        echo -e "${GREEN}✓ Servizio Wings riparato con successo${NC}"
        log "Servizio Wings riparato con successo"
        return 0
    else
        echo -e "${RED}✗ Impossibile riparare il servizio Wings${NC}"
        log "Impossibile riparare il servizio Wings"
        
        # Verifica se ci sono problemi con Docker
        if ! systemctl is-active --quiet docker; then
            echo -e "${RED}✗ Il servizio Docker non è attivo, necessario per Wings${NC}"
            log "Il servizio Docker non è attivo, necessario per Wings"
            
            # Avvia Docker
            systemctl start docker
            systemctl enable docker
            
            # Riavvia Wings
            systemctl restart wings
            
            if systemctl is-active --quiet wings; then
                echo -e "${GREEN}✓ Servizio Wings riparato con successo dopo l'avvio di Docker${NC}"
                log "Servizio Wings riparato con successo dopo l'avvio di Docker"
                return 0
            fi
        fi
        
        # Verifica se ci sono problemi con i permessi
        if [ -f "/etc/pterodactyl/config.yml" ]; then
            # Correggi i permessi
            chown -R root:root /etc/pterodactyl
            chmod 755 /etc/pterodactyl
            chmod 600 /etc/pterodactyl/config.yml
            
            # Riavvia Wings
            systemctl restart wings
            
            if systemctl is-active --quiet wings; then
                echo -e "${GREEN}✓ Servizio Wings riparato con successo dopo la correzione dei permessi${NC}"
                log "Servizio Wings riparato con successo dopo la correzione dei permessi"
                return 0
            fi
        fi
        
        return 1
    fi
}

# Funzione per installare Pterodactyl Panel
install_pterodactyl() {
    echo -e "${YELLOW}Questa funzione installerà Pterodactyl Panel sul tuo sistema.${NC}"
    log "Avvio dell'installazione di Pterodactyl Panel"
    
    # Chiedi all'utente se vuole utilizzare l'installer ufficiale
    echo -e "${YELLOW}Vuoi utilizzare l'installer ufficiale di Pterodactyl? (s/n):${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Usa l'installer ufficiale
        bash <(curl -s https://pterodactyl-installer.se)
        
        # Verifica se l'installazione è andata a buon fine
        if [ -d "/var/www/pterodactyl" ] && [ -f "/var/www/pterodactyl/.env" ]; then
            echo -e "${GREEN}✓ Pterodactyl Panel installato con successo${NC}"
            log "Pterodactyl Panel installato con successo"
            return 0
        else
            echo -e "${RED}✗ Installazione di Pterodactyl Panel fallita${NC}"
            log "Installazione di Pterodactyl Panel fallita"
            return 1
        fi
    else
        echo -e "${YELLOW}Installazione manuale non supportata da questo script.${NC}"
        log "Installazione manuale non supportata da questo script"
        
        echo -e "${YELLOW}Visita la documentazione ufficiale per istruzioni dettagliate:${NC}"
        echo -e "${BLUE}https://pterodactyl.io/panel/1.0/getting_started.html${NC}"
        
        return 1
    fi
}

# Funzione per aggiornare Pterodactyl Panel
update_pterodactyl() {
    PANEL_DIR=${1:-/var/www/pterodactyl}
    echo -e "${YELLOW}Aggiornamento di Pterodactyl Panel in corso...${NC}"
    log "Aggiornamento di Pterodactyl Panel in corso..."
    
    # Backup del database
    echo -e "${YELLOW}Creazione backup del database...${NC}"
    
    # Estrai le credenziali del database
    if [ -f "$PANEL_DIR/.env" ]; then
        DB_HOST=$(grep "^DB_HOST=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        DB_PORT=$(grep "^DB_PORT=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        DB_DATABASE=$(grep "^DB_DATABASE=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        DB_USERNAME=$(grep "^DB_USERNAME=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        DB_PASSWORD=$(grep "^DB_PASSWORD=" "$PANEL_DIR/.env" | cut -d '=' -f2-)
        
        # Crea directory per il backup
        BACKUP_DIR="$PANEL_DIR/backups"
        mkdir -p "$BACKUP_DIR"
        
        # Crea il backup
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" > "$BACKUP_DIR/pterodactyl_$TIMESTAMP.sql"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Backup del database creato con successo: $BACKUP_DIR/pterodactyl_$TIMESTAMP.sql${NC}"
            log "Backup del database creato con successo: $BACKUP_DIR/pterodactyl_$TIMESTAMP.sql"
        else
            echo -e "${RED}✗ Impossibile creare il backup del database${NC}"
            log "Impossibile creare il backup del database"
            
            echo -e "${YELLOW}Vuoi continuare comunque con l'aggiornamento? (s/n):${NC}"
            read -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Ss]$ ]]; then
                echo -e "${YELLOW}Aggiornamento annullato${NC}"
                log "Aggiornamento annullato"
                return 1
            fi
        fi
    else
        echo -e "${RED}✗ File .env non trovato, impossibile eseguire il backup del database${NC}"
        log "File .env non trovato, impossibile eseguire il backup del database"
        
        echo -e "${YELLOW}Vuoi continuare comunque con l'aggiornamento? (s/n):${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            echo -e "${YELLOW}Aggiornamento annullato${NC}"
            log "Aggiornamento annullato"
            return 1
        fi
    fi
    
    # Aggiornamento con l'installer ufficiale
    echo -e "${YELLOW}Utilizzo dell'installer ufficiale per l'aggiornamento...${NC}"
    log "Utilizzo dell'installer ufficiale per l'aggiornamento"
    
    bash <(curl -s https://pterodactyl-installer.se) --panel-update
    
    # Verifica se l'aggiornamento è andato a buon fine
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Pterodactyl Panel aggiornato con successo${NC}"
        log "Pterodactyl Panel aggiornato con successo"
        
        # Verifica la nuova versione
        if [ -f "$PANEL_DIR/config/app.php" ]; then
            VERSION=$(grep -o "'version' => '[0-9.]*'" "$PANEL_DIR/config/app.php" | grep -o "[0-9.]*")
            echo -e "${GREEN}✓ Nuova versione di Pterodactyl Panel: $VERSION${NC}"
            log "Nuova versione di Pterodactyl Panel: $VERSION"
        fi
        
        return 0
    else
        echo -e "${RED}✗ Aggiornamento di Pterodactyl Panel fallito${NC}"
        log "Aggiornamento di Pterodactyl Panel fallito"
        return 1
    fi
}

# Funzione principale
main() {
    # Crea il file di log
    touch "$LOG_FILE"
    chmod 640 "$LOG_FILE"
    
    # Mostra il banner
    show_banner
    
    # Verifica i privilegi di root
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${RED}Questo script deve essere eseguito come root!${NC}"
        exit 1
    fi
    
    # Verifica se Pterodactyl è installato
    if check_pterodactyl_installed; then
        # Directory di Pterodactyl
        PANEL_DIR=${PANEL_DIR:-/var/www/pterodactyl}
        
        # Verifica la versione
        check_pterodactyl_version "$PANEL_DIR"
        
        # Verifica i servizi
        check_pterodactyl_services
        
        # Verifica l'API
        check_pterodactyl_api "$PANEL_DIR"
        
        echo -e "\n${GREEN}Verifiche complete! Pterodactyl Panel è configurato correttamente.${NC}"
        log "Verifiche complete! Pterodactyl Panel è configurato correttamente."
    else
        echo -e "\n${YELLOW}Pterodactyl Panel non è installato o non è stato possibile verificarlo.${NC}"
        log "Pterodactyl Panel non è installato o non è stato possibile verificarlo."
    fi
    
    echo -e "\n${BLUE}=== Fine della verifica di Pterodactyl Panel ===${NC}"
}

# Esegui la funzione principale
main