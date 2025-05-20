# Guida alla Migrazione del Progetto su VPS

Questa guida ti aiuterà a migrare l'applicazione Discord Bot e il pannello di controllo WireGuard sulla tua VPS.

## Prerequisiti

- Una VPS con Ubuntu 22.04 (o versione simile)
- Accesso root o sudo alla VPS
- Un dominio per accedere al pannello web (opzionale ma consigliato)
- Node.js (versione 18+) installato sulla VPS
- PostgreSQL installato sulla VPS
- Git installato sulla VPS

## Passo 1: Preparare l'ambiente sulla VPS

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Node.js 18 se non è già installato
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verifica l'installazione
node -v  # Dovrebbe mostrare v18.x.x
npm -v   # Dovrebbe mostrare 8.x.x o superiore

# Installa PostgreSQL se non è già installato
sudo apt install -y postgresql postgresql-contrib

# Installa Git se non è già installato
sudo apt install -y git
```

## Passo 2: Configurare PostgreSQL

```bash
# Accedi a PostgreSQL
sudo -u postgres psql

# Creare un utente e un database per l'applicazione
CREATE USER wireguardbot WITH PASSWORD 'password_sicura';
CREATE DATABASE wireguardbot;
GRANT ALL PRIVILEGES ON DATABASE wireguardbot TO wireguardbot;

# Esci da PostgreSQL
\q
```

## Passo 3: Clonare il repository

```bash
# Crea una directory per l'applicazione
mkdir -p /opt/wireguardbot
cd /opt/wireguardbot

# Clona il repository dalla tua fonte (GitHub, GitLab, ecc.)
# Se non hai un repository remoto, puoi copiare i file direttamente
git clone https://github.com/tuouser/wireguardbot.git .
# Oppure copia i file usando SCP, SFTP, ecc.
```

## Passo 4: Configurare le variabili d'ambiente

Crea un file `.env` nella directory principale del progetto:

```bash
# Crea e modifica il file .env
nano .env
```

Aggiungi le seguenti variabili, sostituendo i valori con quelli corretti:

```
# Database PostgreSQL
DATABASE_URL=postgresql://wireguardbot:password_sicura@localhost:5432/wireguardbot

# Discord Bot
BOT_TOKEN=il_tuo_token_discord_bot
GUILD_ID=id_del_tuo_server_discord
CLIENT_ID=id_dell_applicazione_discord
ANNOUNCE_CHANNEL_ID=id_del_canale_annunci
LAN_ROLE_ID=id_del_ruolo_lan
SUPPORTER_ROLE_ID=id_del_ruolo_supporter

# WireGuard
WG_SERVER_ENDPOINT=indirizzo_ip_o_dominio_del_tuo_server:51820
WG_SERVER_PUBLIC_KEY=la_chiave_pubblica_del_tuo_server_wireguard
WG_PRIVATE_KEY=la_chiave_privata_del_tuo_server_wireguard

# Pterodactyl (se lo stai utilizzando)
PTERODACTYL_URL=https://panel.tuo-dominio.com
PTERODACTYL_API_KEY=la_tua_api_key_pterodactyl
```

## Passo 5: Installare le dipendenze e configurare il database

```bash
# Installa le dipendenze
npm install

# Esegui la migrazione del database
npm run db:push
```

## Passo 6: Configurare WireGuard sulla VPS

Assicurati che WireGuard sia installato e configurato sulla tua VPS:

```bash
# Installa WireGuard
sudo apt install -y wireguard

# Configura il kernel per l'inoltro dei pacchetti
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Crea una directory per le configurazioni
sudo mkdir -p /etc/wireguard
```

Crea il file di configurazione del server WireGuard:

```bash
sudo nano /etc/wireguard/wg0.conf
```

Aggiungi la configurazione base:

```
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <chiave_privata_del_server>
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# I peer saranno gestiti automaticamente dall'applicazione
```

Nota: sostituisci `eth0` con l'interfaccia di rete principale della tua VPS (potrebbe essere `ens3`, `ens18`, ecc.).

## Passo 7: Configurare un servizio systemd per l'applicazione

Crea un file di servizio systemd:

```bash
sudo nano /etc/systemd/system/wireguardbot.service
```

Aggiungi il seguente contenuto:

```
[Unit]
Description=WireGuard Bot and Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wireguardbot
ExecStart=/usr/bin/node /opt/wireguardbot/server/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Attiva e avvia il servizio:

```bash
# Ricarica systemd
sudo systemctl daemon-reload

# Abilita il servizio per l'avvio automatico
sudo systemctl enable wireguardbot

# Avvia il servizio
sudo systemctl start wireguardbot

# Verifica lo stato
sudo systemctl status wireguardbot
```

## Passo 8: Configurare un reverse proxy (Nginx)

Installa Nginx:

```bash
sudo apt install -y nginx
```

Configura un sito per il pannello di controllo:

```bash
sudo nano /etc/nginx/sites-available/wireguardbot
```

Aggiungi la seguente configurazione:

```
server {
    listen 80;
    server_name tuo-dominio.com www.tuo-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Abilita il sito e riavvia Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/wireguardbot /etc/nginx/sites-enabled/
sudo nginx -t  # Verifica la configurazione
sudo systemctl restart nginx
```

## Passo 9: Configura SSL con Let's Encrypt (opzionale ma consigliato)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tuo-dominio.com -d www.tuo-dominio.com
```

## Passo 10: Monitorare i log dell'applicazione

```bash
# Visualizza i log in tempo reale
sudo journalctl -u wireguardbot -f
```

## Risoluzione dei problemi

### Il bot Discord non si connette

Verifica che il token del bot sia corretto e che il bot sia stato invitato al tuo server Discord con i permessi corretti.

### Errori di connessione al database

Verifica i dettagli di connessione nel file `.env` e assicurati che PostgreSQL sia in esecuzione:

```bash
sudo systemctl status postgresql
```

### Problemi con WireGuard

Verifica lo stato dell'interfaccia WireGuard:

```bash
sudo wg show
```

### Errori nel servizio systemd

Controlla i log del servizio:

```bash
sudo journalctl -u wireguardbot -e
```

## Backup regolari

Configura backup regolari per il database:

```bash
# Installare la utilità di backup postgres
sudo apt install -y postgresql-client

# Creare uno script di backup
nano /opt/wireguardbot/backup.sh
```

Contenuto dello script:

```bash
#!/bin/bash
BACKUP_DIR="/opt/wireguardbot/database_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="wireguardbot_db_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR
pg_dump -U wireguardbot -h localhost wireguardbot > $BACKUP_DIR/$FILENAME
find $BACKUP_DIR -type f -name "wireguardbot_db_*" -mtime +7 -delete
```

Rendi lo script eseguibile:

```bash
chmod +x /opt/wireguardbot/backup.sh
```

Aggiungi un cron job per eseguire il backup automaticamente:

```bash
sudo crontab -e
```

Aggiungi la seguente riga per eseguire il backup ogni giorno alle 2:00:

```
0 2 * * * /opt/wireguardbot/backup.sh
```

## Aggiornamenti futuri

Per aggiornare l'applicazione in futuro:

```bash
cd /opt/wireguardbot
git pull  # Se stai usando git
npm install  # Per aggiornare le dipendenze
npm run db:push  # Per applicare eventuali modifiche al database
sudo systemctl restart wireguardbot  # Riavvia il servizio
```