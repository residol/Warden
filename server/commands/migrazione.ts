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
import { registerServerForMigration, getMigrationStatus, migrateServer } from '../services/migration';
import { storage } from '../storage';

export default {
  data: new SlashCommandBuilder()
    .setName('migrazione')
    .setDescription('Gestisci la migrazione dei server da Docker a Pterodactyl')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('registra')
        .setDescription('Registra un server per la migrazione')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome del server da migrare')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo del server')
            .setRequired(true)
            .addChoices(
              { name: 'Minecraft', value: 'minecraft' },
              { name: 'Rust', value: 'rust' },
              { name: 'Terraria', value: 'terraria' },
              { name: 'Altro', value: 'altro' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('porta')
            .setDescription('Porta del server')
            .setRequired(true)
            .setMinValue(1024)
            .setMaxValue(65535)
        )
        .addIntegerOption(option =>
          option
            .setName('memoria')
            .setDescription('Memoria RAM in MB')
            .setRequired(false)
            .setMinValue(512)
            .setMaxValue(16384)
        )
        .addIntegerOption(option =>
          option
            .setName('disco')
            .setDescription('Spazio disco in MB')
            .setRequired(false)
            .setMinValue(1000)
            .setMaxValue(100000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stato')
        .setDescription('Controlla lo stato di migrazione di un server')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID del server')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('avvia')
        .setDescription('Avvia la migrazione di un server')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID del server')
            .setRequired(true)
        )
    ),
  
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'registra') {
        const serverName = interaction.options.getString('nome', true);
        const serverType = interaction.options.getString('tipo', true);
        const port = interaction.options.getInteger('porta', true);
        const memory = interaction.options.getInteger('memoria') || 2048;
        const disk = interaction.options.getInteger('disco') || 10000;
        
        // Registra il server per la migrazione
        const server = await registerServerForMigration(serverName, serverType, port, memory, disk);
        
        if (!server) {
          return interaction.reply({
            content: '❌ Impossibile registrare il server per la migrazione. Potrebbe già esistere o si è verificato un errore.',
            ephemeral: true
          });
        }
        
        // Crea l'embed di risposta
        const embed = new EmbedBuilder()
          .setTitle('🚀 Registrazione Migrazione Completata')
          .setDescription(`Il server **${serverName}** è stato registrato per la migrazione da Docker a Pterodactyl.`)
          .setColor(0x2ECC71)
          .addFields(
            { name: 'ID Server', value: `${server.id}`, inline: true },
            { name: 'Tipo', value: serverType, inline: true },
            { name: 'Porta', value: `${port}`, inline: true },
            { name: 'Memoria', value: `${memory} MB`, inline: true },
            { name: 'Disco', value: `${disk} MB`, inline: true },
            { name: 'Stato', value: 'In attesa di migrazione', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Utilizza /migrazione avvia per iniziare la migrazione' });
        
        // Crea i pulsanti per azioni rapide
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`migrate_server_${server.id}`)
              .setLabel('Avvia Migrazione')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🚀'),
            new ButtonBuilder()
              .setCustomId(`check_status_${server.id}`)
              .setLabel('Controlla Stato')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔍')
          );
        
        await interaction.reply({ embeds: [embed], components: [row] });
      }
      else if (subcommand === 'stato') {
        const serverId = interaction.options.getInteger('id', true);
        
        // Controlla lo stato della migrazione
        const status = await getMigrationStatus(serverId);
        
        if (status === null) {
          return interaction.reply({
            content: `❌ Server con ID ${serverId} non trovato.`,
            ephemeral: true
          });
        }
        
        let statusText = '';
        let statusColor = 0x95A5A6; // Grigio predefinito
        
        // Traduci lo stato in un formato leggibile
        switch (status) {
          case 'migration_pending':
            statusText = '⏳ In attesa di migrazione';
            statusColor = 0xF39C12; // Arancione
            break;
          case 'migration_in_progress':
            statusText = '🔄 Migrazione in corso';
            statusColor = 0x3498DB; // Blu
            break;
          case 'migration_completed':
            statusText = '✅ Migrazione completata';
            statusColor = 0x2ECC71; // Verde
            break;
          case 'migration_failed':
            statusText = '❌ Migrazione fallita';
            statusColor = 0xE74C3C; // Rosso
            break;
          case 'not_in_migration':
            statusText = '❓ Server non in processo di migrazione';
            statusColor = 0x95A5A6; // Grigio
            break;
          default:
            statusText = `❓ Stato sconosciuto: ${status}`;
            statusColor = 0x95A5A6; // Grigio
        }
        
        // Crea l'embed di risposta
        const embed = new EmbedBuilder()
          .setTitle('🔄 Stato Migrazione')
          .setDescription(`Stato della migrazione per il server con ID **${serverId}**`)
          .setColor(statusColor)
          .addFields(
            { name: 'Stato', value: statusText, inline: false }
          )
          .setTimestamp();
        
        // Aggiungi azioni disponibili in base allo stato
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        if (status === 'migration_pending') {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`migrate_server_${serverId}`)
              .setLabel('Avvia Migrazione')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🚀')
          );
        }
        
        if (status === 'migration_failed') {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`retry_migrate_${serverId}`)
              .setLabel('Riprova Migrazione')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔄')
          );
        }
        
        // Invia la risposta
        if (row.components.length > 0) {
          await interaction.reply({ embeds: [embed], components: [row] });
        } else {
          await interaction.reply({ embeds: [embed] });
        }
      }
      else if (subcommand === 'avvia') {
        const serverId = interaction.options.getInteger('id', true);
        
        // Avvia la migrazione
        await interaction.deferReply();
        
        const success = await migrateServer(serverId);
        
        if (success) {
          const embed = new EmbedBuilder()
            .setTitle('✅ Migrazione Completata')
            .setDescription(`La migrazione del server con ID **${serverId}** è stata completata con successo.`)
            .setColor(0x2ECC71)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          const embed = new EmbedBuilder()
            .setTitle('❌ Migrazione Fallita')
            .setDescription(`Si è verificato un errore durante la migrazione del server con ID **${serverId}**.`)
            .setColor(0xE74C3C)
            .addFields(
              { 
                name: 'Suggerimento', 
                value: 'Verificare che:\n1. L\'ID del server sia corretto\n2. Il server sia in stato "in attesa di migrazione"\n3. Pterodactyl sia configurato correttamente', 
                inline: false
              }
            )
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando migrazione:', error);
      
      // Se la risposta è già stata inviata o è in attesa, modifica la risposta
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Si è verificato un errore durante l\'esecuzione del comando. Controlla i log per maggiori dettagli.'
        });
      } else {
        // Altrimenti invia una nuova risposta
        await interaction.reply({
          content: '❌ Si è verificato un errore durante l\'esecuzione del comando. Controlla i log per maggiori dettagli.',
          ephemeral: true
        });
      }
    }
  },
  
  // Metodo per gestire le interazioni con i pulsanti
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;
      
      // Gestisci il pulsante "Avvia Migrazione"
      if (customId.startsWith('migrate_server_')) {
        const serverId = parseInt(customId.replace('migrate_server_', ''));
        
        await interaction.deferUpdate();
        
        const success = await migrateServer(serverId);
        
        if (success) {
          const embed = new EmbedBuilder()
            .setTitle('✅ Migrazione Completata')
            .setDescription(`La migrazione del server con ID **${serverId}** è stata completata con successo.`)
            .setColor(0x2ECC71)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          const embed = new EmbedBuilder()
            .setTitle('❌ Migrazione Fallita')
            .setDescription(`Si è verificato un errore durante la migrazione del server con ID **${serverId}**.`)
            .setColor(0xE74C3C)
            .addFields(
              { 
                name: 'Suggerimento', 
                value: 'Verificare che:\n1. L\'ID del server sia corretto\n2. Il server sia in stato "in attesa di migrazione"\n3. Pterodactyl sia configurato correttamente', 
                inline: false 
              }
            )
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed], components: [] });
        }
      }
      
      // Gestisci il pulsante "Controlla Stato"
      else if (customId.startsWith('check_status_')) {
        const serverId = parseInt(customId.replace('check_status_', ''));
        
        await interaction.deferUpdate();
        
        // Controlla lo stato della migrazione
        const status = await getMigrationStatus(serverId);
        
        if (status === null) {
          return interaction.editReply({
            content: `❌ Server con ID ${serverId} non trovato.`,
            components: []
          });
        }
        
        let statusText = '';
        let statusColor = 0x95A5A6; // Grigio predefinito
        
        // Traduci lo stato in un formato leggibile
        switch (status) {
          case 'migration_pending':
            statusText = '⏳ In attesa di migrazione';
            statusColor = 0xF39C12; // Arancione
            break;
          case 'migration_in_progress':
            statusText = '🔄 Migrazione in corso';
            statusColor = 0x3498DB; // Blu
            break;
          case 'migration_completed':
            statusText = '✅ Migrazione completata';
            statusColor = 0x2ECC71; // Verde
            break;
          case 'migration_failed':
            statusText = '❌ Migrazione fallita';
            statusColor = 0xE74C3C; // Rosso
            break;
          case 'not_in_migration':
            statusText = '❓ Server non in processo di migrazione';
            statusColor = 0x95A5A6; // Grigio
            break;
          default:
            statusText = `❓ Stato sconosciuto: ${status}`;
            statusColor = 0x95A5A6; // Grigio
        }
        
        // Crea l'embed di risposta
        const embed = new EmbedBuilder()
          .setTitle('🔄 Stato Migrazione')
          .setDescription(`Aggiornamento stato della migrazione per il server con ID **${serverId}**`)
          .setColor(statusColor)
          .addFields(
            { name: 'Stato', value: statusText, inline: false }
          )
          .setTimestamp();
        
        // Mantieni i pulsanti se il server è ancora in attesa
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        if (status === 'migration_pending') {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`migrate_server_${serverId}`)
              .setLabel('Avvia Migrazione')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🚀')
          );
          
          await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
          await interaction.editReply({ embeds: [embed], components: [] });
        }
      }
      
      // Gestisci il pulsante "Riprova Migrazione"
      else if (customId.startsWith('retry_migrate_')) {
        const serverId = parseInt(customId.replace('retry_migrate_', ''));
        
        await interaction.deferUpdate();
        
        // Aggiorna lo stato del server a "in attesa" di nuovo
        await storage.updateServer(serverId, { status: 'migration_pending' });
        
        // Riprova la migrazione
        const success = await migrateServer(serverId);
        
        if (success) {
          const embed = new EmbedBuilder()
            .setTitle('✅ Migrazione Completata')
            .setDescription(`La migrazione del server con ID **${serverId}** è stata completata con successo al secondo tentativo.`)
            .setColor(0x2ECC71)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          const embed = new EmbedBuilder()
            .setTitle('❌ Migrazione Fallita')
            .setDescription(`Si è verificato un errore durante il secondo tentativo di migrazione del server con ID **${serverId}**.`)
            .setColor(0xE74C3C)
            .addFields(
              { 
                name: 'Suggerimento', 
                value: 'Contattare l\'amministratore di sistema per assistenza manuale.', 
                inline: false 
              }
            )
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed], components: [] });
        }
      }
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione con i pulsanti:', error);
      
      // Invia una risposta generica di errore
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Si è verificato un errore durante l\'elaborazione della richiesta.',
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: '❌ Si è verificato un errore durante l\'elaborazione della richiesta.',
          components: []
        });
      }
    }
  }
};