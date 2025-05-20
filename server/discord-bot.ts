import { 
  Client, 
  Collection, 
  GatewayIntentBits, 
  Partials, 
  Events, 
  ApplicationCommandDataResolvable, 
  REST, 
  Routes,
  ButtonInteraction,
  ChannelType,
  CategoryChannel,
  TextChannel,
  Guild,
  VoiceChannel,
  Interaction,
  ModalSubmitInteraction
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { log } from './vite';
import * as resourceMonitor from './services/monitor';

interface Command {
  data: ApplicationCommandDataResolvable;
  execute: (client: Client, interaction: any) => Promise<void>;
  handleButtonInteraction?: (client: Client, interaction: any) => Promise<void>;
  handleModalSubmit?: (client: Client, interaction: any) => Promise<void>;
}

export class DiscordBot {
  private client: Client;
  private commands: Collection<string, Command>;
  private token: string;
  private guildId: string;
  private clientId: string;
  private announceChannelId: string;
  private lanRoleId: string;
  private supporterRoleId: string;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
      ]
    });

    this.commands = new Collection();

    // Recupera le variabili d'ambiente (verrebbero fornite in un'implementazione reale)
    this.token = process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || 'FAKE_TOKEN';
    this.guildId = process.env.GUILD_ID || '123456789012345678';
    this.clientId = process.env.CLIENT_ID || '987654321098765432';
    this.announceChannelId = process.env.ANNOUNCE_CHANNEL_ID || '111222333444555666';
    this.lanRoleId = process.env.LAN_ROLE_ID || '111333555777999';
    this.supporterRoleId = process.env.SUPPORTER_ROLE_ID || '222444666888000';
  }

  /**
   * Avvia il bot Discord
   */
  async start() {
    try {
      // Carica i comandi
      await this.loadCommands();

      // Registra i comandi slash con l'API Discord
      await this.registerCommands();

      // Configura i listener per gli eventi
      this.setupEventListeners();

      // Avvia il login del client Discord
      await this.client.login(this.token);
      
      log('Bot Discord avviato con successo', 'express');
      
      return this.client;
    } catch (error) {
      console.error('Errore durante l\'avvio del bot Discord:', error);
      throw error;
    }
  }

  /**
   * Carica i comandi dal file system
   */
  private async loadCommands() {
    // Usa path relativi anziché __dirname che non è disponibile in ESM
    const commandsPath = path.join(process.cwd(), 'server', 'commands');
    
    try {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(filePath);

        // Registra il comando solo se ha sia data che execute
        if (command.default && command.default.data && command.default.execute) {
          this.commands.set(command.default.data.name, command.default);
          console.log(`Comando caricato: ${command.default.data.name}`);
        } else {
          console.warn(`Il comando in ${filePath} non ha una proprietà "data" o "execute" richiesta`);
        }
      }
    } catch (error) {
      console.error('Errore durante il caricamento dei comandi:', error);
      throw error;
    }
  }

  /**
   * Registra i comandi slash con l'API Discord
   */
  private async registerCommands() {
    const rest = new REST({ version: '10' }).setToken(this.token);
    const commandsData = Array.from(this.commands.values()).map(command => command.data);
    
    try {
      if (commandsData.length > 0) {
        console.log(`Sto aggiornando ${commandsData.length} comandi slash...`);

        // Per un'app in un solo server, usa il metodo seguente:
        await rest.put(
          Routes.applicationGuildCommands(this.clientId, this.guildId),
          { body: commandsData }
        );

        console.log('Comandi slash registrati con successo!');
      }
    } catch (error) {
      console.error('Errore durante la registrazione dei comandi slash:', error);
      throw error;
    }
  }

  /**
   * Configura i listener per gli eventi Discord
   */
  private setupEventListeners() {
    this.client.on(Events.ClientReady, () => {
      console.log(`Bot Discord pronto! Loggato come ${this.client.user?.tag}`);
      
      // Dopo il login avviamo la configurazione dei canali del server
      this.setupGuildChannels();
      
      // Avvia task periodici
      this.startPeriodicTasks();
      
      // Inizializza il sistema di monitoraggio delle risorse
      this.initializeResourceMonitoring();
    });

    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      // Gestione dei comandi slash
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
          console.error(`Nessun comando trovato per ${interaction.commandName}`);
          return;
        }

        try {
          await command.execute(this.client, interaction);
        } catch (error) {
          console.error(`Errore durante l'esecuzione del comando ${interaction.commandName}:`, error);
          
          const errorMessage = {
            content: 'Si è verificato un errore durante l\'esecuzione del comando.',
            ephemeral: true
          };
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        }
      } 
      // Gestione delle interazioni con i pulsanti
      else if (interaction.isButton()) {
        this.handleButtonInteraction(interaction);
      }
      // Gestione degli invii di moduli
      else if (interaction.isModalSubmit()) {
        this.handleModalSubmit(interaction);
      }
    });
    
    // Gestisci gli errori non catturati
    this.client.on(Events.Error, (error) => {
      console.error('Errore non gestito nel client Discord:', error);
    });
  }

  /**
   * Configura i canali Discord nel server
   */
  private async setupGuildChannels() {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      if (!guild) {
        return console.error('Guild non trovata.');
      }
      
      // Ottieni i canali esistenti
      await guild.channels.fetch();
      
      // Cerca la categoria Servers
      let serversCategory = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildCategory && channel.name === 'SERVER ATTIVI'
      ) as CategoryChannel;
      
      // Se la categoria non esiste, creala
      if (!serversCategory) {
        serversCategory = await guild.channels.create({
          name: 'SERVER ATTIVI',
          type: ChannelType.GuildCategory,
          position: 2
        });
        console.log('Creata categoria SERVER ATTIVI');
      }
      
      // Aggiorna i canali dei server in base ai server attivi
      await this.updateServerChannels(serversCategory);
      
      // Cerca la categoria di stato della LAN
      let lanStatusCategory = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildCategory && channel.name === 'STATO LAN'
      ) as CategoryChannel;
      
      // Se la categoria non esiste, creala
      if (!lanStatusCategory) {
        lanStatusCategory = await guild.channels.create({
          name: 'STATO LAN',
          type: ChannelType.GuildCategory,
          position: 1
        });
        console.log('Creata categoria STATO LAN');
      }
      
      // Verifica l'esistenza del canale lan-status
      let lanStatusChannel = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildText && channel.name === 'lan-status'
      ) as TextChannel;
      
      if (!lanStatusChannel) {
        lanStatusChannel = await guild.channels.create({
          name: 'lan-status',
          type: ChannelType.GuildText,
          parent: lanStatusCategory.id
        });
        console.log('Creato canale lan-status');
        
        // Invia un messaggio iniziale nel canale
        await lanStatusChannel.send({
          content: '🌐 **Stato della LAN**\n\nI membri con il ruolo LAN possono vedere questa sezione e connettersi alla rete privata.\nUsa `/lan-access` per ottenere la configurazione WireGuard.'
        });
      }
    } catch (error) {
      console.error('Errore durante la configurazione dei canali Discord:', error);
    }
  }

  /**
   * Gestisce le interazioni con i pulsanti
   */
  private async handleButtonInteraction(interaction: ButtonInteraction) {
    try {
      const customId = interaction.customId;
      
      // Gestione pulsanti per eventi
      if (customId.startsWith('poll_') || customId.startsWith('event_')) {
        const eventCommand = this.commands.get('poll');
        if (eventCommand && eventCommand.handleButtonInteraction) {
          await eventCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per ticket
      if (customId.startsWith('ticket_')) {
        const ticketCommand = this.commands.get('ticket');
        if (ticketCommand && ticketCommand.handleButtonInteraction) {
          await ticketCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per notifiche
      if (customId.includes('maintenance_') || customId.includes('join_server') || customId.includes('event_')) {
        const notificaCommand = this.commands.get('notifica');
        if (notificaCommand && notificaCommand.handleButtonInteraction) {
          await notificaCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per monitor
      if (customId.startsWith('monitor_')) {
        const monitorCommand = this.commands.get('monitor');
        if (monitorCommand && monitorCommand.handleButtonInteraction) {
          await monitorCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per migrazione server
      if (customId.startsWith('migrate_') || customId.startsWith('check_status_') || customId.startsWith('retry_migrate_')) {
        const migrazioneCommand = this.commands.get('migrazione');
        if (migrazioneCommand && migrazioneCommand.handleButtonInteraction) {
          await migrazioneCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per pterodactyl stats
      if (customId.startsWith('pterodactyl_')) {
        const pterodactylCommand = this.commands.get('pterodactyl');
        if (pterodactylCommand && pterodactylCommand.handleButtonInteraction) {
          await pterodactylCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per monitor-alerts
      if (customId.startsWith('monitor_')) {
        const monitorAlertsCommand = this.commands.get('monitor-alerts');
        if (monitorAlertsCommand && monitorAlertsCommand.handleButtonInteraction) {
          await monitorAlertsCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsanti per backup server
      if (customId.startsWith('backup_')) {
        const backupCommand = this.commands.get('backup');
        if (backupCommand && backupCommand.handleButtonInteraction) {
          await backupCommand.handleButtonInteraction(this.client, interaction);
          return;
        }
      }
      
      // Gestione pulsante per ottenere ruolo LAN
      if (customId === 'get_lan_role') {
        const member = interaction.member;
        if (member) {
          try {
            // @ts-ignore - TypeScript non riconosce roles su GuildMember
            await member.roles.add(this.lanRoleId);
            await interaction.reply({
              content: '✅ Ti è stato assegnato il ruolo LAN! Ora puoi accedere ai canali della LAN e richiedere la configurazione WireGuard con `/lan-access`.',
              ephemeral: true
            });
          } catch (error) {
            console.error('Errore nell\'assegnazione del ruolo LAN:', error);
            await interaction.reply({
              content: '❌ Si è verificato un errore durante l\'assegnazione del ruolo. Contatta un amministratore.',
              ephemeral: true
            });
          }
          return;
        }
      }
      
      // Se arriviamo qui, è un pulsante non gestito
      await interaction.reply({
        content: 'Questo pulsante non è più supportato o è stato configurato in modo errato.',
        ephemeral: true
      });
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione con un pulsante:', error);
      
      // Rispondi solo se non è stata già inviata una risposta
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Si è verificato un errore durante l\'elaborazione della richiesta.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Aggiorna dinamicamente i canali dei server in base ai server online
   */
  private async updateServerChannels(category: CategoryChannel) {
    try {
      const guild = category.guild;
      
      // Ottieni tutti i server dal sistema
      const servers = await storage.getAllServers();
      
      // Filtra solo i server online
      const onlineServers = servers.filter(server => server.status === 'online');
      
      // Per ogni server online, controlla se esiste un canale corrispondente
      for (const server of onlineServers) {
        const serverChannelName = `${server.name.toLowerCase().replace(/\s+/g, '-')}`;
        
        let serverChannel = guild.channels.cache.find(
          channel => channel.name === serverChannelName && channel.parentId === category.id
        ) as TextChannel;
        
        // Se il canale non esiste, crealo
        if (!serverChannel) {
          serverChannel = await guild.channels.create({
            name: serverChannelName,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `${server.type} server - ${server.ipAddress}:${server.port}`,
            // Imposta i permessi dopo aver creato il canale per evitare problemi con i ruoli non in cache
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ['ViewChannel']
            }
          ]
          });
          
          // Invia un messaggio informativo nel nuovo canale
          await serverChannel.send({
            content: `🎮 **${server.name}** (${server.type}) è ora online!\n\nMassimo giocatori: ${server.maxPlayers}\nIndirizzo: \`${server.ipAddress}:${server.port}\`\n\nUsa il comando \`/server-control\` per gestire questo server.`
          });
          
          console.log(`Creato canale per il server ${server.name}`);
        }
      }
      
      // Rimuovi canali di server non più online
      const serverChannels = category.children.cache.filter(channel => channel.type === ChannelType.GuildText);
      
      // Gestiamo la rimozione dei canali dei server non più online
      for (const channel of Array.from(serverChannels.values())) {
        const serverName = channel.name.replace(/-/g, ' ');
        
        // Controlla se esiste un server online con questo nome
        const matchingServer = onlineServers.find(server => 
          server.name.toLowerCase().replace(/\s+/g, '-') === channel.name
        );
        
        // Se non c'è un server online corrispondente, elimina il canale
        if (!matchingServer) {
          try {
            await channel.delete(`Server ${serverName} non più online`);
            console.log(`Eliminato canale per il server ${serverName} non più online`);
          } catch (err) {
            console.error(`Errore durante l'eliminazione del canale ${serverName}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dei canali dei server:', error);
    }
  }

  /**
   * Gestisce gli invii di moduli modali
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction) {
    try {
      const customId = interaction.customId;
      
      // Gestione modali per i ticket
      if (customId.startsWith('ticket_modal_')) {
        const command = this.commands.get('ticket');
        if (command && command.handleModalSubmit) {
          await command.handleModalSubmit(this.client, interaction);
          return;
        }
      }
      
      // Se arriviamo qui, è un modale non gestito
      await interaction.reply({
        content: 'Questo modulo non è più supportato o è stato configurato in modo errato.',
        ephemeral: true
      });
    } catch (error) {
      console.error('Errore durante la gestione dell\'invio di un modulo modale:', error);
      
      // Rispondi solo se non è stata già inviata una risposta
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Si è verificato un errore durante l\'elaborazione del modulo.',
          ephemeral: true
        });
      }
    }
  }

  private startPeriodicTasks() {
    // Controlla lo stato dei server ogni 5 minuti
    setInterval(() => this.checkServerStatus(), 5 * 60 * 1000);
    
    // Invia aggiornamenti di stato nel canale lan-status ogni ora
    setInterval(() => this.sendStatusUpdate(), 60 * 60 * 1000);
    
    // Esegui subito un controllo iniziale
    this.checkServerStatus();
    this.sendStatusUpdate();
  }

  /**
   * Controlla lo stato dei server e invia avvisi
   */
  private async checkServerStatus() {
    try {
      // Ottieni tutti i server dal sistema
      const servers = await storage.getAllServers();
      
      for (const server of servers) {
        // Qui in un'implementazione reale controlleremmo lo stato effettivo dei server
        // Per ora simuliamo alcuni cambiamenti occasionali di stato
        
        // Ignora i server in stato di migrazione
        if (
          server.status === 'migration_pending' ||
          server.status === 'migration_in_progress' ||
          server.status === 'migration_completed' ||
          server.status === 'migration_failed'
        ) {
          continue;
        }
        
        // Simuliamo un controllo dello stato
        // In un'implementazione reale, qui contatteremmo Pterodactyl o il server Docker
        
        // Per ora non facciamo nulla, mantenendo lo stato corrente
      }
    } catch (error) {
      console.error('Errore durante il controllo dello stato dei server:', error);
    }
  }

  /**
   * Invia un aggiornamento di stato nel canale lan-status
   */
  private async sendStatusUpdate() {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      
      // Trova il canale lan-status
      const statusChannel = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildText && channel.name === 'lan-status'
      ) as TextChannel;
      
      if (!statusChannel) {
        return;
      }
      
      // Ottieni informazioni sui server
      const servers = await storage.getAllServers();
      const onlineServers = servers.filter(server => server.status === 'online');
      
      // Ottieni informazioni sui peer WireGuard
      const peers = await storage.getAllWireguardPeers();
      const activePeers = peers.filter(peer => peer.lastHandshake !== null);
      
      // Crea un messaggio di stato
      let statusMessage = '🌐 **Aggiornamento Stato LAN**\n\n';
      
      // Informazioni sui server
      statusMessage += `**Server:** ${onlineServers.length}/${servers.length} online\n`;
      if (onlineServers.length > 0) {
        statusMessage += 'Server attivi:\n';
        onlineServers.forEach(server => {
          statusMessage += `- **${server.name}** (${server.type}): \`${server.ipAddress}:${server.port}\`\n`;
        });
      }
      
      // Informazioni sulla rete
      statusMessage += `\n**Rete:** ${activePeers.length}/${peers.length} dispositivi connessi\n`;
      statusMessage += `Subnet: \`10.0.0.0/24\`\n`;
      
      // Invia il messaggio
      await statusChannel.send(statusMessage);
    } catch (error) {
      console.error('Errore durante l\'invio dell\'aggiornamento di stato:', error);
    }
  }

  /**
   * Inizializza il sistema di monitoraggio delle risorse
   */
  private initializeResourceMonitoring() {
    try {
      // Imposta il canale predefinito per gli avvisi come il canale lan-status, se esiste
      const guild = this.client.guilds.cache.get(this.guildId);
      if (!guild) return;
      
      // Cerca il canale lan-status
      const alertChannel = guild.channels.cache.find(
        channel => channel.name === 'lan-status' && channel.isTextBased()
      );
      
      if (alertChannel) {
        log(`Inizializzazione del monitoraggio risorse con canale di avviso: ${alertChannel.name}`, 'express');
        resourceMonitor.initMonitoring(this.client, alertChannel.id);
        
        // Inizializza anche il monitoraggio WireGuard sullo stesso canale
        try {
          import('./services/wireguard-monitor').then(({ wireguardMonitor }) => {
            wireguardMonitor.initialize(this.client, alertChannel.id);
            log(`Monitoraggio WireGuard inizializzato sul canale: ${alertChannel.name}`, 'express');
          }).catch(error => {
            console.error('Errore nel caricamento del modulo wireguard-monitor:', error);
          });
        } catch (error) {
          console.error('Errore nell\'inizializzazione del monitoraggio WireGuard:', error);
        }
      } else {
        // Se non esiste, usa il canale announce come fallback
        const announceChannel = guild.channels.cache.find(
          channel => channel.name === 'annunci' && channel.isTextBased()
        );
        
        if (announceChannel) {
          log(`Inizializzazione del monitoraggio risorse con canale di avviso: ${announceChannel.name}`, 'express');
          resourceMonitor.initMonitoring(this.client, announceChannel.id);
          
          // Inizializza anche il monitoraggio WireGuard sullo stesso canale
          try {
            import('./services/wireguard-monitor').then(({ wireguardMonitor }) => {
              wireguardMonitor.initialize(this.client, announceChannel.id);
              log(`Monitoraggio WireGuard inizializzato sul canale: ${announceChannel.name}`, 'express');
            }).catch(error => {
              console.error('Errore nel caricamento del modulo wireguard-monitor:', error);
            });
          } catch (error) {
            console.error('Errore nell\'inizializzazione del monitoraggio WireGuard:', error);
          }
        } else {
          // Inizializza senza canale specifico
          log('Inizializzazione del monitoraggio risorse senza canale di avviso predefinito', 'express');
          resourceMonitor.initMonitoring(this.client);
        }
      }
    } catch (error) {
      console.error('Errore durante l\'inizializzazione del monitoraggio delle risorse:', error);
    }
  }
  
  /**
   * Ottieni il client Discord
   */
  getClient() {
    return this.client;
  }
}