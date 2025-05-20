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
import { pterodactyl } from '../services/pterodactyl';
import { storage } from '../storage';

export default {
  data: new SlashCommandBuilder()
    .setName('pterodactyl')
    .setDescription('Monitora e gestisci i server Pterodactyl')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('stato')
        .setDescription('Mostra lo stato del panel Pterodactyl')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Mostra la lista dei server Pterodactyl')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Mostra statistiche dettagliate di un server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del server Pterodactyl')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('risorse')
        .setDescription('Mostra statistiche di utilizzo delle risorse')
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
      
      if (subcommand === 'stato') {
        await this.showPterodactylStatus(interaction);
      }
      else if (subcommand === 'server') {
        await this.showServersList(interaction);
      }
      else if (subcommand === 'stats') {
        const serverId = interaction.options.getString('id', true);
        await this.showServerStats(interaction, serverId);
      }
      else if (subcommand === 'risorse') {
        await this.showResourceUsage(interaction);
      }
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando pterodactyl:', error);
      
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
   * Mostra lo stato generale del panel Pterodactyl
   */
  async showPterodactylStatus(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const status = await pterodactyl.checkStatus();
    
    if (!status.isAvailable) {
      return interaction.editReply({
        content: '❌ **Impossibile connettersi al panel Pterodactyl.**\nVerifica che il servizio sia online e che la configurazione sia corretta.'
      });
    }

    // Conversione memoria e disco in unità più leggibili
    const formatMemory = (mb: number) => {
      if (mb < 1024) return `${mb} MB`;
      return `${(mb / 1024).toFixed(2)} GB`;
    };

    const formatDisk = (mb: number) => {
      if (mb < 1024) return `${mb} MB`;
      return `${(mb / 1024).toFixed(2)} GB`;
    };

    // Crea l'embed di risposta
    const embed = new EmbedBuilder()
      .setTitle('🦅 Stato Panel Pterodactyl')
      .setDescription(`Stato del panel Pterodactyl e panoramica delle risorse.`)
      .setColor(0x3498DB)
      .addFields(
        { name: '🟢 Stato', value: 'Online', inline: true },
        { name: '📊 Versione', value: status.version || 'N/D', inline: true },
        { name: '🖥️ Nodi', value: status.nodes ? `${status.nodes}` : 'N/D', inline: true },
        { name: '🎮 Server Totali', value: status.servers ? `${status.servers}` : 'N/D', inline: true }
      )
      .setTimestamp();

    // Aggiungi informazioni sulle risorse totali se disponibili
    if (status.totalResources) {
      embed.addFields(
        { name: '💾 Memoria Allocata', value: formatMemory(status.totalResources.memory), inline: true },
        { name: '💿 Disco Allocato', value: formatDisk(status.totalResources.disk), inline: true },
        { name: '⚙️ CPU Allocata', value: `${status.totalResources.cpu}%`, inline: true }
      );
    }

    // Ottieni i server dal database interno
    const localServers = await storage.getAllServers();
    const migratedServers = localServers.filter(s => s.pterodactylId !== null);
    
    // Aggiungi informazioni sulla migrazione
    embed.addFields({
      name: '🔄 Stato Migrazione',
      value: `${migratedServers.length}/${localServers.length} server migrati a Pterodactyl`
    });

    // Crea i pulsanti per azioni rapide
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pterodactyl_refresh')
          .setLabel('Aggiorna')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_servers')
          .setLabel('Lista Server')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_resources')
          .setLabel('Risorse')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  /**
   * Mostra la lista dei server Pterodactyl
   */
  async showServersList(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const servers = await pterodactyl.getServers();
    
    if (servers.length === 0) {
      return interaction.editReply({
        content: '❌ **Nessun server trovato su Pterodactyl.**\nPuoi migrare i server Docker esistenti usando il comando `/migrazione` o creare nuovi server direttamente nel panel.'
      });
    }

    // Raggruppa i server per stato
    const onlineServers = servers.filter(s => s.status === 'running');
    const offlineServers = servers.filter(s => s.status === 'offline' || s.status === 'stopping');
    const otherServers = servers.filter(s => s.status !== 'running' && s.status !== 'offline' && s.status !== 'stopping');

    // Crea l'embed di risposta
    const embed = new EmbedBuilder()
      .setTitle('🎮 Server Pterodactyl')
      .setDescription(`${servers.length} server trovati sul panel Pterodactyl.`)
      .setColor(0x2ECC71)
      .setFooter({ text: 'Usa /pterodactyl stats <id> per vedere statistiche dettagliate' })
      .setTimestamp();

    // Aggiungi i server online
    if (onlineServers.length > 0) {
      embed.addFields({
        name: `🟢 Online (${onlineServers.length})`,
        value: onlineServers.map(server => {
          return `**${server.name}** (ID: \`${server.id}\`)`;
        }).join('\n')
      });
    }

    // Aggiungi i server offline
    if (offlineServers.length > 0) {
      embed.addFields({
        name: `🔴 Offline (${offlineServers.length})`,
        value: offlineServers.map(server => {
          return `**${server.name}** (ID: \`${server.id}\`)`;
        }).join('\n')
      });
    }

    // Aggiungi gli altri server (in avvio, sospesi, ecc.)
    if (otherServers.length > 0) {
      embed.addFields({
        name: `⚪ Altri Stati (${otherServers.length})`,
        value: otherServers.map(server => {
          return `**${server.name}** - ${server.status} (ID: \`${server.id}\`)`;
        }).join('\n')
      });
    }

    // Crea i pulsanti per azioni rapide
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pterodactyl_refresh_servers')
          .setLabel('Aggiorna')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_status')
          .setLabel('Stato Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🦅'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_resources')
          .setLabel('Risorse')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  /**
   * Mostra statistiche dettagliate di un server specifico
   */
  async showServerStats(interaction: ChatInputCommandInteraction, serverId: string) {
    await interaction.deferReply();

    // Ottieni le informazioni sul server
    const servers = await pterodactyl.getServers();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      return interaction.editReply({
        content: `❌ **Server con ID ${serverId} non trovato.**\nVerifica che l'ID sia corretto e che il server esista nel panel Pterodactyl.`
      });
    }

    // Ottieni le risorse del server
    const resources = await pterodactyl.getServerResources(serverId);
    
    if (!resources) {
      return interaction.editReply({
        content: `⚠️ **Impossibile ottenere le risorse per il server ${server.name}.**\nIl server potrebbe essere offline o inaccessibile.`
      });
    }

    // Funzioni di formattazione
    const formatBytes = (bytes: number, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    // Calcola percentuali di utilizzo
    const memoryPercent = server.resources.memory_limit > 0 ? 
      Math.round((resources.resources.memory_bytes / (1024 * 1024) / server.resources.memory_limit) * 100) : 0;
    
    const diskPercent = server.resources.disk_limit > 0 ? 
      Math.round((resources.resources.disk_bytes / (1024 * 1024) / server.resources.disk_limit) * 100) : 0;

    // Crea barre di progresso
    const createProgressBar = (percent: number, length = 10) => {
      const filled = Math.round((percent / 100) * length);
      const empty = length - filled;
      return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
    };

    // Colore basato sullo stato
    let statusColor = 0x95A5A6; // Grigio predefinito
    
    switch(resources.current_state) {
      case 'running':
        statusColor = 0x2ECC71; // Verde
        break;
      case 'starting':
        statusColor = 0xF39C12; // Arancione
        break;
      case 'stopping':
        statusColor = 0xE74C3C; // Rosso
        break;
      case 'offline':
        statusColor = 0x7F8C8D; // Grigio
        break;
    }

    // Crea l'embed di risposta
    const embed = new EmbedBuilder()
      .setTitle(`🖥️ ${server.name}`)
      .setDescription(`Statistiche in tempo reale per il server Pterodactyl \`${server.identifier}\`.`)
      .setColor(statusColor)
      .addFields(
        { name: '🟢 Stato', value: resources.current_state, inline: true },
        { name: '🔌 Nodo', value: server.node, inline: true },
        { name: '⏱️ Uptime', value: formatUptime(resources.resources.uptime), inline: true },
        { 
          name: '💾 Memoria',
          value: `${createProgressBar(memoryPercent)}\n${formatBytes(resources.resources.memory_bytes)} / ${server.resources.memory_limit} MB`,
          inline: false
        },
        { 
          name: '⚙️ CPU',
          value: `Utilizzo: ${Math.round(resources.resources.cpu_absolute * 100) / 100}%\nLimite: ${server.resources.cpu_limit}%`,
          inline: true
        },
        { 
          name: '💿 Disco',
          value: `${createProgressBar(diskPercent)}\n${formatBytes(resources.resources.disk_bytes)} / ${server.resources.disk_limit} MB`,
          inline: false
        },
        { 
          name: '🌐 Rete',
          value: `📥 RX: ${formatBytes(resources.resources.network_rx_bytes)}\n📤 TX: ${formatBytes(resources.resources.network_tx_bytes)}`,
          inline: true
        }
      )
      .setTimestamp();

    // Aggiungi informazioni allocazione se disponibili
    if (server.relationships?.allocations?.data?.[0]) {
      const allocation = server.relationships.allocations.data[0];
      embed.addFields({ 
        name: '🔗 Connessione', 
        value: `\`${allocation.ip}:${allocation.port}\``,
        inline: false
      });
    }

    // Crea i pulsanti per azioni rapide
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`pterodactyl_refresh_stats_${serverId}`)
          .setLabel('Aggiorna')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(`pterodactyl_start_${serverId}`)
          .setLabel('Avvia')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️')
          .setDisabled(resources.current_state === 'running'),
        new ButtonBuilder()
          .setCustomId(`pterodactyl_stop_${serverId}`)
          .setLabel('Arresta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⏹️')
          .setDisabled(resources.current_state === 'offline'),
        new ButtonBuilder()
          .setCustomId(`pterodactyl_restart_${serverId}`)
          .setLabel('Riavvia')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
          .setDisabled(resources.current_state === 'offline'),
        new ButtonBuilder()
          .setCustomId(`pterodactyl_backup_${serverId}`)
          .setLabel('Backup')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💾')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  /**
   * Mostra una panoramica dell'utilizzo delle risorse di tutti i server
   */
  async showResourceUsage(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const stats = await pterodactyl.getAllServersStats();
    
    if (stats.length === 0) {
      return interaction.editReply({
        content: '❌ **Nessuna statistica disponibile.**\nVerifica che ci siano server attivi nel panel Pterodactyl.'
      });
    }

    // Calcola totali
    const totalMemoryLimit = stats.reduce((total, server) => total + server.memory.limit, 0);
    const totalMemoryUsed = stats.reduce((total, server) => total + server.memory.current, 0);
    const totalDiskLimit = stats.reduce((total, server) => total + server.disk.limit, 0);
    const totalDiskUsed = stats.reduce((total, server) => total + server.disk.current, 0);
    const totalMemoryPercent = totalMemoryLimit > 0 ? Math.round((totalMemoryUsed / totalMemoryLimit) * 100) : 0;
    const totalDiskPercent = totalDiskLimit > 0 ? Math.round((totalDiskUsed / totalDiskLimit) * 100) : 0;

    // Funzioni di formattazione
    const formatMB = (mb: number) => {
      if (mb < 1024) return `${mb} MB`;
      return `${(mb / 1024).toFixed(2)} GB`;
    };

    const createProgressBar = (percent: number, length = 10) => {
      const filled = Math.round((percent / 100) * length);
      const empty = length - filled;
      return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
    };

    // Crea l'embed di risposta
    const embed = new EmbedBuilder()
      .setTitle('📊 Utilizzo Risorse')
      .setDescription(`Panoramica dell'utilizzo delle risorse per ${stats.length} server.`)
      .setColor(0x3498DB)
      .addFields(
        { 
          name: '💾 Memoria Totale',
          value: `${createProgressBar(totalMemoryPercent)}\n${formatMB(totalMemoryUsed)} / ${formatMB(totalMemoryLimit)}`,
          inline: false
        },
        { 
          name: '💿 Disco Totale',
          value: `${createProgressBar(totalDiskPercent)}\n${formatMB(totalDiskUsed)} / ${formatMB(totalDiskLimit)}`,
          inline: false
        },
        {
          name: '🟢 Server Online',
          value: `${stats.filter(s => s.status === 'running').length} / ${stats.length}`,
          inline: true
        },
        {
          name: '⚙️ Nodi',
          value: `${new Set(stats.map(s => s.node)).size}`,
          inline: true
        }
      )
      .setTimestamp();

    // Aggiungi i server con utilizzo risorse più alto
    const topMemoryServers = [...stats].sort((a, b) => b.memory.percent - a.memory.percent).slice(0, 3);
    const topDiskServers = [...stats].sort((a, b) => b.disk.percent - a.disk.percent).slice(0, 3);
    
    if (topMemoryServers.length > 0) {
      embed.addFields({
        name: '🏆 Top Utilizzo Memoria',
        value: topMemoryServers.map(server => 
          `**${server.name}**: ${server.memory.percent}% (${formatMB(server.memory.current)})`
        ).join('\n'),
        inline: false
      });
    }
    
    if (topDiskServers.length > 0) {
      embed.addFields({
        name: '🏆 Top Utilizzo Disco',
        value: topDiskServers.map(server => 
          `**${server.name}**: ${server.disk.percent}% (${formatMB(server.disk.current)})`
        ).join('\n'),
        inline: false
      });
    }

    // Crea i pulsanti per azioni rapide
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pterodactyl_refresh_resources')
          .setLabel('Aggiorna')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_servers')
          .setLabel('Lista Server')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId('pterodactyl_status')
          .setLabel('Stato Panel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🦅')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  /**
   * Gestisce le interazioni con i pulsanti
   */
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;

      // Aggiorna lo stato del panel
      if (customId === 'pterodactyl_refresh' || customId === 'pterodactyl_status') {
        await interaction.deferUpdate();
        return this.showPterodactylStatus(interaction);
      }

      // Mostra la lista dei server
      if (customId === 'pterodactyl_servers' || customId === 'pterodactyl_refresh_servers') {
        await interaction.deferUpdate();
        return this.showServersList(interaction);
      }

      // Mostra panoramica risorse
      if (customId === 'pterodactyl_resources' || customId === 'pterodactyl_refresh_resources') {
        await interaction.deferUpdate();
        return this.showResourceUsage(interaction);
      }

      // Aggiorna statistiche di un server
      if (customId.startsWith('pterodactyl_refresh_stats_')) {
        const serverId = customId.replace('pterodactyl_refresh_stats_', '');
        await interaction.deferUpdate();
        return this.showServerStats(interaction, serverId);
      }

      // Avvia server
      if (customId.startsWith('pterodactyl_start_')) {
        const serverId = customId.replace('pterodactyl_start_', '');
        await interaction.deferUpdate();
        
        const success = await pterodactyl.startServer(serverId);
        
        if (success) {
          await interaction.followUp({
            content: '✅ **Avvio del server in corso...**\nIl server sarà online tra qualche istante.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ **Impossibile avviare il server.**\nVerifica i log per maggiori dettagli.',
            ephemeral: true
          });
        }
        
        // Aggiorna la visualizzazione dopo un breve ritardo
        setTimeout(() => this.showServerStats(interaction, serverId), 2000);
        return;
      }

      // Arresta server
      if (customId.startsWith('pterodactyl_stop_')) {
        const serverId = customId.replace('pterodactyl_stop_', '');
        await interaction.deferUpdate();
        
        const success = await pterodactyl.stopServer(serverId);
        
        if (success) {
          await interaction.followUp({
            content: '✅ **Arresto del server in corso...**\nIl server sarà offline tra qualche istante.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ **Impossibile arrestare il server.**\nVerifica i log per maggiori dettagli.',
            ephemeral: true
          });
        }
        
        // Aggiorna la visualizzazione dopo un breve ritardo
        setTimeout(() => this.showServerStats(interaction, serverId), 2000);
        return;
      }

      // Riavvia server
      if (customId.startsWith('pterodactyl_restart_')) {
        const serverId = customId.replace('pterodactyl_restart_', '');
        await interaction.deferUpdate();
        
        const success = await pterodactyl.restartServer(serverId);
        
        if (success) {
          await interaction.followUp({
            content: '✅ **Riavvio del server in corso...**\nIl server sarà nuovamente disponibile tra qualche istante.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ **Impossibile riavviare il server.**\nVerifica i log per maggiori dettagli.',
            ephemeral: true
          });
        }
        
        // Aggiorna la visualizzazione dopo un breve ritardo
        setTimeout(() => this.showServerStats(interaction, serverId), 2000);
        return;
      }

      // Crea backup server
      if (customId.startsWith('pterodactyl_backup_')) {
        const serverId = customId.replace('pterodactyl_backup_', '');
        await interaction.deferUpdate();
        
        const backup = await pterodactyl.createBackup(serverId);
        
        if (backup) {
          await interaction.followUp({
            content: `✅ **Backup avviato con successo!**\nNome: \`${backup.name}\`\nIdentificatore: \`${backup.identifier}\``,
            ephemeral: false
          });
        } else {
          await interaction.followUp({
            content: '❌ **Impossibile creare il backup.**\nVerifica i log per maggiori dettagli.',
            ephemeral: true
          });
        }
        
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