import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./simplified-storage.ts";
import { WebSocketServer } from "ws";
import { pterodactyl } from "./services/pterodactyl";
import { registerServerForMigration, migrateServer, getMigrationStatus } from "./services/migration";
import {
  getWireguardStatus,
  generateWireguardConfig,
  WireguardPeerStatus
} from "./services/wireguard";
import { sendSystemAlert } from "./services/discord";
import { authController } from "./controllers/auth-controller.ts";
import { isAuthenticated, hasRole } from "./middleware/auth-middleware.ts";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Rotte di autenticazione
  app.post('/api/auth/register', (req, res) => authController.register(req, res));
  app.post('/api/auth/login', (req, res) => authController.login(req, res));
  app.get('/api/auth/profile', isAuthenticated, (req, res) => authController.getProfile(req, res));
  app.post('/api/auth/refresh', (req, res) => authController.refreshToken(req, res));
  
  // Rotte per gestione inviti (solo admin e moderatori)
  app.post('/api/auth/invite', isAuthenticated, hasRole(['admin', 'moderator']), (req, res) => authController.createInvite(req, res));
  app.post('/api/auth/register-with-invite', (req, res) => authController.registerWithInvite(req, res));

  // Setup websocket server for real-time updates with a distinct path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws' // Usa un percorso specifico per evitare conflitti con Vite
  });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected to /ws');
    
    // Send initial data
    storage.getAllServers().then(servers => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'servers', data: servers }));
      }
    });
    
    storage.getUnacknowledgedSystemAlerts().then(alerts => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'alerts', data: alerts }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected from /ws');
    });
  });

  // Broadcast updates to all connected clients
  const broadcast = (type: string, data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({ type, data }));
      }
    });
  };

  // API Routes
  // Get all servers
  app.get('/api/servers', async (req: Request, res: Response) => {
    try {
      const servers = await storage.getAllServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch servers' });
    }
  });

  // Get server by ID
  app.get('/api/servers/:id', async (req: Request, res: Response) => {
    try {
      const server = await storage.getServer(Number(req.params.id));
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch server' });
    }
  });

  // Start server
  app.post('/api/servers/:id/start', async (req: Request, res: Response) => {
    try {
      const server = await storage.getServer(Number(req.params.id));
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }

      if (server.pterodactylId) {
        await pterodactyl.startServer(server.pterodactylId);
      } else {
        // Handle docker or other server types here
      }

      const updatedServer = await storage.updateServer(server.id, { 
        status: 'starting',
        uptime: '0d 0h 0m'
      });

      broadcast('server-update', updatedServer);
      res.json(updatedServer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to start server' });
    }
  });

  // Stop server
  app.post('/api/servers/:id/stop', async (req: Request, res: Response) => {
    try {
      const server = await storage.getServer(Number(req.params.id));
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }

      if (server.pterodactylId) {
        await pterodactyl.stopServer(server.pterodactylId);
      } else {
        // Handle docker or other server types here
      }

      const updatedServer = await storage.updateServer(server.id, { 
        status: 'stopping' 
      });

      broadcast('server-update', updatedServer);
      res.json(updatedServer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to stop server' });
    }
  });

  // Restart server
  app.post('/api/servers/:id/restart', async (req: Request, res: Response) => {
    try {
      const server = await storage.getServer(Number(req.params.id));
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }

      if (server.pterodactylId) {
        await pterodactyl.restartServer(server.pterodactylId);
      } else {
        // Handle docker or other server types here
      }

      const updatedServer = await storage.updateServer(server.id, { 
        status: 'restarting' 
      });

      broadcast('server-update', updatedServer);
      res.json(updatedServer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to restart server' });
    }
  });

  // Get all Pterodactyl servers
  app.get('/api/pterodactyl/servers', async (req: Request, res: Response) => {
    try {
      const servers = await pterodactyl.getServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch Pterodactyl servers' });
    }
  });
  
  // Get resources for all Pterodactyl servers
  app.get('/api/pterodactyl/resources', async (req: Request, res: Response) => {
    try {
      // Import the resource monitor
      const { default: resourceMonitor } = await import('./services/monitor');
      
      // Controlliamo se possiamo accedere all'API Pterodactyl provando a ottenere i server
      try {
        await pterodactyl.getServers();
      } catch(err) {
        return res.status(503).json({ message: 'Pterodactyl API not configured or unreachable' });
      }
      
      // Ottieni i server Pterodactyl
      const pterodactylServers = await pterodactyl.getServers();
      
      if (!pterodactylServers || pterodactylServers.length === 0) {
        return res.status(404).json({ message: 'No Pterodactyl servers found' });
      }
      
      // Per ogni server, controlla le risorse
      const resourcePromises = pterodactylServers.map(server => 
        resourceMonitor.checkServerResources(server.identifier)
      );
      
      // Attendi che tutte le promesse siano risolte
      const resourceResults = await Promise.all(resourcePromises.map(p => p.catch((e: Error) => null)));
      
      // Filtra i risultati validi e formatta la risposta
      const validResults = resourceResults.filter(result => result !== null)
        .map((result, index) => {
          const server = pterodactylServers[index];
          return {
            id: server.identifier,
            name: server.name,
            status: result.status,
            memory: result.memory,
            cpu: result.cpu,
            disk: result.disk
          };
        });
      
      res.json(validResults);
    } catch (error) {
      console.error('Error fetching Pterodactyl resources:', error);
      res.status(500).json({ message: 'Failed to get Pterodactyl server resources' });
    }
  });

  // Get WireGuard status
  app.get('/api/wireguard/status', async (req: Request, res: Response) => {
    try {
      const status = await getWireguardStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch WireGuard status' });
    }
  });
  
  // Get WireGuard firewall rules
  app.get('/api/wireguard/firewall', async (req: Request, res: Response) => {
    try {
      const { wireguardFirewall } = await import('./services/wireguard-firewall');
      const rules = await wireguardFirewall.getAllRules();
      res.json(rules);
    } catch (error) {
      console.error('Errore nel recupero delle regole firewall:', error);
      res.status(500).json({ message: 'Failed to fetch WireGuard firewall rules' });
    }
  });
  
  // Get WireGuard firewall rules for a specific peer
  app.get('/api/wireguard/firewall/:peerId', async (req: Request, res: Response) => {
    try {
      const peerId = parseInt(req.params.peerId);
      if (isNaN(peerId)) {
        return res.status(400).json({ message: 'Invalid peer ID' });
      }
      
      const { wireguardFirewall } = await import('./services/wireguard-firewall');
      const rules = await wireguardFirewall.getRulesForPeer(peerId);
      res.json(rules);
    } catch (error) {
      console.error('Errore nel recupero delle regole firewall per il peer:', error);
      res.status(500).json({ message: 'Failed to fetch WireGuard firewall rules for peer' });
    }
  });
  
  // Add a WireGuard firewall rule
  app.post('/api/wireguard/firewall', async (req: Request, res: Response) => {
    try {
      const { 
        peerId, 
        type, 
        direction, 
        protocol,
        port,
        portRange,
        rateLimit,
        description
      } = req.body;
      
      if (!peerId || !type || !direction) {
        return res.status(400).json({ message: 'Dati mancanti nella richiesta' });
      }
      
      // Verifica che il peer esista
      const peer = await storage.getWireguardPeer(peerId);
      if (!peer) {
        return res.status(404).json({ message: 'Peer non trovato' });
      }
      
      // Validazione aggiuntiva in base al tipo di regola
      if (type === 'limit' && !rateLimit) {
        return res.status(400).json({ message: 'Limite di velocità mancante per la regola di tipo limit' });
      }
      
      const { wireguardFirewall } = await import('./services/wireguard-firewall');
      
      // Crea la nuova regola
      const newRule = wireguardFirewall.addRule({
        peerId,
        type,
        direction,
        protocol: protocol || 'all',
        port: port ? parseInt(String(port)) : undefined,
        portRange,
        rateLimit: rateLimit ? parseInt(String(rateLimit)) : undefined,
        description,
        enabled: true
      });
      
      res.status(201).json(newRule);
    } catch (error) {
      console.error('Errore nell\'aggiunta della regola firewall:', error);
      res.status(500).json({ message: 'Failed to add WireGuard firewall rule' });
    }
  });
  
  // Update or toggle a WireGuard firewall rule
  app.patch('/api/wireguard/firewall/:ruleId', async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.ruleId);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: 'ID regola non valido' });
      }
      
      const { wireguardFirewall } = await import('./services/wireguard-firewall');
      
      // Verifica che la regola esista
      const existingRule = await wireguardFirewall.getRule(ruleId);
      if (!existingRule) {
        return res.status(404).json({ message: 'Regola non trovata' });
      }
      
      // Se viene fornito solo il campo 'enabled', è una richiesta di toggle dello stato
      if (Object.keys(req.body).length === 1 && 'enabled' in req.body) {
        const updatedRule = await wireguardFirewall.updateRule(ruleId, { enabled: req.body.enabled });
        if (updatedRule) {
          res.json(updatedRule);
        } else {
          res.status(500).json({ message: 'Errore nell\'aggiornamento dello stato della regola' });
        }
      } else {
        // Altrimenti è un aggiornamento completo della regola
        const updatedRule = await wireguardFirewall.updateRule(ruleId, req.body);
        if (updatedRule) {
          res.json(updatedRule);
        } else {
          res.status(500).json({ message: 'Errore nell\'aggiornamento della regola firewall' });
        }
      }
    } catch (error) {
      console.error(`Errore nell'aggiornamento della regola firewall ${req.params.ruleId}:`, error);
      res.status(500).json({ message: 'Errore nell\'aggiornamento della regola firewall' });
    }
  });
  
  // Delete a WireGuard firewall rule
  app.delete('/api/wireguard/firewall/:ruleId', async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.ruleId);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: 'Invalid rule ID' });
      }
      
      const { wireguardFirewall } = await import('./services/wireguard-firewall');
      const success = await wireguardFirewall.deleteRule(ruleId);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: 'Rule not found' });
      }
    } catch (error) {
      console.error('Errore nella rimozione della regola firewall:', error);
      res.status(500).json({ message: 'Failed to remove WireGuard firewall rule' });
    }
  });

  // Generate WireGuard configuration
  app.post('/api/wireguard/config', async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Nome mancante nella richiesta' });
      }
      
      const result = await generateWireguardConfig(name);
      if (!result) {
        return res.status(500).json({ message: 'Errore nella generazione della configurazione' });
      }
      
      // Se è stata fornita una descrizione, aggiorna il peer appena creato
      if (description && result.peerId) {
        await storage.updateWireguardPeer(result.peerId, { description });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Errore nella generazione della configurazione WireGuard:', error);
      res.status(500).json({ message: 'Errore nella generazione della configurazione WireGuard', error: String(error) });
    }
  });
  
  // Get all WireGuard peers
  app.get('/api/wireguard/peers', async (req: Request, res: Response) => {
    try {
      const peers = await storage.getAllWireguardPeers();
      res.json(peers);
    } catch (error) {
      console.error('Errore nel recupero dei peer WireGuard:', error);
      res.status(500).json({ message: 'Errore nel recupero dei peer WireGuard' });
    }
  });
  
  // Get specific WireGuard peer
  app.get('/api/wireguard/peers/:id', async (req: Request, res: Response) => {
    try {
      const peerId = parseInt(req.params.id);
      if (isNaN(peerId)) {
        return res.status(400).json({ message: 'ID peer non valido' });
      }
      
      const peer = await storage.getWireguardPeer(peerId);
      if (!peer) {
        return res.status(404).json({ message: 'Peer non trovato' });
      }
      
      res.json(peer);
    } catch (error) {
      console.error(`Errore nel recupero del peer WireGuard ${req.params.id}:`, error);
      res.status(500).json({ message: 'Errore nel recupero del peer WireGuard' });
    }
  });
  
  // Update WireGuard peer
  app.patch('/api/wireguard/peers/:id', async (req: Request, res: Response) => {
    try {
      const peerId = parseInt(req.params.id);
      if (isNaN(peerId)) {
        return res.status(400).json({ message: 'ID peer non valido' });
      }
      
      const { name, description, enabled } = req.body;
      
      // Verifica che il peer esista
      const peer = await storage.getWireguardPeer(peerId);
      if (!peer) {
        return res.status(404).json({ message: 'Peer non trovato' });
      }
      
      // Aggiorna i campi forniti
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (enabled !== undefined) updates.enabled = enabled;
      
      // Se il peer è stato disabilitato, rimuovilo dalla configurazione WireGuard
      if (enabled === false && peer.enabled) {
        try {
          const { wireguard } = await import('./services/wireguard');
          await wireguard.removePeerFromServer(peer.publicKey);
        } catch (error) {
          console.error('Errore nella rimozione del peer dalla configurazione WireGuard:', error);
          // Continua comunque con l'aggiornamento nel database
        }
      } 
      // Se il peer è stato riabilitato, aggiungilo alla configurazione WireGuard
      else if (enabled === true && !peer.enabled) {
        try {
          const { wireguard } = await import('./services/wireguard');
          const ipAddress = peer.allowedIps.split('/')[0];
          await wireguard.addPeerToServer(peer.publicKey, ipAddress);
        } catch (error) {
          console.error('Errore nell\'aggiunta del peer alla configurazione WireGuard:', error);
          // Continua comunque con l'aggiornamento nel database
        }
      }
      
      // Aggiorna il peer nel database
      const updatedPeer = await storage.updateWireguardPeer(peerId, updates);
      res.json(updatedPeer);
      
    } catch (error) {
      console.error(`Errore nell'aggiornamento del peer WireGuard ${req.params.id}:`, error);
      res.status(500).json({ message: 'Errore nell\'aggiornamento del peer WireGuard' });
    }
  });
  
  // Delete WireGuard peer
  app.delete('/api/wireguard/peers/:id', async (req: Request, res: Response) => {
    try {
      const peerId = parseInt(req.params.id);
      if (isNaN(peerId)) {
        return res.status(400).json({ message: 'ID peer non valido' });
      }
      
      // Verifica che il peer esista
      const peer = await storage.getWireguardPeer(peerId);
      if (!peer) {
        return res.status(404).json({ message: 'Peer non trovato' });
      }
      
      // Rimuovi il peer dalla configurazione WireGuard
      try {
        const { wireguard } = await import('./services/wireguard');
        await wireguard.removePeerFromServer(peer.publicKey);
      } catch (error) {
        console.error('Errore nella rimozione del peer dalla configurazione WireGuard:', error);
        // Continua comunque con l'eliminazione dal database
      }
      
      // Aggiorna il peer nel database (contrassegnalo come disabilitato invece di eliminarlo)
      await storage.updateWireguardPeer(peerId, { enabled: false });
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Errore nell'eliminazione del peer WireGuard ${req.params.id}:`, error);
      res.status(500).json({ message: 'Errore nell\'eliminazione del peer WireGuard' });
    }
  });
  
  // WireGuard backup API routes
  
  // Get all available backups
  app.get('/api/wireguard/backups', async (req: Request, res: Response) => {
    try {
      const { wireguardBackup } = await import('./services/wireguard-backup');
      const backups = wireguardBackup.getAvailableBackups();
      
      res.json(backups);
    } catch (error) {
      console.error('Errore nel recupero dei backup WireGuard:', error);
      res.status(500).json({ message: 'Errore nel recupero dei backup' });
    }
  });
  
  // Create a new backup
  app.post('/api/wireguard/backups', async (req: Request, res: Response) => {
    try {
      const { wireguardBackup } = await import('./services/wireguard-backup');
      await wireguardBackup.backupAllPeerConfigs();
      
      const backups = wireguardBackup.getAvailableBackups();
      res.status(201).json({
        message: 'Backup creato con successo',
        latestBackup: backups[0]
      });
    } catch (error) {
      console.error('Errore nella creazione del backup WireGuard:', error);
      res.status(500).json({ message: 'Errore nella creazione del backup' });
    }
  });
  
  // Restore a backup
  app.post('/api/wireguard/backups/:name/restore', async (req: Request, res: Response) => {
    try {
      const backupName = req.params.name;
      
      const { wireguardBackup } = await import('./services/wireguard-backup');
      const result = await wireguardBackup.restoreBackup(backupName);
      
      res.json({
        message: `Backup "${backupName}" ripristinato con successo`,
        ...result
      });
    } catch (error) {
      console.error(`Errore nel ripristino del backup "${req.params.name}":`, error);
      res.status(500).json({ message: 'Errore nel ripristino del backup' });
    }
  });
  
  // Delete a backup
  app.delete('/api/wireguard/backups/:name', async (req: Request, res: Response) => {
    try {
      const backupName = req.params.name;
      
      const { wireguardBackup } = await import('./services/wireguard-backup');
      await wireguardBackup.deleteBackup(backupName);
      
      res.json({
        message: `Backup "${backupName}" eliminato con successo`
      });
    } catch (error) {
      console.error(`Errore nell'eliminazione del backup "${req.params.name}":`, error);
      res.status(500).json({ message: 'Errore nell\'eliminazione del backup' });
    }
  });
  
  // Regenerate WireGuard peer configuration
  app.post('/api/wireguard/peers/:id/regenerate', async (req: Request, res: Response) => {
    try {
      const peerId = parseInt(req.params.id);
      if (isNaN(peerId)) {
        return res.status(400).json({ message: 'ID peer non valido' });
      }
      
      // Verifica che il peer esista
      const peer = await storage.getWireguardPeer(peerId);
      if (!peer) {
        return res.status(404).json({ message: 'Peer non trovato' });
      }
      
      // Genera una nuova chiave privata
      const { wireguard } = await import('./services/wireguard');
      const privateKey = await wireguard.generatePrivateKey();
      const newPublicKey = await wireguard.derivePublicKey(privateKey);
      
      // Rimuovi il vecchio peer dalla configurazione WireGuard
      await wireguard.removePeerFromServer(peer.publicKey);
      
      // Estrai l'indirizzo IP dal peer esistente
      const ipAddress = peer.allowedIps.split('/')[0];
      
      // Aggiungi il nuovo peer alla configurazione WireGuard
      await wireguard.addPeerToServer(newPublicKey, ipAddress);
      
      // Aggiorna il peer nel database
      await storage.updateWireguardPeer(peerId, { 
        publicKey: newPublicKey,
        lastHandshake: null,
        transferRx: 0,
        transferTx: 0,
        totalConnections: 0,
        lastConnectionDuration: null,
        isOnline: false
      });
      
      // Genera il file di configurazione
      const config = wireguard.generateClientConfig(privateKey, ipAddress);
      const filename = `${peer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.conf`;
      
      res.json({ config, filename });
    } catch (error) {
      console.error(`Errore nella rigenerazione della configurazione per il peer ${req.params.id}:`, error);
      res.status(500).json({ message: 'Errore nella rigenerazione della configurazione WireGuard' });
    }
  });

  // Get all system alerts
  app.get('/api/alerts', async (req: Request, res: Response) => {
    try {
      const alerts = await storage.getAllSystemAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  // Acknowledge alert
  app.post('/api/alerts/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const alert = await storage.getSystemAlert(Number(req.params.id));
      if (!alert) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      const updatedAlert = await storage.updateSystemAlert(alert.id, { 
        acknowledged: true 
      });

      broadcast('alert-update', updatedAlert);
      res.json(updatedAlert);
    } catch (error) {
      res.status(500).json({ message: 'Failed to acknowledge alert' });
    }
  });

  // Create new system alert (usually triggered internally, but exposed for testing)
  app.post('/api/alerts', async (req: Request, res: Response) => {
    try {
      const { type, message, serverId } = req.body;
      
      if (!type || !message) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const alert = await storage.createSystemAlert({
        type,
        message,
        serverId: serverId ? Number(serverId) : undefined
      });

      broadcast('new-alert', alert);
      
      // Invia anche l'avviso tramite il bot Discord se è disponibile
      const discordClient = app.get('discordClient');
      if (discordClient) {
        // Recupera informazioni sul server per il messaggio
        let serverName = 'N/A';
        if (serverId) {
          const server = await storage.getServer(Number(serverId));
          if (server) {
            serverName = server.name;
          }
        }
        
        // Invia l'avviso nel canale designato
        const channelId = process.env.WG_STATUS_CHANNEL_ID || process.env.ANNOUNCE_CHANNEL_ID;
        if (channelId) {
          await sendSystemAlert(
            discordClient, 
            channelId, 
            `Avviso Sistema: ${type.toUpperCase()}`, 
            `${message}\n\nServer: ${serverName}`, 
            type as 'info' | 'warning' | 'error'
          );
        }
      }
      
      res.status(201).json(alert);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create alert' });
    }
  });

  // Mock endpoint to simulate server status change (for testing)
  app.post('/api/mock/server-status', async (req: Request, res: Response) => {
    try {
      const { serverId, status, playerList } = req.body;
      
      if (!serverId || !status) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const server = await storage.getServer(Number(serverId));
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }
      
      const oldStatus = server.status;
      const updateData: Partial<typeof server> = { status };
      if (playerList) updateData.playerList = playerList;
      
      const updatedServer = await storage.updateServer(server.id, updateData);
      
      broadcast('server-update', updatedServer);
      
      // Notifica cambio di stato tramite Discord
      const discordClient = app.get('discordClient');
      if (discordClient && oldStatus !== status) {
        const channelId = process.env.ANNOUNCE_CHANNEL_ID;
        if (channelId) {
          // Determina il tipo di notifica in base allo stato
          let alertType: 'info' | 'warning' | 'error' = 'info';
          let emoji = '🔄';
          
          if (status === 'online' && oldStatus !== 'online') {
            alertType = 'info';
            emoji = '🟢';
          } else if (status === 'offline' && oldStatus !== 'offline') {
            alertType = 'warning';
            emoji = '🔴';
          } else if (status === 'restarting') {
            alertType = 'info';
            emoji = '🔄';
          }
          
          await sendSystemAlert(
            discordClient,
            channelId,
            `${emoji} Cambio Stato Server: ${server.name}`,
            `Stato aggiornato da **${oldStatus}** a **${status}**\n\nIndirizzo: ${server.ipAddress}:${server.port}`,
            alertType
          );
        }
      }
      
      res.json(updatedServer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update server status' });
    }
  });
  
  // Endpoint per la migrazione dei server Minecraft da Docker a Pterodactyl
  app.post('/api/servers/migrate', async (req: Request, res: Response) => {
    try {
      const { name, type, port, memory, disk } = req.body;
      
      if (!name || !port) {
        return res.status(400).json({ message: 'Nome e porta sono obbligatori' });
      }
      
      // Registra la richiesta di migrazione
      console.log(`Richiesta di migrazione server: ${name}, tipo: ${type || 'minecraft'}, porta: ${port}`);
      
      // Usa il servizio di migrazione per registrare il server
      const server = await registerServerForMigration(
        name,
        type || 'minecraft',
        parseInt(port),
        memory || 2048,
        disk || 10000
      );
      
      if (!server) {
        return res.status(400).json({
          success: false,
          message: 'Impossibile registrare il server per la migrazione. Potrebbe già esistere o si è verificato un errore.'
        });
      }
      
      // Notifica sulla migrazione tramite Discord
      const discordClient = app.get('discordClient');
      if (discordClient) {
        const channelId = process.env.ANNOUNCE_CHANNEL_ID;
        if (channelId) {
          await sendSystemAlert(
            discordClient,
            channelId,
            `🔄 Migrazione Server: ${name}`,
            `Iniziata la migrazione del server **${name}** (${type || 'minecraft'}) da Docker a Pterodactyl.\n\nPorta: ${port}`,
            'info'
          );
        }
      }
      
      // Broadcast per aggiornare i client in tempo reale
      broadcast('new-server', server);
      
      res.status(201).json({
        success: true,
        message: 'Server registrato per migrazione',
        serverId: server.id
      });
    } catch (error) {
      console.error('Errore durante la registrazione del server per migrazione:', error);
      res.status(500).json({ message: 'Errore durante la registrazione del server' });
    }
  });
  
  // Ottieni lo stato di migrazione di un server
  // Endpoint per recuperare i dati di utilizzo storico di WireGuard
  app.get('/api/wireguard/usage-history', async (req: Request, res: Response) => {
    try {
      const peerId = req.query.peerId ? parseInt(req.query.peerId as string) : undefined;
      const timeRange = (req.query.range as '24h' | '7d' | '30d' | 'all') || '7d';
      
      const { wireguardUsage } = await import('./services/wireguard-usage');
      const usageData = await wireguardUsage.getUsageData(peerId, timeRange);
      
      res.json(usageData);
    } catch (error) {
      console.error('Errore nel recupero dei dati di utilizzo WireGuard:', error);
      res.status(500).json({ message: 'Errore nel recupero dei dati di utilizzo WireGuard' });
    }
  });
  
  // Endpoint per recuperare le statistiche aggregate di utilizzo WireGuard
  app.get('/api/wireguard/usage-stats', async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.range as '24h' | '7d' | '30d' | 'all') || '7d';
      
      const { wireguardUsage } = await import('./services/wireguard-usage');
      const stats = await wireguardUsage.getAggregateStats(timeRange);
      
      res.json(stats);
    } catch (error) {
      console.error('Errore nel recupero delle statistiche di utilizzo WireGuard:', error);
      res.status(500).json({ message: 'Errore nel recupero delle statistiche di utilizzo WireGuard' });
    }
  });
  
  app.get('/api/servers/:id/migration', async (req: Request, res: Response) => {
    try {
      const serverId = parseInt(req.params.id);
      
      if (isNaN(serverId)) {
        return res.status(400).json({ success: false, message: 'ID server non valido' });
      }
      
      const status = await getMigrationStatus(serverId);
      
      if (status === null) {
        return res.status(404).json({ success: false, message: 'Server non trovato' });
      }
      
      res.status(200).json({
        success: true,
        serverId: serverId,
        status: status
      });
    } catch (error) {
      console.error('Errore durante il recupero dello stato di migrazione:', error);
      res.status(500).json({ success: false, message: 'Errore interno del server' });
    }
  });
  
  // Avvia la migrazione di un server
  app.post('/api/servers/:id/migrate', async (req: Request, res: Response) => {
    try {
      const serverId = parseInt(req.params.id);
      
      if (isNaN(serverId)) {
        return res.status(400).json({ success: false, message: 'ID server non valido' });
      }
      
      const success = await migrateServer(serverId);
      
      if (success) {
        res.status(200).json({
          success: true,
          message: 'Migrazione completata con successo'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Migrazione fallita. Verificare lo stato del server e i requisiti di migrazione.'
        });
      }
    } catch (error) {
      console.error('Errore durante la migrazione del server:', error);
      res.status(500).json({ success: false, message: 'Errore interno del server' });
    }
  });

  return httpServer;
}
