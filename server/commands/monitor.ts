import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ColorResolvable
} from 'discord.js';
import { storage } from '../storage';
import { pterodactyl } from '../services/pterodactyl';
import * as resourceMonitor from '../services/monitor';

// Interfaccia per statistiche di sistema
interface SystemStats {
  cpu: {
    usage: number;   // percentuale di utilizzo
    cores: number;   // numero di core
    temperature: number; // temperatura in °C
  };
  memory: {
    total: number;   // in MB
    used: number;    // in MB
    free: number;    // in MB
  };
  disk: {
    total: number;   // in GB
    used: number;    // in GB
    free: number;    // in GB
  };
  network: {
    download: number; // in Mbps
    upload: number;   // in Mbps
    ping: number;     // in ms
  };
  uptime: number;     // in secondi
}

// Dati simulati per le statistiche di sistema
const mockSystemStats: SystemStats = {
  cpu: {
    usage: 45.7,
    cores: 8,
    temperature: 58.2
  },
  memory: {
    total: 32768,
    used: 14523,
    free: 18245
  },
  disk: {
    total: 1000,
    used: 432,
    free: 568
  },
  network: {
    download: 950.5,
    upload: 120.3,
    ping: 4.2
  },
  uptime: 1209600 // 14 giorni
};

// Valori di soglia per gli avvisi
const thresholds = {
  cpu: {
    warning: 70,
    critical: 90
  },
  memory: {
    warning: 80,
    critical: 95
  },
  disk: {
    warning: 80,
    critical: 95
  },
  network: {
    ping: {
      warning: 100,
      critical: 200
    }
  }
};

// Interfaccia per storico delle statistiche (per i grafici)
interface StatsHistoryPoint {
  timestamp: Date;
  cpu: number;
  memory: number;
  network: {
    download: number;
    upload: number;
    ping: number;
  };
}

// Genera dati simulati per lo storico
const generateMockHistory = (days: number = 7): StatsHistoryPoint[] => {
  const history: StatsHistoryPoint[] = [];
  const now = new Date();
  
  for (let i = days * 24; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 3600 * 1000));
    
    // Simula variazioni naturali
    const hourOfDay = timestamp.getHours();
    const isBusy = hourOfDay >= 18 && hourOfDay <= 23; // Ore di punta serali
    
    const cpuBase = isBusy ? 60 : 40;
    const memoryBase = isBusy ? 70 : 50;
    const downloadBase = isBusy ? 700 : 900;
    const uploadBase = isBusy ? 90 : 110;
    const pingBase = isBusy ? 12 : 5;
    
    // Aggiungi un po' di variabilità casuale
    const variation = () => (Math.random() * 20) - 10; // Valore tra -10 e +10
    
    history.push({
      timestamp,
      cpu: Math.max(5, Math.min(100, cpuBase + variation())),
      memory: Math.max(10, Math.min(95, memoryBase + variation())),
      network: {
        download: Math.max(100, downloadBase + variation() * 10),
        upload: Math.max(10, uploadBase + variation() * 5),
        ping: Math.max(1, pingBase + variation() / 2)
      }
    });
  }
  
  return history;
};

const statsHistory = generateMockHistory(7);

