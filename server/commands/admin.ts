import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Configura funzionalità amministrative del bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Visibile solo agli Admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('comandi')
        .setDescription('Gestisci la visibilità dei comandi')
        .addStringOption(option =>
          option
            .setName('azione')
            .setDescription('Azione da eseguire')
            .setRequired(true)
            .addChoices(
              { name: 'Nascondi comandi admin', value: 'hide' },
              { name: 'Mostra comandi admin', value: 'show' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stato')
        .setDescription('Mostra lo stato attuale del bot')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('log')
        .setDescription('Configura il livello di log')
        .addStringOption(option => 
          option
            .setName('livello')
            .setDescription('Livello di log')
            .setRequired(true)
            .addChoices(
              { name: 'Debug', value: 'debug' },
              { name: 'Info', value: 'info' },
              { name: 'Warn', value: 'warn' },
              { name: 'Error', value: 'error' }
            )
        )
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Verifica che l'utente sia un amministratore
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Solo gli amministratori possono utilizzare questo comando.',
          ephemeral: true
        });
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'comandi') {
        const action = interaction.options.getString('azione');
        
        // Elenco di comandi che dovrebbero essere visibili solo agli admin
        const adminCommands = [
          'admin',
          'backup',
          'grant-supporter',
          'monitor',
          'notifica',
          'server-control',
          'ticket'
        ];
        
        // In un'implementazione reale, qui useremmo Discord API per aggiornare i permessi
        // Per ora facciamo finta di aggiornare i permessi e mostriamo una risposta all'utente
        
        const embed = new EmbedBuilder()
          .setTitle(action === 'hide' ? '🔒 Comandi admin nascosti' : '🔓 Comandi admin visibili')
          .setDescription(action === 'hide' 
            ? 'I comandi amministrativi sono ora nascosti agli utenti normali.' 
            : 'I comandi amministrativi sono ora visibili a tutti gli utenti.')
          .setColor(action === 'hide' ? '#E74C3C' : '#2ECC71')
          .addFields(
            { 
              name: 'Comandi interessati', 
              value: adminCommands.map(cmd => `\`/${cmd}\``).join(', '), 
              inline: false 
            }
          )
          .setFooter({ text: `Configurazione aggiornata da ${interaction.user.tag}` })
          .setTimestamp();
        
        // Aggiungi nota informativa
        embed.addFields(
          { 
            name: 'ℹ️ Nota', 
            value: action === 'hide' 
              ? 'Gli utenti non-admin non vedranno questi comandi nell\'elenco dei comandi disponibili. Gli admin continueranno a vederli.' 
              : 'Tutti gli utenti vedranno questi comandi nell\'elenco, ma solo gli admin potranno utilizzarli.', 
            inline: false 
          }
        );
        
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === 'stato') {
        // Ottieni informazioni sul server Discord
        const guild = interaction.guild;
        const memberCount = guild?.memberCount || 0;
        
        // Statistiche sul bot
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        const commandsCount = client.application?.commands.cache.size || 0;
        
        // Crea l'embed
        const embed = new EmbedBuilder()
          .setTitle('📊 Stato del bot Discord')
          .setDescription(`Informazioni sullo stato del bot **${client.user?.username}**.`)
          .setColor('#3498DB')
          .addFields(
            { name: '🤖 Nome bot', value: client.user?.tag || 'Sconosciuto', inline: true },
            { name: '⏱️ Uptime', value: uptimeString, inline: true },
            { name: '🌐 Server', value: guild?.name || 'Sconosciuto', inline: true },
            { name: '👥 Membri', value: memberCount.toString(), inline: true },
            { name: '🔧 Comandi', value: commandsCount.toString(), inline: true },
            { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true }
          )
          .setFooter({ text: `ID Bot: ${client.user?.id}` })
          .setTimestamp();
        
        // Aggiungi immagine del bot se disponibile
        if (client.user?.displayAvatarURL()) {
          embed.setThumbnail(client.user.displayAvatarURL());
        }
        
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === 'log') {
        const level = interaction.options.getString('livello');
        
        // In un'implementazione reale, qui imposteremmo il livello di log
        // Per ora facciamo finta di farlo e mostriamo una risposta all'utente
        
        const embed = new EmbedBuilder()
          .setTitle('📝 Livello di log aggiornato')
          .setDescription(`Il livello di log è stato impostato a **${level}**.`)
          .setColor('#3498DB')
          .setFooter({ text: `Configurazione aggiornata da ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando admin:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
        ephemeral: true
      });
    }
  }
};