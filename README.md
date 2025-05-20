# BellionManager

## Descrizione
BellionManager è un sistema completo per la gestione di server di gioco con integrazione Pterodactyl, gestione rete WireGuard, e un'interfaccia Discord. Il sistema offre un pannello web per amministratori e strumenti di monitoraggio avanzati.

## Caratteristiche Principali

- **Gestione Server di Gioco**
  - Integrazione con Pterodactyl per gestire server Minecraft e altri giochi
  - Avvio, arresto e riavvio remoto dei server
  - Monitoraggio risorse in tempo reale (CPU, RAM, Disco)

- **Rete WireGuard Integrata**
  - Gestione completa degli accessi VPN
  - Creazione automatica di peer con QR code
  - Interfaccia di gestione regole firewall

- **Integrazione Discord**
  - Bot Discord con comandi slash
  - Notifiche e avvisi automatici
  - Gestione autorizzazioni basata sui ruoli Discord

- **Sistema di Monitoraggio**
  - Monitoraggio completo di tutti i servizi
  - Avvisi automatici per problemi di sistema
  - Grafici e statistiche di utilizzo

- **Gestione Utenti Multi-livello**
  - Ruoli personalizzabili (Admin, Moderator, Member, Supporter)
  - Sistema di inviti per nuovi utenti
  - Integrazione con sistemi di autenticazione esterni

## Requisiti di Sistema

- Sistema operativo: Ubuntu 22.04 o superiore
- Node.js: v18.x o superiore
- PostgreSQL: v14 o superiore
- WireGuard: installato e configurato
- Pterodactyl: pannello accessibile tramite API
- Connessione internet stabile

## Installazione

### Metodo 1: Installazione Automatica

```bash
curl -sL https://raw.githubusercontent.com/tuouser/bellion-manager/main/scripts/install.sh | bash
```

### Metodo 2: Installazione Manuale

1. Clona il repository:
```bash
git clone https://github.com/tuouser/bellion-manager.git
cd bellion-manager
```

2. Installa le dipendenze:
```bash
npm install
```

3. Configura le variabili d'ambiente:
```bash
cp .env.example .env
nano .env
```

4. Configura il database:
```bash
npm run db:push
```

5. Crea un utente amministratore:
```bash
node scripts/admin-account.js
```

6. Avvia il server:
```bash
npm run build
npm run start
```

## Aggiornamento

Per aggiornare BellionManager all'ultima versione:

```bash
cd /opt/bellion-manager
./scripts/update.sh
```

Oppure specificando un repository da cui aggiornare:

```bash
./scripts/update.sh --non-interactive --repo-url=https://github.com/tuouser/bellion-manager.git
```

## Struttura del Progetto

```
/
├── client/               # Frontend React
├── server/               # Backend Express
├── shared/               # Codice condiviso (schema, tipi)
├── scripts/              # Script di utilità
│   ├── install.sh        # Installazione
│   ├── update.sh         # Aggiornamento
│   ├── admin-account.js  # Creazione admin
│   └── pterodactyl-setup.js # Setup Pterodactyl
└── docs/                 # Documentazione
```

## Configurazione

### Variabili d'Ambiente

- `PORT`: Porta su cui avviare il server (default: 3000)
- `DATABASE_URL`: URL di connessione PostgreSQL
- `JWT_SECRET`: Secret per la generazione dei token JWT
- `PTERODACTYL_URL`: URL dell'installazione Pterodactyl
- `PTERODACTYL_API_KEY`: API key per Pterodactyl
- `WG_SERVER_ENDPOINT`: Endpoint del server WireGuard
- `WG_SERVER_PUBLIC_KEY`: Chiave pubblica WireGuard
- `WG_PRIVATE_KEY`: Chiave privata WireGuard
- `BOT_TOKEN`: Token del bot Discord

## Utilizzo

### Pannello Web

Accedi al pannello web all'indirizzo `http://tuo-server:3000` e accedi con le credenziali di amministratore create durante l'installazione.

### Bot Discord

Invita il bot Discord al tuo server e usa il comando `/help` per vedere tutti i comandi disponibili.

## Contribuire

Le pull request sono benvenute. Per modifiche importanti, apri prima un issue per discutere cosa vorresti cambiare.

## Licenza

[MIT](LICENSE)