export default {
  data: new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('Monitora lo stato e le prestazioni dei server e della rete LAN')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('sistema')
        .setDescription('Visualizza lo stato del sistema')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rete')
        .setDescription('Visualizza lo stato della rete')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Visualizza lo stato dei server di gioco')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('diagnostica')
        .setDescription('Esegui una diagnostica completa del sistema')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pterodactyl')
        .setDescription('Visualizza le risorse dei server Pterodactyl')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('avvisi')
        .setDescription('Configura le soglie per gli avvisi automatici')
        .addStringOption(option => 
          option
            .setName('tipo')
            .setDescription('Tipo di risorsa da configurare')
            .setRequired(true)
            .addChoices(
              { name: 'CPU', value: 'cpu' },
              { name: 'Memoria', value: 'memory' },
              { name: 'Spazio disco', value: 'disk' },
              { name: 'Ping rete', value: 'network_ping' }
            )
        )
        .addIntegerOption(option => 
          option
            .setName('warning')
            .setDescription('Soglia di avviso (percentuale)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(99)
        )
        .addIntegerOption(option => 
          option
            .setName('critical')
            .setDescription('Soglia critica (percentuale)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Solo gli amministratori possono configurare gli avvisi
      if (subcommand === 'avvisi') {
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        
        if (!isAdmin) {
          return interaction.reply({
            content: '❌ Solo gli amministratori possono configurare le soglie degli avvisi.',
            ephemeral: true
          });
        }
        
        const tipo = interaction.options.getString('tipo') as string;
        const warningValue = interaction.options.getInteger('warning') as number;
        const criticalValue = interaction.options.getInteger('critical') as number;
        
        // Verifica che i valori siano validi
        if (warningValue >= criticalValue) {
          return interaction.reply({
            content: '❌ La soglia di avviso deve essere inferiore alla soglia critica.',
            ephemeral: true
          });
        }
        
        // Aggiorna le soglie
        if (tipo === 'cpu') {
          thresholds.cpu.warning = warningValue;
          thresholds.cpu.critical = criticalValue;
        } else if (tipo === 'memory') {
          thresholds.memory.warning = warningValue;
          thresholds.memory.critical = criticalValue;
        } else if (tipo === 'disk') {
          thresholds.disk.warning = warningValue;
          thresholds.disk.critical = criticalValue;
        } else if (tipo === 'network_ping') {
          thresholds.network.ping.warning = warningValue;
          thresholds.network.ping.critical = criticalValue;
        }
        
        // In una implementazione reale, salveremmo questi valori in un database
        
        // Crea un embed per mostrare le nuove soglie
        const embed = new EmbedBuilder()
          .setTitle('⚙️ Soglie degli avvisi aggiornate')
          .setDescription(`Le soglie per gli avvisi di **${this.getTipoName(tipo)}** sono state aggiornate.`)
          .setColor('#3498DB')
          .addFields(
            { name: '⚠️ Soglia di avviso', value: `${warningValue}%`, inline: true },
            { name: '🔴 Soglia critica', value: `${criticalValue}%`, inline: true }
          )
          .setFooter({ text: `Configurazione aggiornata da ${interaction.user.tag}` })
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      }
      
      // Gestisci gli altri subcomandi
      if (subcommand === 'sistema') {
        await this.showSystemStats(interaction);
      }
      else if (subcommand === 'rete') {
        await this.showNetworkStats(interaction);
      }
      else if (subcommand === 'server') {
        await this.showServerStats(interaction);
      }
      else if (subcommand === 'diagnostica') {
        await this.runDiagnostics(interaction);
      }
      else if (subcommand === 'pterodactyl') {
        await this.showPterodactylResources(interaction);
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando monitor:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante il monitoraggio. Riprova più tardi.',
        ephemeral: true
      });
    }
  },
  
  // Visualizza le statistiche del sistema
  async showSystemStats(interaction: ChatInputCommandInteraction) {
    const stats = mockSystemStats;
    
    // Calcola le percentuali di utilizzo
    const memoryUsagePercent = (stats.memory.used / stats.memory.total) * 100;
    const diskUsagePercent = (stats.disk.used / stats.disk.total) * 100;
    
    // Determina il colore in base allo stato
    const getCpuColor = () => {
      if (stats.cpu.usage >= thresholds.cpu.critical) return '#E74C3C';
      if (stats.cpu.usage >= thresholds.cpu.warning) return '#F39C12';
      return '#2ECC71';
    };
    
    const getMemoryColor = () => {
      if (memoryUsagePercent >= thresholds.memory.critical) return '#E74C3C';
      if (memoryUsagePercent >= thresholds.memory.warning) return '#F39C12';
      return '#2ECC71';
    };
    
    const getDiskColor = () => {
      if (diskUsagePercent >= thresholds.disk.critical) return '#E74C3C';
      if (diskUsagePercent >= thresholds.disk.warning) return '#F39C12';
      return '#2ECC71';
    };
    
    // Formatta il tempo di uptime
    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      return `${days}d ${hours}h ${minutes}m`;
    };
    
    // Crea le barre di progresso
    const createProgressBar = (percentage: number) => {
      const fullBlocks = Math.floor(percentage / 10);
      let bar = '';
      
      for (let i = 0; i < 10; i++) {
        if (i < fullBlocks) {
          bar += '█';
        } else {
          bar += '░';
        }
      }
      
      return bar;
    };
    
    const cpuBar = createProgressBar(stats.cpu.usage);
    const memoryBar = createProgressBar(memoryUsagePercent);
    const diskBar = createProgressBar(diskUsagePercent);
    
    // Crea l'embed
    const embed = new EmbedBuilder()
      .setTitle('🖥️ Statistiche di sistema')
      .setDescription('Statistiche attuali del sistema che ospita i server di gioco.')
      .setColor('#3498DB')
      .addFields(
        { 
          name: `CPU (${stats.cpu.cores} core)`, 
          value: `${cpuBar} ${stats.cpu.usage.toFixed(1)}%\nTemperatura: ${stats.cpu.temperature}°C`, 
          inline: false 
        },
        { 
          name: 'Memoria RAM', 
          value: `${memoryBar} ${memoryUsagePercent.toFixed(1)}%\n${(stats.memory.used / 1024).toFixed(1)} GB / ${(stats.memory.total / 1024).toFixed(1)} GB`, 
          inline: false 
        },
        { 
          name: 'Spazio Disco', 
          value: `${diskBar} ${diskUsagePercent.toFixed(1)}%\n${stats.disk.used} GB / ${stats.disk.total} GB`, 
          inline: false 
        },
        { 
          name: 'Tempo di attività', 
          value: formatUptime(stats.uptime), 
          inline: true 
        }
      )
      .setFooter({ text: 'Dati aggiornati al' })
      .setTimestamp();
    
    // Crea pulsanti per aggiornare e per la diagnostica
    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_system_stats')
      .setLabel('Aggiorna')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄');
    
    const diagnosticsButton = new ButtonBuilder()
      .setCustomId('run_system_diagnostics')
      .setLabel('Diagnostica')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(refreshButton, diagnosticsButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  },
  
  // Visualizza le statistiche della rete
  async showNetworkStats(interaction: ChatInputCommandInteraction) {
    const stats = mockSystemStats;
    
    // Determina il colore in base al ping
    const getPingColor = () => {
      if (stats.network.ping >= thresholds.network.ping.critical) return '#E74C3C';
      if (stats.network.ping >= thresholds.network.ping.warning) return '#F39C12';
      return '#2ECC71';
    };
    
    // Crea l'embed
    const embed = new EmbedBuilder()
      .setTitle('🌐 Statistiche di rete')
      .setDescription('Prestazioni della rete WireGuard e connessione internet.')
      .setColor('#3498DB')
      .addFields(
        { 
          name: '⬇️ Download', 
          value: `${stats.network.download.toFixed(1)} Mbps`, 
          inline: true 
        },
        { 
          name: '⬆️ Upload', 
          value: `${stats.network.upload.toFixed(1)} Mbps`, 
          inline: true 
        },
        { 
          name: '📊 Ping', 
          value: `${stats.network.ping.toFixed(1)} ms`, 
          inline: true 
        }
      )
      .setFooter({ text: 'Dati aggiornati al' })
      .setTimestamp();
    
    // Aggiungi statistiche di utilizzo settimanale (fittizio)
    const todayStats = statsHistory[statsHistory.length - 1];
    const weekAgoStats = statsHistory[0];
    
    // Calcola medie settimanali
    const averageCpu = statsHistory.reduce((sum, point) => sum + point.cpu, 0) / statsHistory.length;
    const averageMemory = statsHistory.reduce((sum, point) => sum + point.memory, 0) / statsHistory.length;
    const averagePing = statsHistory.reduce((sum, point) => sum + point.network.ping, 0) / statsHistory.length;
    
    embed.addFields(
      { 
        name: '📈 Statistiche settimanali', 
        value: `CPU media: ${averageCpu.toFixed(1)}%\nRAM media: ${averageMemory.toFixed(1)}%\nPing medio: ${averagePing.toFixed(1)} ms`, 
        inline: false 
      }
    );
    
    // Ottieni i dati per i picchi di traffico
    const peakDownload = Math.max(...statsHistory.map(point => point.network.download));
    const peakUpload = Math.max(...statsHistory.map(point => point.network.upload));
    const peakTime = statsHistory.find(point => 
      point.network.download === peakDownload || point.network.upload === peakUpload
    )?.timestamp;
    
    if (peakTime) {
      embed.addFields(
        { 
          name: '🔝 Picco di traffico', 
          value: `⬇️ ${peakDownload.toFixed(1)} Mbps / ⬆️ ${peakUpload.toFixed(1)} Mbps\nRegistrato il ${peakTime.toLocaleDateString('it-IT')} alle ${peakTime.toLocaleTimeString('it-IT')}`, 
          inline: false 
        }
      );
    }
    
    // Crea pulsanti per aggiornare e per i test
    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_network_stats')
      .setLabel('Aggiorna')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄');
    
    const speedTestButton = new ButtonBuilder()
      .setCustomId('run_speed_test')
      .setLabel('Speed Test')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚡');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(refreshButton, speedTestButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  },
  
  // Visualizza lo stato dei server di gioco
  async showServerStats(interaction: ChatInputCommandInteraction) {
    // Ottieni tutti i server dal database
    const servers = await storage.getAllServers();
    
    // Se non ci sono server, mostra un messaggio
    if (servers.length === 0) {
      return interaction.reply({
        content: '❌ Nessun server di gioco trovato nel sistema.',
        ephemeral: true
      });
    }
    
    // Raggruppa i server per stato
    const onlineServers = servers.filter(server => server.status === 'online');
    const offlineServers = servers.filter(server => server.status === 'offline');
    const startingServers = servers.filter(server => 
      server.status === 'starting' || server.status === 'restarting'
    );
    const stoppingServers = servers.filter(server => server.status === 'stopping');
    
    // Raggruppa i server per tipo
    const serversByType: Record<string, number> = {};
    servers.forEach(server => {
      if (!serversByType[server.type]) {
        serversByType[server.type] = 0;
      }
      if (server.status === 'online') {
        serversByType[server.type]++;
      }
    });
    
    // Calcola il numero totale di giocatori
    const totalPlayers = onlineServers.reduce((sum, server) => sum + (server.currentPlayers || 0), 0);
    const maxPlayers = onlineServers.reduce((sum, server) => sum + (server.maxPlayers || 0), 0);
    
    // Crea l'embed
    const embed = new EmbedBuilder()
      .setTitle('🎮 Stato dei server di gioco')
      .setDescription(`Panoramica dell'infrastruttura di gioco.`)
      .setColor('#3498DB')
      .addFields(
        { 
          name: '📊 Riepilogo', 
          value: `Server totali: **${servers.length}**\nServer online: **${onlineServers.length}**\nGiocatori: **${totalPlayers}/${maxPlayers}**`, 
          inline: false 
        }
      )
      .setFooter({ text: 'Dati aggiornati al' })
      .setTimestamp();
    
    // Aggiungi i server online
    if (onlineServers.length > 0) {
      const onlineServersText = onlineServers.map(server => 
        `${server.name}: ${server.currentPlayers}/${server.maxPlayers} giocatori`
      ).join('\n');
      
      embed.addFields(
        { 
          name: '🟢 Server online', 
          value: onlineServersText, 
          inline: false 
        }
      );
    }
    
    // Aggiungi i server in avvio/riavvio
    if (startingServers.length > 0) {
      const startingServersText = startingServers.map(server => 
        `${server.name} (${server.status === 'starting' ? 'in avvio' : 'in riavvio'})`
      ).join('\n');
      
      embed.addFields(
        { 
          name: '🔄 Server in avvio/riavvio', 
          value: startingServersText, 
          inline: false 
        }
      );
    }
    
    // Aggiungi i server in arresto
    if (stoppingServers.length > 0) {
      const stoppingServersText = stoppingServers.map(server => 
        `${server.name}`
      ).join('\n');
      
      embed.addFields(
        { 
          name: '🔄 Server in arresto', 
          value: stoppingServersText, 
          inline: false 
        }
      );
    }
    
    // Aggiungi breakdown per tipo di server
    const serverTypeText = Object.entries(serversByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join('\n');
    
    if (serverTypeText) {
      embed.addFields(
        { 
          name: '🎯 Server per tipo', 
          value: serverTypeText, 
          inline: false 
        }
      );
    }
    
    // Crea pulsanti per aggiornare e per avviare tutti i server
    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_server_stats')
      .setLabel('Aggiorna')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄');
    
    const startAllButton = new ButtonBuilder()
      .setCustomId('start_all_servers')
      .setLabel('Avvia tutti')
      .setStyle(ButtonStyle.Success)
      .setEmoji('▶️')
      .setDisabled(offlineServers.length === 0);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(refreshButton, startAllButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  },
  
  // Esegue una diagnostica completa del sistema
  async runDiagnostics(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    // Simula l'esecuzione della diagnostica
    const stats = mockSystemStats;
    
    // Simula le verifiche di diagnostica
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Risultati della diagnostica
    const diagnosticResults = {
      cpu: {
        status: stats.cpu.usage < thresholds.cpu.warning ? 'ok' : 'warning',
        message: stats.cpu.usage < thresholds.cpu.warning 
          ? 'CPU in stato ottimale' 
          : 'Utilizzo CPU elevato. Considerare la riduzione del carico.',
        details: `Utilizzo: ${stats.cpu.usage.toFixed(1)}%, Temperatura: ${stats.cpu.temperature}°C`
      },
      memory: {
        status: (stats.memory.used / stats.memory.total) * 100 < thresholds.memory.warning ? 'ok' : 'warning',
        message: (stats.memory.used / stats.memory.total) * 100 < thresholds.memory.warning
          ? 'Memoria in stato ottimale'
          : 'Utilizzo memoria elevato. Considerare la chiusura di alcuni processi.',
        details: `Utilizzata: ${(stats.memory.used / 1024).toFixed(1)} GB / ${(stats.memory.total / 1024).toFixed(1)} GB`
      },
      disk: {
        status: (stats.disk.used / stats.disk.total) * 100 < thresholds.disk.warning ? 'ok' : 'warning',
        message: (stats.disk.used / stats.disk.total) * 100 < thresholds.disk.warning
          ? 'Spazio disco sufficiente'
          : 'Spazio disco limitato. Considerare la pulizia di file non necessari.',
        details: `Utilizzato: ${stats.disk.used} GB / ${stats.disk.total} GB`
      },
      network: {
        status: stats.network.ping < thresholds.network.ping.warning ? 'ok' : 'warning',
        message: stats.network.ping < thresholds.network.ping.warning
          ? 'Rete in stato ottimale'
          : 'Latenza di rete elevata. Possibili problemi di connessione.',
        details: `Ping: ${stats.network.ping.toFixed(1)} ms, Download: ${stats.network.download.toFixed(1)} Mbps, Upload: ${stats.network.upload.toFixed(1)} Mbps`
      },
      servers: {
        status: 'ok',
        message: 'Tutti i server di gioco sono operativi',
        details: 'Nessun errore rilevato nei server di gioco'
      },
      firewall: {
        status: 'ok',
        message: 'Configurazione firewall corretta',
        details: 'Tutte le porte necessarie sono accessibili'
      },
      dns: {
        status: 'ok',
        message: 'Risoluzione DNS funzionante',
        details: 'Nessun problema di risoluzione nomi'
      }
    };
    
    // Determina lo stato generale
    const getOverallStatus = () => {
      if (Object.values(diagnosticResults).some(r => r.status === 'critical')) {
        return { status: 'critical', color: '#E74C3C', emoji: '🔴' };
      }
      if (Object.values(diagnosticResults).some(r => r.status === 'warning')) {
        return { status: 'warning', color: '#F39C12', emoji: '⚠️' };
      }
      return { status: 'ok', color: '#2ECC71', emoji: '✅' };
    };
    
    const overallStatus = getOverallStatus();
    
    // Crea l'embed
    const embed = new EmbedBuilder()
      .setTitle(`${overallStatus.emoji} Diagnostica di sistema`)
      .setDescription(`Risultati della diagnostica completa del sistema.`)
      .setColor(overallStatus.color as ColorResolvable)
      .addFields(
        { 
          name: `${diagnosticResults.cpu.status === 'ok' ? '✅' : '⚠️'} CPU`, 
          value: `${diagnosticResults.cpu.message}\n${diagnosticResults.cpu.details}`, 
          inline: false 
        },
        { 
          name: `${diagnosticResults.memory.status === 'ok' ? '✅' : '⚠️'} Memoria`, 
          value: `${diagnosticResults.memory.message}\n${diagnosticResults.memory.details}`, 
          inline: false 
        },
        { 
          name: `${diagnosticResults.disk.status === 'ok' ? '✅' : '⚠️'} Spazio Disco`, 
          value: `${diagnosticResults.disk.message}\n${diagnosticResults.disk.details}`, 
          inline: false 
        },
        { 
          name: `${diagnosticResults.network.status === 'ok' ? '✅' : '⚠️'} Rete`, 
          value: `${diagnosticResults.network.message}\n${diagnosticResults.network.details}`, 
          inline: false 
        },
        { 
          name: `${diagnosticResults.servers.status === 'ok' ? '✅' : '⚠️'} Server di gioco`, 
          value: diagnosticResults.servers.message, 
          inline: false 
        },
        { 
          name: `${diagnosticResults.firewall.status === 'ok' ? '✅' : '⚠️'} Firewall`, 
          value: diagnosticResults.firewall.message, 
          inline: true 
        },
        { 
          name: `${diagnosticResults.dns.status === 'ok' ? '✅' : '⚠️'} DNS`, 
          value: diagnosticResults.dns.message, 
          inline: true 
        }
      )
      .setFooter({ text: `Diagnostica eseguita da ${interaction.user.tag} il` })
      .setTimestamp();
    
    // Aggiungi raccomandazioni se ci sono problemi
    const hasWarnings = Object.values(diagnosticResults).some(r => r.status !== 'ok');
    
    if (hasWarnings) {
      const recommendations = [
        'Considerare il riavvio dei server con utilizzo alto di risorse',
        'Verificare la presenza di processi non necessari',
        'Controllare la configurazione di rete per possibili bottlenecks',
        'Monitorare la situazione nelle prossime ore'
      ].join('\n• ');
      
      embed.addFields(
        { 
          name: '📋 Raccomandazioni', 
          value: `• ${recommendations}`, 
          inline: false 
        }
      );
    }
    
    // Crea pulsante per aggiornare
    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_diagnostics')
      .setLabel('Ripeti diagnostica')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(refreshButton);
    
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
  
  // Ottieni il nome del tipo di risorsa
  getTipoName(tipo: string): string {
    switch (tipo) {
      case 'cpu':
        return 'CPU';
      case 'memory':
        return 'Memoria';
      case 'disk':
        return 'Spazio disco';
      case 'network_ping':
        return 'Ping di rete';
      default:
        return tipo;
    }
  },
  
  // Gestisci le interazioni con i pulsanti
  /**
   * Mostra le risorse dei server Pterodactyl
   */
  async showPterodactylResources(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    try {
      // Ottieni lo stato attuale del monitoraggio
      const monitoringStatus = resourceMonitor.getMonitoringStatus();
      
      // Verifica se il monitoraggio è abilitato
      if (!monitoringStatus.enabled) {
        return interaction.editReply({
          content: '⚠️ Il monitoraggio delle risorse Pterodactyl non è attualmente abilitato. Usa `/monitor-alerts configura` per attivarlo.'
        });
      }
      
      // Ottieni i server Pterodactyl
      const pterodactylServers = await pterodactyl.getServers();
      
      if (!pterodactylServers || pterodactylServers.length === 0) {
        return interaction.editReply({
          content: '❌ Non sono stati trovati server Pterodactyl o l\'API Pterodactyl non è configurata correttamente.'
        });
      }
      
      // Controlla le risorse per ogni server
      const resourcePromises = pterodactylServers.map(server => 
        resourceMonitor.checkServerResources(server.identifier)
      );
      
      // Attendi che tutte le promesse siano risolte
      const resourceResults = await Promise.all(resourcePromises.map(p => p.catch(e => null)));
      
      // Filtra i risultati validi
      const validResults = resourceResults.filter(result => result !== null);
      
      if (validResults.length === 0) {
        return interaction.editReply({
          content: '❌ Non è stato possibile ottenere informazioni sulle risorse dei server Pterodactyl.'
        });
      }
      
      // Crea un embed per mostrare le risorse
      const embed = new EmbedBuilder()
        .setTitle('🖥️ Monitoraggio Risorse Server Pterodactyl')
        .setDescription(`Stato delle risorse per ${validResults.length} server monitorati.`)
        .setColor('#3498DB')
        .setTimestamp();
      
      // Aggiungi i campi per ogni server e risultato
      for (let i = 0; i < validResults.length; i++) {
        const result = validResults[i];
        if (!result) continue;
        
        const server = pterodactylServers[i];
        if (!server) continue;
        
        // Formatta i valori di memoria per renderli più leggibili
        const formatBytes = (bytes: number): string => {
          const gigabytes = bytes / 1024 / 1024 / 1024;
          if (gigabytes >= 1) {
            return `${gigabytes.toFixed(1)} GB`;
          } else {
            const megabytes = bytes / 1024 / 1024;
            return `${Math.round(megabytes)} MB`;
          }
        };
        
        // Ottieni i valori di utilizzo
        const memoryUsed = formatBytes(result.memory.current);
        const memoryTotal = formatBytes(result.memory.limit);
        const memoryPercent = Math.round(result.memory.percent);
        
        const cpuPercent = Math.round(result.cpu.percent);
        
        const diskUsed = formatBytes(result.disk.current);
        const diskTotal = formatBytes(result.disk.limit);
        const diskPercent = Math.round(result.disk.percent);
        
        // Determina gli emoji di stato in base alle soglie
        const getEmoji = (value: number, type: 'cpu' | 'memory' | 'disk') => {
          const threshold = monitoringStatus.thresholds[type];
          if (value >= threshold.critical) return "🔴";
          if (value >= threshold.warning) return "⚠️";
          return "✅";
        };
        
        const cpuEmoji = getEmoji(cpuPercent, 'cpu');
        const memoryEmoji = getEmoji(memoryPercent, 'memory');
        const diskEmoji = getEmoji(diskPercent, 'disk');
        
        // Aggiungi il campo per questo server
        embed.addFields({
          name: `${server.name} (${result.status})`,
          value: [
            `${cpuEmoji} CPU: ${cpuPercent}%`,
            `${memoryEmoji} RAM: ${memoryPercent}% (${memoryUsed}/${memoryTotal})`,
            `${diskEmoji} Disco: ${diskPercent}% (${diskUsed}/${diskTotal})`
          ].join('\n'),
          inline: false
        });
      }
      
      // Aggiungi informazioni sulle soglie configurate
      embed.addFields({
        name: '⚙️ Soglie configurate',
        value: [
          `CPU: ⚠️ ${monitoringStatus.thresholds.cpu.warning}% | 🔴 ${monitoringStatus.thresholds.cpu.critical}%`,
          `Memoria: ⚠️ ${monitoringStatus.thresholds.memory.warning}% | 🔴 ${monitoringStatus.thresholds.memory.critical}%`,
          `Disco: ⚠️ ${monitoringStatus.thresholds.disk.warning}% | 🔴 ${monitoringStatus.thresholds.disk.critical}%`
        ].join('\n'),
        inline: false
      });
      
      // Aggiungi pulsante per aggiornare
      const refreshButton = new ButtonBuilder()
        .setCustomId('refresh_pterodactyl_resources')
        .setLabel('Aggiorna')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄');
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(refreshButton);
      
      return interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });
    } catch (error) {
      console.error('Errore durante il controllo delle risorse Pterodactyl:', error);
      return interaction.editReply({
        content: '❌ Si è verificato un errore durante il recupero delle risorse dei server Pterodactyl.'
      });
    }
  },
  
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;
      
      if (customId === 'refresh_pterodactyl_resources') {
        // Per i pulsanti, dobbiamo gestire direttamente l'interazione
        await interaction.deferUpdate();
        
        try {
          // Ottieni lo stato attuale del monitoraggio
          const monitoringStatus = resourceMonitor.getMonitoringStatus();
          
          // Verifica se il monitoraggio è abilitato
          if (!monitoringStatus.enabled) {
            return interaction.editReply({
              content: '⚠️ Il monitoraggio delle risorse Pterodactyl non è attualmente abilitato.'
            });
          }
          
          // Ottieni i server Pterodactyl
          const pterodactylServers = await pterodactyl.getServers();
          
          if (!pterodactylServers || pterodactylServers.length === 0) {
            return interaction.editReply({
              content: '❌ Non sono stati trovati server Pterodactyl o l\'API Pterodactyl non è configurata correttamente.'
            });
          }
          
          // Controlla le risorse per ogni server
          const resourcePromises = pterodactylServers.map(server => 
            resourceMonitor.checkServerResources(server.identifier)
          );
          
          // Attendi che tutte le promesse siano risolte
          const resourceResults = await Promise.all(resourcePromises.map(p => p.catch(e => null)));
          
          // Filtra i risultati validi
          const validResults = resourceResults.filter(result => result !== null);
          
          if (validResults.length === 0) {
            return interaction.editReply({
              content: '❌ Non è stato possibile ottenere informazioni sulle risorse dei server Pterodactyl.'
            });
          }
          
          // Crea un embed per mostrare le risorse
          const embed = new EmbedBuilder()
            .setTitle('🖥️ Monitoraggio Risorse Server Pterodactyl')
            .setDescription(`Stato delle risorse per ${validResults.length} server monitorati.`)
            .setColor('#3498DB')
            .setTimestamp();
          
          // Aggiungi i campi per ogni server e risultato
          for (let i = 0; i < validResults.length; i++) {
            const result = validResults[i];
            if (!result) continue;
            
            const server = pterodactylServers[i];
            if (!server) continue;
            
            // Formatta i valori di memoria per renderli più leggibili
            const formatBytes = (bytes: number): string => {
              const gigabytes = bytes / 1024 / 1024 / 1024;
              if (gigabytes >= 1) {
                return `${gigabytes.toFixed(1)} GB`;
              } else {
                const megabytes = bytes / 1024 / 1024;
                return `${Math.round(megabytes)} MB`;
              }
            };
            
            // Ottieni i valori di utilizzo
            const memoryUsed = formatBytes(result.memory.current);
            const memoryTotal = formatBytes(result.memory.limit);
            const memoryPercent = Math.round(result.memory.percent);
            
            const cpuPercent = Math.round(result.cpu.percent);
            
            const diskUsed = formatBytes(result.disk.current);
            const diskTotal = formatBytes(result.disk.limit);
            const diskPercent = Math.round(result.disk.percent);
            
            // Determina gli emoji di stato in base alle soglie
            const getEmoji = (value: number, type: 'cpu' | 'memory' | 'disk') => {
              const threshold = monitoringStatus.thresholds[type];
              if (value >= threshold.critical) return "🔴";
              if (value >= threshold.warning) return "⚠️";
              return "✅";
            };
            
            const cpuEmoji = getEmoji(cpuPercent, 'cpu');
            const memoryEmoji = getEmoji(memoryPercent, 'memory');
            const diskEmoji = getEmoji(diskPercent, 'disk');
            
            // Aggiungi il campo per questo server
            embed.addFields({
              name: `${server.name} (${result.status})`,
              value: [
                `${cpuEmoji} CPU: ${cpuPercent}%`,
                `${memoryEmoji} RAM: ${memoryPercent}% (${memoryUsed}/${memoryTotal})`,
                `${diskEmoji} Disco: ${diskPercent}% (${diskUsed}/${diskTotal})`
              ].join('\n'),
              inline: false
            });
          }
          
          // Aggiungi informazioni sulle soglie configurate
          embed.addFields({
            name: '⚙️ Soglie configurate',
            value: [
              `CPU: ⚠️ ${monitoringStatus.thresholds.cpu.warning}% | 🔴 ${monitoringStatus.thresholds.cpu.critical}%`,
              `Memoria: ⚠️ ${monitoringStatus.thresholds.memory.warning}% | 🔴 ${monitoringStatus.thresholds.memory.critical}%`,
              `Disco: ⚠️ ${monitoringStatus.thresholds.disk.warning}% | 🔴 ${monitoringStatus.thresholds.disk.critical}%`
            ].join('\n'),
            inline: false
          });
          
          // Aggiungi pulsante per aggiornare
          const refreshButton = new ButtonBuilder()
            .setCustomId('refresh_pterodactyl_resources')
            .setLabel('Aggiorna')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');
          
          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
          
          return interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
          });
        } catch (error) {
          console.error('Errore durante il controllo delle risorse Pterodactyl:', error);
          return interaction.editReply({
            content: '❌ Si è verificato un errore durante il recupero delle risorse dei server Pterodactyl.'
          });
        }
        
        return;
      }
      else if (customId === 'refresh_system_stats') {
        await interaction.deferUpdate();
        await this.showSystemStats(interaction);
      }
      else if (customId === 'refresh_network_stats') {
        await interaction.deferUpdate();
        await this.showNetworkStats(interaction);
      }
      else if (customId === 'refresh_server_stats') {
        await interaction.deferUpdate();
        await this.showServerStats(interaction);
      }
      else if (customId === 'refresh_diagnostics') {
        await interaction.deferUpdate();
        await this.runDiagnostics(interaction);
      }
      else if (customId === 'run_system_diagnostics') {
        await interaction.deferUpdate();
        await this.runDiagnostics(interaction);
      }
      else if (customId === 'run_speed_test') {
        await interaction.deferReply({ ephemeral: true });
        
        // Simula l'esecuzione di uno speed test
        await interaction.editReply('⏳ Esecuzione speed test in corso...');
        
        // Simula l'attesa
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Genera risultati casuali dello speed test
        const downloadSpeed = Math.floor(Math.random() * 500) + 500; // 500-1000 Mbps
        const uploadSpeed = Math.floor(Math.random() * 100) + 50; // 50-150 Mbps
        const ping = Math.floor(Math.random() * 10) + 1; // 1-11 ms
        const jitter = Math.floor(Math.random() * 5) + 1; // 1-6 ms
        
        // Crea l'embed con i risultati
        const embed = new EmbedBuilder()
          .setTitle('⚡ Risultati Speed Test')
          .setDescription('Test completato con successo.')
          .setColor('#3498DB')
          .addFields(
            { name: '⬇️ Download', value: `${downloadSpeed} Mbps`, inline: true },
            { name: '⬆️ Upload', value: `${uploadSpeed} Mbps`, inline: true },
            { name: '📊 Ping', value: `${ping} ms`, inline: true },
            { name: '📈 Jitter', value: `${jitter} ms`, inline: true },
            { name: '🌐 Server', value: 'Milano, IT', inline: true },
            { name: '🔍 Provider', value: 'Fastweb', inline: true }
          )
          .setFooter({ text: `Test eseguito da ${interaction.user.tag} il` })
          .setTimestamp();
        
        await interaction.editReply({ content: null, embeds: [embed] });
      }
      else if (customId === 'start_all_servers') {
        await interaction.deferReply({ ephemeral: true });
        
        // Ottieni tutti i server offline
        const servers = await storage.getAllServers();
        const offlineServers = servers.filter(server => server.status === 'offline');
        
        if (offlineServers.length === 0) {
          return interaction.editReply({ content: '✅ Tutti i server sono già online.' });
        }
        
        // Chiedi conferma
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Conferma avvio')
          .setDescription(`Stai per avviare **${offlineServers.length}** server offline. Questa operazione potrebbe richiedere tempo e risorse significative. Sei sicuro di voler continuare?`)
          .setColor('#F39C12')
          .addFields(
            { 
              name: 'Server da avviare', 
              value: offlineServers.map(server => server.name).join('\n'), 
              inline: false 
            }
          )
          .setFooter({ text: `Richiesto da ${interaction.user.tag}` })
          .setTimestamp();
        
        // Bottoni di conferma e annullamento
        const confirmButton = new ButtonBuilder()
          .setCustomId('confirm_start_all')
          .setLabel('Conferma avvio')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️');
        
        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel_start_all')
          .setLabel('Annulla')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(confirmButton, cancelButton);
        
        await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
      }
      else if (customId === 'confirm_start_all') {
        await interaction.deferUpdate();
        
        // Ottieni tutti i server offline
        const servers = await storage.getAllServers();
        const offlineServers = servers.filter(server => server.status === 'offline');
        
        if (offlineServers.length === 0) {
          return interaction.editReply({ content: '✅ Tutti i server sono già online.', components: [] });
        }
        
        // Aggiorna il messaggio per mostrare l'avanzamento
        const embed = new EmbedBuilder()
          .setTitle('🚀 Avvio server in corso...')
          .setDescription(`Avvio di ${offlineServers.length} server in corso. Questo processo potrebbe richiedere alcuni minuti.`)
          .setColor('#3498DB')
          .setFooter({ text: `Richiesto da ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed], components: [] });
        
        // Simula l'avvio di ogni server (in una implementazione reale, useremmo un processo asincrono)
        for (const server of offlineServers) {
          // Aggiorna lo stato del server a 'starting'
          await storage.updateServer(server.id, { status: 'starting' });
          
          // Simula l'attesa per l'avvio
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Aggiorna lo stato del server a 'online'
          await storage.updateServer(server.id, { 
            status: 'online',
            currentPlayers: 0
          });
          
          // Aggiorna l'embed per mostrare l'avanzamento
          const startedServers = offlineServers.indexOf(server) + 1;
          
          const progressEmbed = new EmbedBuilder()
            .setTitle('🚀 Avvio server in corso...')
            .setDescription(`Server avviati: ${startedServers}/${offlineServers.length}`)
            .setColor('#3498DB')
            .addFields(
              { name: 'Server completati', value: offlineServers.slice(0, startedServers).map(s => `✅ ${s.name}`).join('\n'), inline: false }
            )
            .setFooter({ text: `Richiesto da ${interaction.user.tag}` })
            .setTimestamp();
          
          if (startedServers < offlineServers.length) {
            progressEmbed.addFields(
              { name: 'In attesa', value: offlineServers.slice(startedServers).map(s => `⏳ ${s.name}`).join('\n'), inline: false }
            );
          }
          
          await interaction.editReply({ embeds: [progressEmbed] });
        }
        
        // Tutti i server sono stati avviati, mostra un messaggio finale
        const completeEmbed = new EmbedBuilder()
          .setTitle('✅ Avvio server completato')
          .setDescription(`Tutti i ${offlineServers.length} server sono stati avviati con successo.`)
          .setColor('#2ECC71')
          .addFields(
            { name: 'Server avviati', value: offlineServers.map(server => `✅ ${server.name}`).join('\n'), inline: false }
          )
          .setFooter({ text: `Richiesto da ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [completeEmbed] });
      }
      else if (customId === 'cancel_start_all') {
        await interaction.update({
          content: '❌ Operazione annullata.',
          embeds: [],
          components: []
        });
      }
      
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione con i pulsanti:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Si è verificato un errore durante l\'elaborazione della richiesta. Riprova più tardi.',
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          content: 'Si è verificato un errore durante l\'elaborazione della richiesta. Riprova più tardi.',
          ephemeral: true
        });
      }
    }
  }
};