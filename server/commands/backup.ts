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
import { storage } from '../storage';

// Struttura per memorizzare le informazioni sui backup
interface BackupInfo {
  id: string;
  serverId: number;
  serverName: string;
  createdAt: Date;
  size: string;
  path: string;
  createdBy: string;
  status: 'completato' | 'in corso' | 'fallito';
  note?: string;
}

// Mock di dati per i backup
const mockBackups: BackupInfo[] = [
  {
    id: 'bkp-1234',
    serverId: 1,
    serverName: 'Minecraft Survival',
    createdAt: new Date(Date.now() - 86400000), // 1 giorno fa
    size: '4.2 GB',
    path: '/data/backups/minecraft_survival_20230518.zip',
    createdBy: 'Sistema',
    status: 'completato'
  },
  {
    id: 'bkp-5678',
    serverId: 3,
    serverName: 'Terraria',
    createdAt: new Date(Date.now() - 172800000), // 2 giorni fa
    size: '780 MB',
    path: '/data/backups/terraria_20230517.zip',
    createdBy: 'Admin',
    status: 'completato'
  }
];

export default {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Gestisci i backup dei server di gioco')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('crea')
        .setDescription('Crea un nuovo backup di un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Il server di cui creare il backup')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option
            .setName('note')
            .setDescription('Note opzionali sul backup')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lista')
        .setDescription('Visualizza la lista dei backup disponibili')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Filtra per un server specifico')
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ripristina')
        .setDescription('Ripristina un server da un backup')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del backup da ripristinare')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('elimina')
        .setDescription('Elimina un backup')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del backup da eliminare')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('programma')
        .setDescription('Configura i backup automatici per un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Il server per cui configurare i backup automatici')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option
            .setName('frequenza')
            .setDescription('Frequenza dei backup automatici')
            .setRequired(true)
            .addChoices(
              { name: 'Giornaliera', value: 'daily' },
              { name: 'Settimanale', value: 'weekly' },
              { name: 'Mensile', value: 'monthly' },
              { name: 'Disattiva', value: 'off' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('conservazione')
            .setDescription('Numero di backup da conservare')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Verifica che l'utente sia un amministratore
      const member = interaction.member;
      if (!member) {
        return interaction.reply({
          content: '❌ Non sei un membro del server Discord.',
          ephemeral: true
        });
      }
      
      const isAdmin = (member as any).permissions?.has(PermissionFlagsBits.Administrator);
      
      if (!isAdmin) {
        return interaction.reply({
          content: '❌ Solo gli amministratori possono gestire i backup dei server.',
          ephemeral: true
        });
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'crea') {
        const serverName = interaction.options.getString('server');
        const note = interaction.options.getString('note');
        
        if (!serverName) {
          return interaction.reply({
            content: '❌ Nome del server non specificato.',
            ephemeral: true
          });
        }
        
        // Ottieni il server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
        
        if (!server) {
          return interaction.reply({
            content: `❌ Server "${serverName}" non trovato. Verifica di aver specificato il nome corretto.`,
            ephemeral: true
          });
        }
        
        // Avvia il processo di backup (simulato)
        await interaction.deferReply();
        
        // Crea un ID unico per il backup
        const backupId = `bkp-${Math.floor(Math.random() * 10000)}`;
        
        // Mostra un messaggio di inizio backup
        const startEmbed = new EmbedBuilder()
          .setTitle('🔄 Backup in corso...')
          .setDescription(`Creazione backup del server **${server.name}** in corso...`)
          .setColor('#3498DB')
          .addFields(
            { name: 'Server', value: server.name, inline: true },
            { name: 'ID Backup', value: backupId, inline: true },
            { name: 'Stato', value: '⏳ In corso', inline: true }
          )
          .setFooter({ text: `Backup richiesto da ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [startEmbed] });
        
        // Simula il completamento del backup dopo 5 secondi
        setTimeout(async () => {
          const size = `${(Math.random() * 5 + 0.5).toFixed(1)} GB`;
          const path = `/data/backups/${server.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.zip`;
          
          // Aggiungi il backup alla lista dei backup (in una implementazione reale, lo salveremmo nel database)
          mockBackups.unshift({
            id: backupId,
            serverId: server.id,
            serverName: server.name,
            createdAt: new Date(),
            size,
            path,
            createdBy: interaction.user.tag,
            status: 'completato',
            note: note || undefined
          });
          
          // Mostra messaggio di completamento
          const completeEmbed = new EmbedBuilder()
            .setTitle('✅ Backup completato')
            .setDescription(`Backup del server **${server.name}** completato con successo!`)
            .setColor('#43B581')
            .addFields(
              { name: 'Server', value: server.name, inline: true },
              { name: 'ID Backup', value: backupId, inline: true },
              { name: 'Dimensione', value: size, inline: true },
              { name: 'Percorso', value: `\`${path}\``, inline: false }
            )
            .setFooter({ text: `Backup richiesto da ${interaction.user.tag}` })
            .setTimestamp();
          
          if (note) {
            completeEmbed.addFields({ name: 'Note', value: note, inline: false });
          }
          
          // Crea pulsanti per operazioni rapide
          const restoreButton = new ButtonBuilder()
            .setCustomId(`restore_backup_${backupId}`)
            .setLabel('Ripristina')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');
          
          const deleteButton = new ButtonBuilder()
            .setCustomId(`delete_backup_${backupId}`)
            .setLabel('Elimina')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');
          
          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(restoreButton, deleteButton);
          
          await interaction.editReply({ embeds: [completeEmbed], components: [row] });
        }, 5000);
      }
      else if (subcommand === 'lista') {
        const serverFilter = interaction.options.getString('server');
        
        // Filtra i backup in base al server selezionato (se specificato)
        let filteredBackups = [...mockBackups];
        
        if (serverFilter) {
          filteredBackups = filteredBackups.filter(
            backup => backup.serverName.toLowerCase() === serverFilter.toLowerCase()
          );
        }
        
        // Ordinali per data di creazione (più recenti prima)
        filteredBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        // Se non ci sono backup, mostra un messaggio
        if (filteredBackups.length === 0) {
          return interaction.reply({
            content: serverFilter
              ? `❌ Nessun backup trovato per il server "${serverFilter}".`
              : '❌ Nessun backup disponibile.',
            ephemeral: true
          });
        }
        
        // Crea un embed con la lista dei backup
        const embed = new EmbedBuilder()
          .setTitle('💾 Lista dei backup disponibili')
          .setDescription(serverFilter
            ? `Backup disponibili per il server **${serverFilter}**.`
            : 'Tutti i backup disponibili.')
          .setColor('#3498DB')
          .setFooter({ text: 'Usa /backup ripristina id:ID per ripristinare un backup' })
          .setTimestamp();
        
        // Aggiungi i backup all'embed (massimo 10)
        const maxBackups = Math.min(filteredBackups.length, 10);
        
        for (let i = 0; i < maxBackups; i++) {
          const backup = filteredBackups[i];
          const statusEmoji = backup.status === 'completato' ? '✅' : backup.status === 'in corso' ? '⏳' : '❌';
          
          embed.addFields({
            name: `${statusEmoji} ${backup.id} - ${backup.serverName}`,
            value: `📅 Creato: ${backup.createdAt.toLocaleDateString('it-IT')}\n📦 Dimensione: ${backup.size}\n👤 Creato da: ${backup.createdBy}${backup.note ? `\n📝 Note: ${backup.note}` : ''}`,
            inline: false
          });
        }
        
        // Se ci sono più backup di quelli mostrati, aggiungi un messaggio
        if (filteredBackups.length > maxBackups) {
          embed.addFields({
            name: '... e altri backup',
            value: `Altri ${filteredBackups.length - maxBackups} backup non mostrati.`,
            inline: false
          });
        }
        
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === 'ripristina') {
        const backupId = interaction.options.getString('id');
        
        if (!backupId) {
          return interaction.reply({
            content: '❌ ID del backup non specificato.',
            ephemeral: true
          });
        }
        
        // Trova il backup corrispondente
        const backup = mockBackups.find(b => b.id === backupId);
        
        if (!backup) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        // Ottieni il server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.id === backup.serverId);
        
        if (!server) {
          return interaction.reply({
            content: `❌ Server associato al backup non trovato. Il server potrebbe essere stato eliminato.`,
            ephemeral: true
          });
        }
        
        // Verifica se il server è online e avvisa l'utente
        if (server.status === 'online') {
          // Crea un messaggio di conferma con pulsanti
          const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Conferma ripristino')
            .setDescription(`Stai per ripristinare il server **${server.name}** dal backup **${backup.id}** creato il ${backup.createdAt.toLocaleDateString('it-IT')}.\n\n**Attenzione:** il server è attualmente online e verrà fermato durante il ripristino. Tutti i dati non salvati andranno persi.`)
            .setColor('#F1C40F')
            .addFields(
              { name: 'Server', value: server.name, inline: true },
              { name: 'Backup', value: backup.id, inline: true },
              { name: 'Dimensione', value: backup.size, inline: true },
              { name: 'Creato il', value: backup.createdAt.toLocaleDateString('it-IT'), inline: true }
            )
            .setFooter({ text: `Ripristino richiesto da ${interaction.user.tag}` })
            .setTimestamp();
          
          // Bottoni di conferma e annullamento
          const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_restore_${backup.id}`)
            .setLabel('Conferma ripristino')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️');
          
          const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_restore`)
            .setLabel('Annulla')
            .setStyle(ButtonStyle.Secondary);
          
          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);
          
          await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
        } else {
          // Il server è offline, procedi direttamente con il ripristino
          await this.performRestore(interaction, server, backup);
        }
      }
      else if (subcommand === 'elimina') {
        const backupId = interaction.options.getString('id');
        
        if (!backupId) {
          return interaction.reply({
            content: '❌ ID del backup non specificato.',
            ephemeral: true
          });
        }
        
        // Trova il backup corrispondente
        const backupIndex = mockBackups.findIndex(b => b.id === backupId);
        
        if (backupIndex === -1) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        const backup = mockBackups[backupIndex];
        
        // Richiedi conferma all'utente
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Conferma eliminazione')
          .setDescription(`Stai per eliminare definitivamente il backup **${backup.id}** del server **${backup.serverName}** creato il ${backup.createdAt.toLocaleDateString('it-IT')}. Questa azione non può essere annullata.`)
          .setColor('#F04747')
          .addFields(
            { name: 'Server', value: backup.serverName, inline: true },
            { name: 'Backup', value: backup.id, inline: true },
            { name: 'Dimensione', value: backup.size, inline: true },
            { name: 'Creato il', value: backup.createdAt.toLocaleDateString('it-IT'), inline: true }
          )
          .setFooter({ text: `Eliminazione richiesta da ${interaction.user.tag}` })
          .setTimestamp();
        
        // Bottoni di conferma e annullamento
        const confirmButton = new ButtonBuilder()
          .setCustomId(`confirm_delete_${backup.id}`)
          .setLabel('Conferma eliminazione')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');
        
        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Annulla')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(confirmButton, cancelButton);
        
        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
      }
      else if (subcommand === 'programma') {
        const serverName = interaction.options.getString('server');
        const frequency = interaction.options.getString('frequenza');
        const retention = interaction.options.getInteger('conservazione') || 5; // Default: 5 backup
        
        if (!serverName || !frequency) {
          return interaction.reply({
            content: '❌ Parametri mancanti.',
            ephemeral: true
          });
        }
        
        // Ottieni il server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
        
        if (!server) {
          return interaction.reply({
            content: `❌ Server "${serverName}" non trovato. Verifica di aver specificato il nome corretto.`,
            ephemeral: true
          });
        }
        
        // Frequenza in testo leggibile
        const frequencyText = {
          'daily': 'Giornaliera',
          'weekly': 'Settimanale',
          'monthly': 'Mensile',
          'off': 'Disattivata'
        }[frequency];
        
        // In una implementazione reale, qui salveremmo la configurazione nel database
        
        // Crea un embed con la conferma
        let embed;
        
        if (frequency === 'off') {
          embed = new EmbedBuilder()
            .setTitle('🛑 Backup automatici disattivati')
            .setDescription(`I backup automatici per il server **${server.name}** sono stati disattivati.`)
            .setColor('#F04747')
            .setFooter({ text: `Configurazione modificata da ${interaction.user.tag}` })
            .setTimestamp();
        } else {
          embed = new EmbedBuilder()
            .setTitle('✅ Backup automatici configurati')
            .setDescription(`I backup automatici per il server **${server.name}** sono stati configurati con successo.`)
            .setColor('#43B581')
            .addFields(
              { name: 'Server', value: server.name, inline: true },
              { name: 'Frequenza', value: frequencyText, inline: true },
              { name: 'Conservazione', value: `${retention} backup`, inline: true }
            )
            .setFooter({ text: `Configurazione modificata da ${interaction.user.tag}` })
            .setTimestamp();
        }
        
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando backup:', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.'
        });
      } else {
        await interaction.reply({
          content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
          ephemeral: true
        });
      }
    }
  },
  
  // Metodo ausiliario per eseguire il ripristino
  async performRestore(interaction: ChatInputCommandInteraction, server: any, backup: BackupInfo) {
    try {
      await interaction.deferReply();
      
      // Mostra un messaggio di inizio ripristino
      const startEmbed = new EmbedBuilder()
        .setTitle('🔄 Ripristino in corso...')
        .setDescription(`Ripristino del server **${server.name}** dal backup **${backup.id}** in corso...`)
        .setColor('#3498DB')
        .addFields(
          { name: 'Server', value: server.name, inline: true },
          { name: 'Backup', value: backup.id, inline: true },
          { name: 'Stato', value: '⏳ In corso', inline: true }
        )
        .setFooter({ text: `Ripristino richiesto da ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [startEmbed] });
      
      // Se il server è online, simuliamo l'arresto
      if (server.status === 'online') {
        await storage.updateServer(server.id, { status: 'stopping' });
        
        // Simuliamo l'attesa per l'arresto
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await storage.updateServer(server.id, { status: 'offline' });
      }
      
      // Simuliamo il ripristino
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Simuliamo il riavvio del server
      await storage.updateServer(server.id, { status: 'starting' });
      
      // Simuliamo l'attesa per l'avvio
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await storage.updateServer(server.id, { 
        status: 'online',
        currentPlayers: 0
      });
      
      // Mostra messaggio di completamento
      const completeEmbed = new EmbedBuilder()
        .setTitle('✅ Ripristino completato')
        .setDescription(`Ripristino del server **${server.name}** dal backup **${backup.id}** completato con successo!`)
        .setColor('#43B581')
        .addFields(
          { name: 'Server', value: server.name, inline: true },
          { name: 'Backup', value: backup.id, inline: true },
          { name: 'Dimensione', value: backup.size, inline: true },
          { name: 'Stato del server', value: '🟢 Online', inline: true }
        )
        .setFooter({ text: `Ripristino richiesto da ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [completeEmbed] });
      
      // Notifica il canale degli annunci
      const guild = interaction.guild;
      if (guild) {
        const announcesChannel = guild.channels.cache.find(
          ch => ch.name === 'annunci' && ch.isTextBased()
        );
        
        if (announcesChannel && announcesChannel.isTextBased()) {
          const announceEmbed = new EmbedBuilder()
            .setTitle(`🔄 Server ${server.name} ripristinato`)
            .setDescription(`Il server **${server.name}** è stato ripristinato da un backup ed è ora disponibile.`)
            .setColor('#43B581')
            .addFields(
              { name: 'Backup', value: backup.id, inline: true },
              { name: 'Creato il', value: backup.createdAt.toLocaleDateString('it-IT'), inline: true }
            )
            .setTimestamp();
          
          await announcesChannel.send({ embeds: [announceEmbed] });
        }
      }
    } catch (error) {
      console.error('Errore durante il ripristino:', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Si è verificato un errore durante il ripristino. Riprova più tardi.'
        });
      } else {
        await interaction.reply({
          content: 'Si è verificato un errore durante il ripristino. Riprova più tardi.',
          ephemeral: true
        });
      }
    }
  },
  
  // Metodo per gestire le interazioni con i pulsanti
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;
      
      // Gestione pulsante di conferma ripristino
      if (customId.startsWith('confirm_restore_')) {
        const backupId = customId.replace('confirm_restore_', '');
        
        // Trova il backup corrispondente
        const backup = mockBackups.find(b => b.id === backupId);
        
        if (!backup) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        // Ottieni il server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.id === backup.serverId);
        
        if (!server) {
          return interaction.reply({
            content: `❌ Server associato al backup non trovato. Il server potrebbe essere stato eliminato.`,
            ephemeral: true
          });
        }
        
        // Esegui il ripristino
        await interaction.update({ content: '⏳ Avvio ripristino...', components: [], embeds: [] });
        await this.performRestore(interaction, server, backup);
      }
      // Gestione pulsante di annullamento ripristino
      else if (customId === 'cancel_restore') {
        await interaction.update({
          content: '✅ Ripristino annullato.',
          components: [],
          embeds: []
        });
      }
      // Gestione pulsante di conferma eliminazione
      else if (customId.startsWith('confirm_delete_')) {
        const backupId = customId.replace('confirm_delete_', '');
        
        // Trova il backup corrispondente
        const backupIndex = mockBackups.findIndex(b => b.id === backupId);
        
        if (backupIndex === -1) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        const backup = mockBackups[backupIndex];
        
        // Rimuovi il backup dalla lista
        mockBackups.splice(backupIndex, 1);
        
        // In una implementazione reale, elimineremmo il file dal filesystem
        
        await interaction.update({
          content: `✅ Backup **${backupId}** del server **${backup.serverName}** eliminato con successo.`,
          components: [],
          embeds: []
        });
      }
      // Gestione pulsante di annullamento eliminazione
      else if (customId === 'cancel_delete') {
        await interaction.update({
          content: '✅ Eliminazione annullata.',
          components: [],
          embeds: []
        });
      }
      // Gestione pulsante di ripristino dalla lista dei backup
      else if (customId.startsWith('restore_backup_')) {
        const backupId = customId.replace('restore_backup_', '');
        
        // Trova il backup corrispondente
        const backup = mockBackups.find(b => b.id === backupId);
        
        if (!backup) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        // Ottieni il server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.id === backup.serverId);
        
        if (!server) {
          return interaction.reply({
            content: `❌ Server associato al backup non trovato. Il server potrebbe essere stato eliminato.`,
            ephemeral: true
          });
        }
        
        // Verifica se il server è online e richiedi conferma
        if (server.status === 'online') {
          // Crea un messaggio di conferma con pulsanti
          const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Conferma ripristino')
            .setDescription(`Stai per ripristinare il server **${server.name}** dal backup **${backup.id}** creato il ${backup.createdAt.toLocaleDateString('it-IT')}.\n\n**Attenzione:** il server è attualmente online e verrà fermato durante il ripristino. Tutti i dati non salvati andranno persi.`)
            .setColor('#F1C40F')
            .addFields(
              { name: 'Server', value: server.name, inline: true },
              { name: 'Backup', value: backup.id, inline: true },
              { name: 'Dimensione', value: backup.size, inline: true },
              { name: 'Creato il', value: backup.createdAt.toLocaleDateString('it-IT'), inline: true }
            )
            .setFooter({ text: `Ripristino richiesto da ${interaction.user.tag}` })
            .setTimestamp();
          
          // Bottoni di conferma e annullamento
          const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_restore_${backup.id}`)
            .setLabel('Conferma ripristino')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️');
          
          const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_restore`)
            .setLabel('Annulla')
            .setStyle(ButtonStyle.Secondary);
          
          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);
          
          await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
        } else {
          // Il server è offline, procedi direttamente con il ripristino
          await this.performRestore(interaction, server, backup);
        }
      }
      // Gestione pulsante di eliminazione dalla lista dei backup
      else if (customId.startsWith('delete_backup_')) {
        const backupId = customId.replace('delete_backup_', '');
        
        // Trova il backup corrispondente
        const backupIndex = mockBackups.findIndex(b => b.id === backupId);
        
        if (backupIndex === -1) {
          return interaction.reply({
            content: `❌ Backup con ID "${backupId}" non trovato.`,
            ephemeral: true
          });
        }
        
        const backup = mockBackups[backupIndex];
        
        // Richiedi conferma all'utente
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Conferma eliminazione')
          .setDescription(`Stai per eliminare definitivamente il backup **${backup.id}** del server **${backup.serverName}** creato il ${backup.createdAt.toLocaleDateString('it-IT')}. Questa azione non può essere annullata.`)
          .setColor('#F04747')
          .addFields(
            { name: 'Server', value: backup.serverName, inline: true },
            { name: 'Backup', value: backup.id, inline: true },
            { name: 'Dimensione', value: backup.size, inline: true },
            { name: 'Creato il', value: backup.createdAt.toLocaleDateString('it-IT'), inline: true }
          )
          .setFooter({ text: `Eliminazione richiesta da ${interaction.user.tag}` })
          .setTimestamp();
        
        // Bottoni di conferma e annullamento
        const confirmButton = new ButtonBuilder()
          .setCustomId(`confirm_delete_${backup.id}`)
          .setLabel('Conferma eliminazione')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');
        
        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Annulla')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(confirmButton, cancelButton);
        
        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
      }
      
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione:', error);
      
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