import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalSubmitInteraction
} from 'discord.js';

// Tipi di ticket supportati
enum TicketType {
  SUPPORT = 'supporto',
  BUG = 'bug',
  SERVER_REQUEST = 'richiesta-server'
}

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema di ticket per richieste e supporto')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('apri')
        .setDescription('Apri un nuovo ticket di supporto')
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo di ticket da aprire')
            .setRequired(true)
            .addChoices(
              { name: 'Supporto tecnico', value: TicketType.SUPPORT },
              { name: 'Segnalazione bug', value: TicketType.BUG },
              { name: 'Richiesta nuovo server', value: TicketType.SERVER_REQUEST }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('chiudi')
        .setDescription('Chiudi un ticket esistente')
        .addStringOption(option =>
          option
            .setName('motivo')
            .setDescription('Motivo della chiusura del ticket')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configura il sistema di ticket (solo per amministratori)')
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'apri') {
        const ticketType = interaction.options.getString('tipo') as TicketType;
        
        // Prepara il modulo per le informazioni dettagliate
        const modal = new ModalBuilder()
          .setCustomId(`ticket_modal_${ticketType}`)
          .setTitle(this.getTicketTitle(ticketType));
        
        // Campi comuni a tutti i tipi di ticket
        const titleInput = new TextInputBuilder()
          .setCustomId('ticket_title')
          .setLabel('Titolo del ticket')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Inserisci un titolo breve e descrittivo')
          .setRequired(true)
          .setMaxLength(100);
        
        const descriptionInput = new TextInputBuilder()
          .setCustomId('ticket_description')
          .setLabel('Descrizione')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Descrivi il problema o la richiesta in dettaglio')
          .setRequired(true)
          .setMaxLength(1000);
        
        // Campi aggiuntivi in base al tipo di ticket
        let additionalInput = null;
        
        if (ticketType === TicketType.SUPPORT) {
          additionalInput = new TextInputBuilder()
            .setCustomId('steps_to_reproduce')
            .setLabel('Passi per riprodurre il problema')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Descrivi i passaggi per riprodurre il problema (se applicabile)')
            .setRequired(false)
            .setMaxLength(500);
        } else if (ticketType === TicketType.BUG) {
          additionalInput = new TextInputBuilder()
            .setCustomId('bug_details')
            .setLabel('Dettagli del bug')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Quando si verifica? Cosa succede? Quali informazioni di sistema puoi fornire?')
            .setRequired(true)
            .setMaxLength(500);
        } else if (ticketType === TicketType.SERVER_REQUEST) {
          additionalInput = new TextInputBuilder()
            .setCustomId('server_details')
            .setLabel('Dettagli del server richiesto')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Nome del gioco, versione, requisiti, motivo della richiesta, ecc.')
            .setRequired(true)
            .setMaxLength(500);
        }
        
        // Crea le righe del modulo
        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
        
        // Aggiungi il campo aggiuntivo se presente
        const components = [firstActionRow, secondActionRow];
        if (additionalInput) {
          const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(additionalInput);
          components.push(thirdActionRow);
        }
        
        // Aggiungi i componenti al modulo
        modal.addComponents(...components);
        
        // Mostra il modulo all'utente
        await interaction.showModal(modal);
        
      } else if (subcommand === 'chiudi') {
        // Verifica che il comando sia eseguito in un canale ticket
        if (!interaction.channel?.name.startsWith('ticket-')) {
          return interaction.reply({
            content: 'Questo comando può essere usato solo all\'interno di un canale ticket.',
            ephemeral: true
          });
        }
        
        const motivo = interaction.options.getString('motivo') || 'Nessun motivo specificato';
        
        // Crea un embed con le informazioni di chiusura
        const embed = new EmbedBuilder()
          .setTitle('🔒 Ticket Chiuso')
          .setDescription(`Questo ticket è stato chiuso da ${interaction.user}.`)
          .addFields({ name: 'Motivo', value: motivo })
          .setColor('#FF5555')
          .setTimestamp();
        
        // Crea un pulsante per eliminare il canale
        const deleteButton = new ButtonBuilder()
          .setCustomId('delete_ticket_channel')
          .setLabel('Elimina canale')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton);
        
        await interaction.reply({ embeds: [embed], components: [row] });
        
      } else if (subcommand === 'setup') {
        // Verifica che l'utente sia un amministratore
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: 'Solo gli amministratori possono configurare il sistema di ticket.',
            ephemeral: true
          });
        }
        
        // Crea un embed con il pannello di controllo dei ticket
        const embed = new EmbedBuilder()
          .setTitle('🎫 Sistema Ticket - Giardini di Bellion')
          .setDescription('Usa i pulsanti qui sotto per aprire un ticket di supporto. Un membro del team ti aiuterà il prima possibile.')
          .addFields(
            { 
              name: '🔧 Supporto Tecnico', 
              value: 'Problemi di connessione, configurazione WireGuard, accesso ai server', 
              inline: false 
            },
            { 
              name: '🐛 Segnalazione Bug', 
              value: 'Problemi con i server, errori del bot, malfunzionamenti', 
              inline: false 
            },
            { 
              name: '🎮 Richiesta Nuovo Server', 
              value: 'Richiedi l\'aggiunta di un nuovo server di gioco alla LAN', 
              inline: false 
            }
          )
          .setColor('#3498DB')
          .setFooter({ text: 'I ticket vengono monitorati dal team di amministrazione' });
        
        // Crea i pulsanti per i diversi tipi di ticket
        const supportButton = new ButtonBuilder()
          .setCustomId(`ticket_button_${TicketType.SUPPORT}`)
          .setLabel('Supporto Tecnico')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔧');
        
        const bugButton = new ButtonBuilder()
          .setCustomId(`ticket_button_${TicketType.BUG}`)
          .setLabel('Segnala Bug')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🐛');
        
        const requestButton = new ButtonBuilder()
          .setCustomId(`ticket_button_${TicketType.SERVER_REQUEST}`)
          .setLabel('Richiedi Server')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎮');
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(supportButton, bugButton, requestButton);
        
        // Invia il pannello di controllo
        await interaction.reply({ embeds: [embed], components: [row] });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando ticket:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
        ephemeral: true
      });
    }
  },
  
  // Metodo ausiliario per ottenere titoli in base al tipo di ticket
  getTicketTitle(type: TicketType): string {
    switch (type) {
      case TicketType.SUPPORT:
        return 'Richiesta di Supporto Tecnico';
      case TicketType.BUG:
        return 'Segnalazione Bug';
      case TicketType.SERVER_REQUEST:
        return 'Richiesta Nuovo Server';
      default:
        return 'Nuovo Ticket';
    }
  },
  
  // Metodo per gestire l'invio del modulo del ticket
  async handleModalSubmit(client: Client, interaction: ModalSubmitInteraction) {
    try {
      // Estrai il tipo di ticket dall'ID personalizzato
      const customId = interaction.customId;
      const ticketType = customId.replace('ticket_modal_', '') as TicketType;
      
      // Ottieni i valori dai campi del modulo
      const title = interaction.fields.getTextInputValue('ticket_title');
      const description = interaction.fields.getTextInputValue('ticket_description');
      
      // Ottieni il valore del campo aggiuntivo, se presente
      let additionalFieldValue = '';
      let additionalFieldName = '';
      
      if (ticketType === TicketType.SUPPORT && interaction.fields.getTextInputValue('steps_to_reproduce')) {
        additionalFieldValue = interaction.fields.getTextInputValue('steps_to_reproduce');
        additionalFieldName = 'Passi per riprodurre';
      } else if (ticketType === TicketType.BUG && interaction.fields.getTextInputValue('bug_details')) {
        additionalFieldValue = interaction.fields.getTextInputValue('bug_details');
        additionalFieldName = 'Dettagli del bug';
      } else if (ticketType === TicketType.SERVER_REQUEST && interaction.fields.getTextInputValue('server_details')) {
        additionalFieldValue = interaction.fields.getTextInputValue('server_details');
        additionalFieldName = 'Dettagli del server';
      }
      
      // Invia un messaggio di conferma all'utente
      await interaction.reply({
        content: `✅ Il tuo ticket è stato creato. Un membro del team ti risponderà il prima possibile.`,
        ephemeral: true
      });
      
      // Crea un nome per il canale del ticket
      const ticketNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const channelName = `ticket-${ticketType}-${ticketNumber}`;
      
      // Ottieni il guild in cui è stato eseguito il comando
      const guild = interaction.guild;
      if (!guild) return;
      
      // Crea un nuovo canale per il ticket
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            // Per gli admin, cerca un ruolo "Admin" o usa i permessi dell'utente
            id: guild.roles.cache.find(r => r.name === 'Admin')?.id || interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });
      
      // Crea un embed con le informazioni del ticket
      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${ticketNumber} - ${title}`)
        .setDescription(`Tipo: **${this.getTicketTitle(ticketType)}**\nCreato da: ${interaction.user}`)
        .addFields(
          { name: 'Descrizione', value: description }
        )
        .setColor(this.getTicketColor(ticketType))
        .setTimestamp();
      
      // Aggiungi il campo aggiuntivo all'embed, se presente
      if (additionalFieldValue && additionalFieldName) {
        embed.addFields({ name: additionalFieldName, value: additionalFieldValue });
      }
      
      // Crea i pulsanti per gestire il ticket
      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Chiudi ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);
      
      // Invia il messaggio iniziale nel canale del ticket
      await channel.send({ 
        content: `🔔 ${interaction.user}, ticket creato! Lo staff ti risponderà il prima possibile.`,
        embeds: [embed],
        components: [row]
      });
      
      // Invia una notifica nel canale di log degli admin, se esiste
      const adminChannel = guild.channels.cache.find(
        ch => ch.name === 'admin-log' && ch.type === ChannelType.GuildText
      ) as TextChannel | undefined;
      
      if (adminChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`📬 Nuovo Ticket: #${ticketNumber}`)
          .setDescription(`Un nuovo ticket è stato aperto da ${interaction.user}.`)
          .addFields(
            { name: 'Tipo', value: this.getTicketTitle(ticketType), inline: true },
            { name: 'Titolo', value: title, inline: true },
            { name: 'Canale', value: `<#${channel.id}>`, inline: true }
          )
          .setColor(this.getTicketColor(ticketType))
          .setTimestamp();
        
        await adminChannel.send({ embeds: [logEmbed] });
      }
      
    } catch (error) {
      console.error('Errore durante la gestione del modulo del ticket:', error);
      
      // Se c'è stato un errore dopo il reply, invia un messaggio di follow-up
      try {
        if (interaction.replied) {
          await interaction.followUp({
            content: 'Si è verificato un errore durante la creazione del ticket. Contatta un amministratore.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: 'Si è verificato un errore durante la creazione del ticket. Contatta un amministratore.',
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error('Errore anche nel follow-up:', followUpError);
      }
    }
  },
  
  // Metodo per ottenere il colore in base al tipo di ticket
  getTicketColor(type: TicketType): number {
    switch (type) {
      case TicketType.SUPPORT:
        return 0x3498DB; // Blu
      case TicketType.BUG:
        return 0xE74C3C; // Rosso
      case TicketType.SERVER_REQUEST:
        return 0x2ECC71; // Verde
      default:
        return 0x95A5A6; // Grigio
    }
  }
};