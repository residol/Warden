import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import * as resourceMonitor from '../services/monitor';
import { pterodactyl } from '../services/pterodactyl';

export default {
  data: new SlashCommandBuilder()
    .setName('monitor-alerts')
    .setDescription('Gestisci gli avvisi di monitoraggio delle risorse')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configura le soglie di avviso per il monitoraggio delle risorse')
        .addNumberOption(option =>
          option
            .setName('memory-warning')
            .setDescription('Soglia di avviso per l\'utilizzo memoria (percentuale)')
            .setMinValue(50)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('memory-critical')
            .setDescription('Soglia critica per l\'utilizzo memoria (percentuale)')
            .setMinValue(75)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('cpu-warning')
            .setDescription('Soglia di avviso per l\'utilizzo CPU (percentuale)')
            .setMinValue(50)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('cpu-critical')
            .setDescription('Soglia critica per l\'utilizzo CPU (percentuale)')
            .setMinValue(75)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('disk-warning')
            .setDescription('Soglia di avviso per l\'utilizzo disco (percentuale)')
            .setMinValue(50)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('disk-critical')
            .setDescription('Soglia critica per l\'utilizzo disco (percentuale)')
            .setMinValue(75)
            .setMaxValue(100)
        )
        .addNumberOption(option =>
          option
            .setName('intervallo')
            .setDescription('Intervallo tra i controlli (minuti)')
            .setMinValue(1)
            .setMaxValue(60)
        )
        .addNumberOption(option =>
          option
            .setName('cooldown')
            .setDescription('Tempo minimo tra avvisi consecutivi per lo stesso server (minuti)')
            .setMinValue(5)
            .setMaxValue(1440) // 24 ore
        )
        .addStringOption(option =>
          option
            .setName('stato')
            .setDescription('Abilita o disabilita il monitoraggio automatico')
            .setChoices(
              { name: 'Attivo', value: 'enabled' },
              { name: 'Disattivato', value: 'disabled' }
            )
        )
        .addChannelOption(option =>
          option
            .setName('canale')
            .setDescription('Canale dove inviare gli avvisi')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Mostra lo stato attuale del monitoraggio delle risorse')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Controlla manualmente le risorse di un server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del server Pterodactyl')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Mette in pausa il monitoraggio automatico')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Riprende il monitoraggio automatico')
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Controlla se Pterodactyl è configurato
      if (!pterodactyl.isReady()) {
        return interaction.reply({
          content: '⚠️ **Pterodactyl non è configurato correttamente.**\nVerifica che la chiave API e l\'URL siano impostati nelle variabili d\'ambiente.',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'config':
          await this.configureMonitoring(interaction, client);
          break;
        case 'status':
          await this.showMonitoringStatus(interaction);
          break;
        case 'check':
          const serverId = interaction.options.getString('id', true);
          await this.checkServerResources(interaction, serverId);
          break;
        case 'pause':
          resourceMonitor.pauseMonitoring();
          await interaction.reply({
            content: '⏸️ Monitoraggio delle risorse in pausa. Usa `/monitor-alerts resume` per ripristinarlo.',
            ephemeral: false
          });
          break;
        case 'resume':
          resourceMonitor.resumeMonitoring();
          await interaction.reply({
            content: '▶️ Monitoraggio delle risorse ripristinato.',
            ephemeral: false
          });
          break;
      }
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando monitor-alerts:', error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Si è verificato un errore durante l\'esecuzione del comando. Controlla i log per maggiori dettagli.'
        });
      } else {
        await interaction.reply({
          content: '❌ Si è verificato un errore durante l\'esecuzione del comando. Controlla i log per maggiori dettagli.',
          ephemeral: true
        });
      }
    }
  },

  /**
   * Configura il monitoraggio delle risorse
   */
  async configureMonitoring(interaction: ChatInputCommandInteraction, client: Client) {
    // Ottieni le opzioni di configurazione
    const memoryWarning = interaction.options.getNumber('memory-warning');
    const memoryCritical = interaction.options.getNumber('memory-critical');
    const cpuWarning = interaction.options.getNumber('cpu-warning');
    const cpuCritical = interaction.options.getNumber('cpu-critical');
    const diskWarning = interaction.options.getNumber('disk-warning');
    const diskCritical = interaction.options.getNumber('disk-critical');
    const checkInterval = interaction.options.getNumber('intervallo');
    const cooldown = interaction.options.getNumber('cooldown');
    const status = interaction.options.getString('stato');
    const alertChannel = interaction.options.getChannel('canale');
    
    // Costruisci l'oggetto di configurazione
    const config: any = {};
    
    if (memoryWarning !== null) config.resources = { ...(config.resources || {}), memory: { ...(config.resources?.memory || {}), warning: memoryWarning } };
    if (memoryCritical !== null) config.resources = { ...(config.resources || {}), memory: { ...(config.resources?.memory || {}), critical: memoryCritical } };
    
    if (cpuWarning !== null) config.resources = { ...(config.resources || {}), cpu: { ...(config.resources?.cpu || {}), warning: cpuWarning } };
    if (cpuCritical !== null) config.resources = { ...(config.resources || {}), cpu: { ...(config.resources?.cpu || {}), critical: cpuCritical } };
    
    if (diskWarning !== null) config.resources = { ...(config.resources || {}), disk: { ...(config.resources?.disk || {}), warning: diskWarning } };
    if (diskCritical !== null) config.resources = { ...(config.resources || {}), disk: { ...(config.resources?.disk || {}), critical: diskCritical } };
    
    if (checkInterval !== null) config.checkInterval = checkInterval;
    if (cooldown !== null) config.cooldown = cooldown;
    if (status !== null) config.enabled = status === 'enabled';
    if (alertChannel !== null) config.alertChannelId = alertChannel.id;
    
    // Aggiorna la configurazione
    resourceMonitor.updateMonitorConfig(config);
    
    // Inizializza il monitoraggio con il client Discord
    if (alertChannel !== null) {
      resourceMonitor.initMonitoring(client, alertChannel.id);
    }
    
    // Costruisci la risposta per l'utente
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configurazione Monitoraggio Risorse')
      .setDescription('Le impostazioni di monitoraggio delle risorse sono state aggiornate.')
      .setColor(0x3498DB)
      .setTimestamp();
    
    // Aggiungi campi per le configurazioni aggiornate
    const configFields = [];
    
    if (status !== null) {
      configFields.push({
        name: '🔄 Stato monitoraggio',
        value: status === 'enabled' ? '✅ Attivo' : '❌ Disattivato',
        inline: true
      });
    }
    
    if (checkInterval !== null) {
      configFields.push({
        name: '⏱️ Intervallo controlli',
        value: `${checkInterval} minuti`,
        inline: true
      });
    }
    
    if (cooldown !== null) {
      configFields.push({
        name: '⏲️ Cooldown avvisi',
        value: `${cooldown} minuti`,
        inline: true
      });
    }
    
    if (alertChannel !== null) {
      configFields.push({
        name: '📢 Canale avvisi',
        value: `<#${alertChannel.id}>`,
        inline: false
      });
    }
    
    const thresholdsUpdated = memoryWarning !== null || memoryCritical !== null || 
                             cpuWarning !== null || cpuCritical !== null || 
                             diskWarning !== null || diskCritical !== null;
    
    if (thresholdsUpdated) {
      let thresholdsText = '';
      
      if (memoryWarning !== null || memoryCritical !== null) {
        thresholdsText += `**Memoria**: ${memoryWarning !== null ? `Avviso ${memoryWarning}%` : ''} ${(memoryWarning !== null && memoryCritical !== null) ? '/ ' : ''}${memoryCritical !== null ? `Critico ${memoryCritical}%` : ''}\n`;
      }
      
      if (cpuWarning !== null || cpuCritical !== null) {
        thresholdsText += `**CPU**: ${cpuWarning !== null ? `Avviso ${cpuWarning}%` : ''} ${(cpuWarning !== null && cpuCritical !== null) ? '/ ' : ''}${cpuCritical !== null ? `Critico ${cpuCritical}%` : ''}\n`;
      }
      
      if (diskWarning !== null || diskCritical !== null) {
        thresholdsText += `**Disco**: ${diskWarning !== null ? `Avviso ${diskWarning}%` : ''} ${(diskWarning !== null && diskCritical !== null) ? '/ ' : ''}${diskCritical !== null ? `Critico ${diskCritical}%` : ''}\n`;
      }
      
      configFields.push({
        name: '📊 Soglie aggiornate',
        value: thresholdsText,
        inline: false
      });
    }
    
    // Se non è stato aggiornato nulla, mostra un messaggio
    if (configFields.length === 0) {
      embed.setDescription('Nessuna impostazione è stata modificata.');
    } else {
      // Aggiungi i campi all'embed
      configFields.forEach(field => {
        embed.addFields(field);
      });
    }
    
    await interaction.reply({ embeds: [embed] });
  },

  /**
   * Mostra lo stato attuale del monitoraggio
   */
  async showMonitoringStatus(interaction: ChatInputCommandInteraction) {
    const status = resourceMonitor.getMonitoringStatus();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Stato Monitoraggio Risorse')
      .setDescription('Informazioni sullo stato attuale del sistema di monitoraggio delle risorse.')
      .setColor(status.enabled ? (status.running ? 0x2ECC71 : 0xF39C12) : 0xE74C3C)
      .setTimestamp();
    
    // Stato generale
    embed.addFields({
      name: '🔄 Stato',
      value: status.enabled 
        ? (status.running ? '✅ Attivo e in esecuzione' : '⏸️ Attivo ma in pausa') 
        : '❌ Disattivato',
      inline: false
    });
    
    // Dettagli della configurazione
    embed.addFields({
      name: '⏱️ Intervallo controlli',
      value: `${status.checkInterval} minuti`,
      inline: true
    });
    
    embed.addFields({
      name: '⏲️ Cooldown avvisi',
      value: `${status.cooldown} minuti`,
      inline: true
    });
    
    // Soglie configurate
    embed.addFields({
      name: '📊 Soglie di avviso',
      value: 
        `**Memoria**: Avviso ${status.thresholds.memory.warning}% / Critico ${status.thresholds.memory.critical}%\n` +
        `**CPU**: Avviso ${status.thresholds.cpu.warning}% / Critico ${status.thresholds.cpu.critical}%\n` +
        `**Disco**: Avviso ${status.thresholds.disk.warning}% / Critico ${status.thresholds.disk.critical}%`,
      inline: false
    });
    
    // Aggiungi pulsanti per azioni rapide
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(status.running ? 'monitor_pause' : 'monitor_resume')
          .setLabel(status.running ? 'Pausa' : 'Riprendi')
          .setStyle(status.running ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setEmoji(status.running ? '⏸️' : '▶️'),
        new ButtonBuilder()
          .setCustomId('monitor_check_all')
          .setLabel('Controlla tutti i server')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔍')
      );
    
    await interaction.reply({ embeds: [embed], components: [row] });
  },

  /**
   * Controlla manualmente le risorse di un server
   */
  async checkServerResources(interaction: ChatInputCommandInteraction, serverId: string) {
    await interaction.deferReply();
    
    const serverInfo = await resourceMonitor.checkServerResources(serverId);
    
    if (!serverInfo) {
      return interaction.editReply({
        content: `❌ Server con ID ${serverId} non trovato o non accessibile.`
      });
    }
    
    // Ottieni server completo per maggiori informazioni
    const servers = await pterodactyl.getServers();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      return interaction.editReply({
        content: `❓ Dati server incompleti per ID ${serverId}.`
      });
    }
    
    // Formattazione
    const formatBytes = (mb: number) => {
      if (mb < 1024) return `${mb.toFixed(0)} MB`;
      return `${(mb / 1024).toFixed(2)} GB`;
    };
    
    const createProgressBar = (percent: number, length = 10) => {
      const filled = Math.round((percent / 100) * length);
      const empty = length - filled;
      return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent.toFixed(1)}%`;
    };
    
    // Valuta lo stato delle risorse
    const memoryStatus = serverInfo.memory.percent >= 95 ? 'critical' : 
                         serverInfo.memory.percent >= 80 ? 'warning' : 'normal';
    
    const cpuStatus = serverInfo.cpu.percent >= 90 ? 'critical' : 
                      serverInfo.cpu.percent >= 70 ? 'warning' : 'normal';
    
    const diskStatus = serverInfo.disk.percent >= 95 ? 'critical' : 
                       serverInfo.disk.percent >= 85 ? 'warning' : 'normal';
    
    // Determina il colore in base allo stato generale
    let color = 0x2ECC71; // Verde di default
    
    if (memoryStatus === 'critical' || cpuStatus === 'critical' || diskStatus === 'critical') {
      color = 0xE74C3C; // Rosso per stato critico
    } else if (memoryStatus === 'warning' || cpuStatus === 'warning' || diskStatus === 'warning') {
      color = 0xF39C12; // Arancione per avvisi
    }
    
    // Emoji per gli stati
    const getStatusEmoji = (status: string) => {
      switch (status) {
        case 'critical': return '🔴';
        case 'warning': return '⚠️';
        default: return '✅';
      }
    };
    
    // Costruisci l'embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Risorse: ${server.name}`)
      .setDescription(`Utilizzo corrente delle risorse per il server **${server.name}**.`)
      .setColor(color)
      .setTimestamp();
    
    // Aggiungi campi per le risorse
    embed.addFields(
      { 
        name: `${getStatusEmoji(memoryStatus)} Memoria`,
        value: `${createProgressBar(serverInfo.memory.percent)}\n${formatBytes(serverInfo.memory.current)} / ${formatBytes(serverInfo.memory.limit)}`,
        inline: false
      },
      { 
        name: `${getStatusEmoji(cpuStatus)} CPU`,
        value: `${createProgressBar(serverInfo.cpu.percent)}\n${serverInfo.cpu.current.toFixed(1)}% / ${serverInfo.cpu.limit}%`,
        inline: false
      },
      { 
        name: `${getStatusEmoji(diskStatus)} Disco`,
        value: `${createProgressBar(serverInfo.disk.percent)}\n${formatBytes(serverInfo.disk.current)} / ${formatBytes(serverInfo.disk.limit)}`,
        inline: false
      }
    );
    
    // Aggiungi altri dettagli del server
    embed.addFields({
      name: '📝 Informazioni Server',
      value: `**Stato**: ${serverInfo.status}\n**Nodo**: ${server.node}\n**ID**: ${serverId}`,
      inline: false
    });
    
    // Suggerimenti in caso di problemi
    if (memoryStatus !== 'normal' || cpuStatus !== 'normal' || diskStatus !== 'normal') {
      let suggestions = '';
      
      if (memoryStatus !== 'normal') {
        suggestions += '• **Memoria alta**: Verifica plugin o mod con memory leak\n';
      }
      
      if (cpuStatus !== 'normal') {
        suggestions += '• **CPU alta**: Riduci redstone, entità o distanza di rendering\n';
      }
      
      if (diskStatus !== 'normal') {
        suggestions += '• **Disco elevato**: Elimina backup vecchi e log non necessari\n';
      }
      
      embed.addFields({
        name: '💡 Suggerimenti',
        value: suggestions,
        inline: false
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  },

  /**
   * Gestisce le interazioni con i pulsanti
   */
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;
      
      if (customId === 'monitor_pause') {
        await interaction.deferUpdate();
        resourceMonitor.pauseMonitoring();
        
        setTimeout(() => this.showMonitoringStatus(interaction), 500);
        return;
      }
      
      if (customId === 'monitor_resume') {
        await interaction.deferUpdate();
        resourceMonitor.resumeMonitoring();
        
        setTimeout(() => this.showMonitoringStatus(interaction), 500);
        return;
      }
      
      if (customId === 'monitor_check_all') {
        await interaction.deferUpdate();
        
        const servers = await pterodactyl.getServers();
        
        if (servers.length === 0) {
          await interaction.followUp({
            content: '❌ Nessun server trovato su Pterodactyl.',
            ephemeral: true
          });
          return;
        }
        
        // Trova il server con l'utilizzo delle risorse più alto
        let highestMemoryUsage = 0;
        let highestCpuUsage = 0;
        let highestDiskUsage = 0;
        
        let highestMemoryServer: string | null = null;
        let highestCpuServer: string | null = null;
        let highestDiskServer: string | null = null;
        
        for (const server of servers) {
          const resources = await resourceMonitor.checkServerResources(server.id);
          
          if (resources) {
            if (resources.memory.percent > highestMemoryUsage) {
              highestMemoryUsage = resources.memory.percent;
              highestMemoryServer = server.id;
            }
            
            if (resources.cpu.percent > highestCpuUsage) {
              highestCpuUsage = resources.cpu.percent;
              highestCpuServer = server.id;
            }
            
            if (resources.disk.percent > highestDiskUsage) {
              highestDiskUsage = resources.disk.percent;
              highestDiskServer = server.id;
            }
          }
        }
        
        // Crea embed con il riepilogo
        const embed = new EmbedBuilder()
          .setTitle('📊 Riepilogo Risorse Server')
          .setDescription(`Scansione di ${servers.length} server Pterodactyl.`)
          .setColor(0x3498DB)
          .setTimestamp();
        
        if (highestMemoryServer) {
          const serverInfo = servers.find(s => s.id === highestMemoryServer);
          embed.addFields({
            name: '💾 Utilizzo Memoria Più Alto',
            value: `**${serverInfo?.name}**: ${highestMemoryUsage.toFixed(1)}%\nUsa \`/monitor-alerts check id:${highestMemoryServer}\` per dettagli`,
            inline: false
          });
        }
        
        if (highestCpuServer) {
          const serverInfo = servers.find(s => s.id === highestCpuServer);
          embed.addFields({
            name: '⚙️ Utilizzo CPU Più Alto',
            value: `**${serverInfo?.name}**: ${highestCpuUsage.toFixed(1)}%\nUsa \`/monitor-alerts check id:${highestCpuServer}\` per dettagli`,
            inline: false
          });
        }
        
        if (highestDiskServer) {
          const serverInfo = servers.find(s => s.id === highestDiskServer);
          embed.addFields({
            name: '💿 Utilizzo Disco Più Alto',
            value: `**${serverInfo?.name}**: ${highestDiskUsage.toFixed(1)}%\nUsa \`/monitor-alerts check id:${highestDiskServer}\` per dettagli`,
            inline: false
          });
        }
        
        await interaction.followUp({ embeds: [embed] });
        return;
      }
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione con i pulsanti:', error);
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Si è verificato un errore durante l\'elaborazione della richiesta.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ Si è verificato un errore durante l\'elaborazione della richiesta.',
            ephemeral: true
          });
        }
      } catch (followupError) {
        console.error('Errore durante l\'invio della risposta di errore:', followupError);
      }
    }
  }
};