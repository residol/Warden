import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';

// Tipi di notifiche supportati
enum NotificationType {
  MAINTENANCE = 'manutenzione',
  NEW_SERVER = 'nuovo-server',
  UPDATE = 'aggiornamento',
  ANNOUNCEMENT = 'annuncio',
  EVENT = 'evento'
}

export default {
  data: new SlashCommandBuilder()
    .setName('notifica')
    .setDescription('Invia notifiche agli utenti della LAN')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('invia')
        .setDescription('Invia una notifica (solo admin)')
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo di notifica da inviare')
            .setRequired(true)
            .addChoices(
              { name: 'Manutenzione programmata', value: NotificationType.MAINTENANCE },
              { name: 'Nuovo server', value: NotificationType.NEW_SERVER },
              { name: 'Aggiornamento', value: NotificationType.UPDATE },
              { name: 'Annuncio generale', value: NotificationType.ANNOUNCEMENT },
              { name: 'Evento', value: NotificationType.EVENT }
            )
        )
        .addStringOption(option =>
          option
            .setName('titolo')
            .setDescription('Titolo della notifica')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('messaggio')
            .setDescription('Contenuto della notifica')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Nome del server interessato (se applicabile)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('data')
            .setDescription('Data dell\'evento/manutenzione (se applicabile, formato: DD/MM/YYYY)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('durata')
            .setDescription('Durata prevista (se applicabile)')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('importante')
            .setDescription('Segna come notifica importante (menzione @everyone)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('subscribe')
        .setDescription('Iscriviti a un canale di notifiche')
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo di notifiche a cui iscriversi')
            .setRequired(true)
            .addChoices(
              { name: 'Tutti', value: 'tutti' },
              { name: 'Manutenzioni', value: NotificationType.MAINTENANCE },
              { name: 'Nuovi server', value: NotificationType.NEW_SERVER },
              { name: 'Aggiornamenti', value: NotificationType.UPDATE },
              { name: 'Annunci', value: NotificationType.ANNOUNCEMENT },
              { name: 'Eventi', value: NotificationType.EVENT }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unsubscribe')
        .setDescription('Disiscriviti da un canale di notifiche')
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo di notifiche da cui disiscriversi')
            .setRequired(true)
            .addChoices(
              { name: 'Tutti', value: 'tutti' },
              { name: 'Manutenzioni', value: NotificationType.MAINTENANCE },
              { name: 'Nuovi server', value: NotificationType.NEW_SERVER },
              { name: 'Aggiornamenti', value: NotificationType.UPDATE },
              { name: 'Annunci', value: NotificationType.ANNOUNCEMENT },
              { name: 'Eventi', value: NotificationType.EVENT }
            )
        )
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'invia') {
        // Verifica che l'utente sia un amministratore
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '❌ Solo gli amministratori possono inviare notifiche.',
            ephemeral: true
          });
        }
        
        const tipo = interaction.options.getString('tipo') as NotificationType;
        const titolo = interaction.options.getString('titolo') as string;
        const messaggio = interaction.options.getString('messaggio') as string;
        const server = interaction.options.getString('server');
        const data = interaction.options.getString('data');
        const durata = interaction.options.getString('durata');
        const importante = interaction.options.getBoolean('importante') || false;
        
        // Crea l'embed della notifica
        const embed = new EmbedBuilder()
          .setTitle(titolo)
          .setDescription(messaggio)
          .setColor(this.getNotificationColor(tipo))
          .setTimestamp();
        
        // Aggiungi l'icona appropriata al titolo in base al tipo
        embed.setTitle(`${this.getNotificationEmoji(tipo)} ${titolo}`);
        
        // Aggiungi campi aggiuntivi se specificati
        if (server) {
          embed.addFields({ name: '🎮 Server', value: server, inline: true });
        }
        
        if (data) {
          embed.addFields({ name: '📅 Data', value: data, inline: true });
        }
        
        if (durata) {
          embed.addFields({ name: '⏱️ Durata', value: durata, inline: true });
        }
        
        // Aggiungi un footer con il tipo di notifica
        embed.setFooter({ text: `Tipo: ${this.getNotificationName(tipo)} | Inviato da: ${interaction.user.tag}` });
        
        // Trova il canale annunci
        const annunciChannel = interaction.guild?.channels.cache.find(
          channel => channel.name === 'annunci' && channel.isTextBased()
        ) as TextChannel | undefined;
        
        if (!annunciChannel) {
          return interaction.reply({
            content: '❌ Canale degli annunci non trovato. Crea un canale chiamato "annunci" per inviare notifiche.',
            ephemeral: true
          });
        }
        
        // Crea i bottoni di azione (se appropriati per il tipo di notifica)
        const buttons = [];
        
        if (tipo === NotificationType.NEW_SERVER) {
          const joinButton = new ButtonBuilder()
            .setCustomId('join_server')
            .setLabel('Entra nel server')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎮');
          
          buttons.push(joinButton);
        }
        
        if (tipo === NotificationType.MAINTENANCE) {
          const moreInfoButton = new ButtonBuilder()
            .setCustomId('maintenance_info')
            .setLabel('Maggiori informazioni')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('ℹ️');
          
          buttons.push(moreInfoButton);
        }
        
        if (tipo === NotificationType.EVENT) {
          const participateButton = new ButtonBuilder()
            .setCustomId('event_participate')
            .setLabel('Partecipa')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');
          
          const skipButton = new ButtonBuilder()
            .setCustomId('event_skip')
            .setLabel('Non partecipo')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');
          
          buttons.push(participateButton, skipButton);
        }
        
        // Crea la riga di bottoni se ci sono bottoni
        const components = [];
        if (buttons.length > 0) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
          components.push(row);
        }
        
        // Prepara il messaggio di menzione se la notifica è importante
        const mentionContent = importante ? '@everyone' : '';
        
        // Invia la notifica
        await annunciChannel.send({ 
          content: mentionContent, 
          embeds: [embed],
          components: components
        });
        
        // Rispondi all'interazione
        await interaction.reply({
          content: '✅ Notifica inviata con successo nel canale degli annunci!',
          ephemeral: true
        });
        
      } else if (subcommand === 'subscribe' || subcommand === 'unsubscribe') {
        const tipo = interaction.options.getString('tipo') as string;
        const isSubscribing = subcommand === 'subscribe';
        
        // In una implementazione reale, qui salveresti le preferenze dell'utente in un database
        // Per ora rispondiamo semplicemente con un messaggio informativo
        
        // Ottieni il nome leggibile del tipo
        let tipoName = 'tutte le notifiche';
        if (tipo !== 'tutti') {
          tipoName = this.getNotificationName(tipo as NotificationType);
        }
        
        await interaction.reply({
          content: `✅ ${isSubscribing ? 'Iscritto a' : 'Disiscritto da'} ${tipoName} con successo! ${isSubscribing ? 'Riceverai' : 'Non riceverai più'} queste notifiche.`,
          ephemeral: true
        });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando notifica:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
        ephemeral: true
      });
    }
  },
  
  // Metodo per ottenere il colore in base al tipo di notifica
  getNotificationColor(type: NotificationType): number {
    switch (type) {
      case NotificationType.MAINTENANCE:
        return 0xE74C3C; // Rosso
      case NotificationType.NEW_SERVER:
        return 0x2ECC71; // Verde
      case NotificationType.UPDATE:
        return 0x3498DB; // Blu
      case NotificationType.ANNOUNCEMENT:
        return 0xF1C40F; // Giallo
      case NotificationType.EVENT:
        return 0x9B59B6; // Viola
      default:
        return 0x95A5A6; // Grigio
    }
  },
  
  // Metodo per ottenere l'emoji in base al tipo di notifica
  getNotificationEmoji(type: NotificationType): string {
    switch (type) {
      case NotificationType.MAINTENANCE:
        return '🔧';
      case NotificationType.NEW_SERVER:
        return '🎮';
      case NotificationType.UPDATE:
        return '📦';
      case NotificationType.ANNOUNCEMENT:
        return '📢';
      case NotificationType.EVENT:
        return '🎉';
      default:
        return '📌';
    }
  },
  
  // Metodo per ottenere il nome in italiano del tipo di notifica
  getNotificationName(type: NotificationType): string {
    switch (type) {
      case NotificationType.MAINTENANCE:
        return 'Manutenzione programmata';
      case NotificationType.NEW_SERVER:
        return 'Nuovo server';
      case NotificationType.UPDATE:
        return 'Aggiornamento';
      case NotificationType.ANNOUNCEMENT:
        return 'Annuncio';
      case NotificationType.EVENT:
        return 'Evento';
      default:
        return 'Notifica';
    }
  },
  
  // Metodo per gestire l'interazione con i bottoni delle notifiche
  async handleButtonInteraction(client: Client, interaction: any) {
    try {
      const customId = interaction.customId;
      
      if (customId === 'join_server') {
        // Recupera informazioni dal messaggio originale
        const embed = interaction.message.embeds[0];
        const serverField = embed.fields.find((f: any) => f.name === '🎮 Server');
        const serverName = serverField ? serverField.value : 'Server';
        
        // In un'implementazione reale, qui forniresti istruzioni dettagliate o link
        await interaction.reply({
          content: `✅ Ecco le informazioni per connetterti al server **${serverName}**:\n\n`
            + `1. Assicurati di essere connesso alla rete WireGuard\n`
            + `2. Cerca il server nella lista dei server attivi\n`
            + `3. Usa il comando \`/servers\` per maggiori dettagli sul server`,
          ephemeral: true
        });
        
      } else if (customId === 'maintenance_info') {
        await interaction.reply({
          content: 'ℹ️ **Informazioni sulla manutenzione programmata**\n\n'
            + 'Durante la manutenzione, i server potrebbero essere temporaneamente inaccessibili.\n'
            + 'La connessione WireGuard potrebbe interrompersi temporaneamente.\n'
            + 'Tutti i dati saranno salvati e nessun progresso andrà perso.\n\n'
            + 'Per qualsiasi problema dopo la manutenzione, utilizza il comando `/ticket apri`.',
          ephemeral: true
        });
        
      } else if (customId === 'event_participate' || customId === 'event_skip') {
        const isParticipating = customId === 'event_participate';
        
        // In un'implementazione reale, qui registreresti la partecipazione nel database
        
        await interaction.reply({
          content: isParticipating 
            ? '✅ Hai confermato la tua partecipazione all\'evento! Ti invieremo un promemoria poco prima dell\'inizio.'
            : '❌ Hai scelto di non partecipare all\'evento. Puoi cambiare idea in qualsiasi momento.',
          ephemeral: true
        });
      }
      
    } catch (error) {
      console.error('Errore durante la gestione dell\'interazione con i pulsanti delle notifiche:', error);
      
      // Se c'è stato un errore, invia un messaggio di errore
      await interaction.reply({
        content: 'Si è verificato un errore durante l\'elaborazione della tua richiesta. Riprova più tardi.',
        ephemeral: true
      });
    }
  }
};