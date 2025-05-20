import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  TextChannel
} from 'discord.js';

// Memorizza gli eventi attivi
const activeEvents = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Gestisci eventi della community')
    .addSubcommand(subcommand =>
      subcommand
        .setName('crea')
        .setDescription('Crea un nuovo evento della community')
        .addStringOption(option => 
          option.setName('titolo')
            .setDescription('Titolo dell\'evento')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('descrizione')
            .setDescription('Descrizione dell\'evento')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('data')
            .setDescription('Data dell\'evento (formato: GG/MM/AAAA)')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('ora')
            .setDescription('Ora dell\'evento (formato: HH:MM)')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('tipo')
            .setDescription('Tipo di evento')
            .setRequired(true)
            .addChoices(
              { name: 'Torneo Minecraft', value: 'minecraft_tournament' },
              { name: 'Giornata Rust', value: 'rust_day' },
              { name: 'Manutenzione LAN', value: 'lan_maintenance' },
              { name: 'Altro', value: 'other' }
            ))
        .addChannelOption(option =>
          option.setName('canale')
            .setDescription('Canale dove pubblicare l\'evento (default: canale corrente)')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lista')
        .setDescription('Mostra tutti gli eventi programmati')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancella')
        .setDescription('Cancella un evento')
        .addStringOption(option => 
          option.setName('id')
            .setDescription('ID dell\'evento da cancellare')
            .setRequired(true))
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'crea':
          return await createEvent(client, interaction);
        
        case 'lista':
          return await listEvents(interaction);
          
        case 'cancella':
          return await cancelEvent(client, interaction);
          
        default:
          return interaction.reply({
            content: 'Subcomando non riconosciuto.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Errore nell\'esecuzione del comando evento:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando.',
        ephemeral: true
      });
    }
  }
};

// Funzione per creare un nuovo evento
async function createEvent(client: Client, interaction: ChatInputCommandInteraction) {
  // Ottieni i dati dell'evento
  const title = interaction.options.getString('titolo')!;
  const description = interaction.options.getString('descrizione')!;
  const date = interaction.options.getString('data')!;
  const time = interaction.options.getString('ora')!;
  const type = interaction.options.getString('tipo')!;
  const targetChannel = interaction.options.getChannel('canale') || interaction.channel;
  
  // Verifica che il canale sia un canale di testo
  if (!targetChannel?.isTextBased()) {
    return interaction.reply({
      content: 'Il canale selezionato non è un canale di testo.',
      ephemeral: true
    });
  }

  // Genera un ID univoco per l'evento
  const eventId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  // Ottieni l'emoji in base al tipo di evento
  let emoji = '🎮';
  let color = '#3498db';
  
  switch (type) {
    case 'minecraft_tournament':
      emoji = '⛏️';
      color = '#4CAF50';
      break;
    case 'rust_day':
      emoji = '🔫';
      color = '#FF9800';
      break;
    case 'lan_maintenance':
      emoji = '🔧';
      color = '#E91E63';
      break;
    case 'other':
      emoji = '📌';
      color = '#9C27B0';
      break;
  }
  
  // Crea l'embed per l'evento
  const eventEmbed = new EmbedBuilder()
    .setColor(color as any)
    .setTitle(`${emoji} EVENTO: ${title}`)
    .setDescription(description)
    .addFields(
      { name: '📅 Data', value: date, inline: true },
      { name: '⏰ Ora', value: time, inline: true },
      { name: '👥 Partecipanti', value: '0', inline: true },
      { name: '🏷️ Tipo', value: interaction.options.getString('tipo')!.replace('_', ' ').toUpperCase(), inline: true },
      { name: '📝 Organizzatore', value: interaction.user.toString(), inline: true },
      { name: 'ℹ️ ID Evento', value: eventId, inline: true }
    )
    .setFooter({ text: `Per partecipare, clicca sul pulsante "Partecipa" qui sotto` })
    .setTimestamp();
  
  // Crea i pulsanti per la partecipazione
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`event_join_${eventId}`)
        .setLabel('Partecipa')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`event_leave_${eventId}`)
        .setLabel('Ritira')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );
  
  // Invia l'evento nel canale target
  const eventMessage = await (targetChannel as TextChannel).send({
    embeds: [eventEmbed],
    components: [row]
  });
  
  // Salva l'evento nella memoria
  activeEvents.set(eventId, {
    id: eventId,
    title,
    description,
    date,
    time,
    type,
    messageId: eventMessage.id,
    channelId: targetChannel.id,
    organizerId: interaction.user.id,
    participants: new Set()
  });
  
  // Risposta all'utente
  return interaction.reply({
    content: `✅ Evento "${title}" creato con successo nel canale <#${targetChannel.id}>!`,
    ephemeral: true
  });
}

// Funzione per listare tutti gli eventi
async function listEvents(interaction: ChatInputCommandInteraction) {
  if (activeEvents.size === 0) {
    return interaction.reply({
      content: 'Non ci sono eventi programmati al momento.',
      ephemeral: true
    });
  }
  
  const eventsEmbed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('📅 Eventi della Community')
    .setDescription('Ecco gli eventi programmati:')
    .setTimestamp();
  
  // Aggiungi ogni evento all'embed
  activeEvents.forEach(event => {
    eventsEmbed.addFields({
      name: `${event.title} - ${event.date} alle ${event.time}`,
      value: `ID: \`${event.id}\`\nPartecipanti: ${event.participants.size}\nTipo: ${event.type.replace('_', ' ').toUpperCase()}`,
      inline: false
    });
  });
  
  return interaction.reply({
    embeds: [eventsEmbed],
    ephemeral: false
  });
}

// Funzione per cancellare un evento
async function cancelEvent(client: Client, interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getString('id')!;
  
  if (!activeEvents.has(eventId)) {
    return interaction.reply({
      content: 'Evento non trovato. Verifica l\'ID e riprova.',
      ephemeral: true
    });
  }
  
  const event = activeEvents.get(eventId);
  
  // Verifica che l'utente sia l'organizzatore dell'evento o un amministratore
  if (event.organizerId !== interaction.user.id && !interaction.memberPermissions?.has('Administrator')) {
    return interaction.reply({
      content: 'Solo l\'organizzatore dell\'evento o un amministratore può cancellare l\'evento.',
      ephemeral: true
    });
  }
  
  try {
    // Trova il messaggio dell'evento
    const channel = await client.channels.fetch(event.channelId) as TextChannel;
    const message = await channel.messages.fetch(event.messageId);
    
    // Modifica l'embed per mostrare che l'evento è stato cancellato
    const cancelledEmbed = EmbedBuilder.from(message.embeds[0])
      .setColor('#FF0000')
      .setTitle(`❌ EVENTO CANCELLATO: ${event.title}`)
      .setFooter({ text: `Evento cancellato da ${interaction.user.username}` });
    
    // Aggiorna il messaggio rimuovendo i pulsanti
    await message.edit({
      embeds: [cancelledEmbed],
      components: []
    });
    
    // Rimuovi l'evento dalla memoria
    activeEvents.delete(eventId);
    
    return interaction.reply({
      content: `✅ L'evento "${event.title}" è stato cancellato con successo.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Errore durante la cancellazione dell\'evento:', error);
    return interaction.reply({
      content: 'Si è verificato un errore durante la cancellazione dell\'evento.',
      ephemeral: true
    });
  }
}

// Funzione per gestire la partecipazione agli eventi
export async function handleEventButtonInteraction(interaction: any) {
  try {
    const { customId, message } = interaction;
    if (!customId.startsWith('event_join_') && !customId.startsWith('event_leave_')) return false;
    
    const action = customId.startsWith('event_join_') ? 'join' : 'leave';
    const eventId = customId.split('_')[2];
    
    if (!activeEvents.has(eventId)) {
      await interaction.reply({
        content: 'Questo evento non è più attivo.',
        ephemeral: true
      });
      return true;
    }
    
    const event = activeEvents.get(eventId);
    const userId = interaction.user.id;
    
    if (action === 'join') {
      // Aggiungi l'utente alla lista dei partecipanti
      event.participants.add(userId);
      
      await interaction.reply({
        content: `✅ Ti sei iscritto all'evento "${event.title}"`,
        ephemeral: true
      });
    } else {
      // Rimuovi l'utente dalla lista dei partecipanti
      event.participants.delete(userId);
      
      await interaction.reply({
        content: `❌ Hai ritirato la tua partecipazione dall'evento "${event.title}"`,
        ephemeral: true
      });
    }
    
    // Aggiorna l'embed dell'evento con il nuovo conteggio dei partecipanti
    const updatedEmbed = EmbedBuilder.from(message.embeds[0]);
    
    // Trova e aggiorna il campo dei partecipanti
    const fields = updatedEmbed.data.fields!;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].name === '👥 Partecipanti') {
        fields[i].value = event.participants.size.toString();
        break;
      }
    }
    
    await message.edit({
      embeds: [updatedEmbed],
      components: message.components
    });
    
    return true;
  } catch (error) {
    console.error('Errore nella gestione della partecipazione all\'evento:', error);
    return false;
  }
}