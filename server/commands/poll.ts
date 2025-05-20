import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  MessageReaction,
  User,
  TextChannel
} from 'discord.js';

// Salviamo i sondaggi attivi in memoria
const activePolls = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Crea un sondaggio per scegliere il prossimo modpack')
    .addStringOption(option => 
      option.setName('titolo')
        .setDescription('Titolo del sondaggio')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('opzione1')
        .setDescription('Prima opzione del sondaggio')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('opzione2')
        .setDescription('Seconda opzione del sondaggio')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('opzione3')
        .setDescription('Terza opzione del sondaggio')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('opzione4')
        .setDescription('Quarta opzione del sondaggio')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('opzione5')
        .setDescription('Quinta opzione del sondaggio')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('durata')
        .setDescription('Durata del sondaggio in giorni (default: 7)')
        .setMinValue(1)
        .setMaxValue(30)
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('canale')
        .setDescription('Canale dove pubblicare il sondaggio (default: canale corrente)')
        .setRequired(false)),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Ottieni i dati del sondaggio
      const title = interaction.options.getString('titolo');
      const options = [
        interaction.options.getString('opzione1'),
        interaction.options.getString('opzione2'),
        interaction.options.getString('opzione3'),
        interaction.options.getString('opzione4'),
        interaction.options.getString('opzione5')
      ].filter(Boolean); // Rimuovi le opzioni vuote
      
      const duration = interaction.options.getInteger('durata') || 7; // Default: 7 giorni
      const targetChannel = interaction.options.getChannel('canale') || interaction.channel;
      
      // Verifica che il canale sia un canale di testo
      if (!targetChannel?.isTextBased()) {
        return interaction.reply({
          content: 'Il canale selezionato non è un canale di testo.',
          ephemeral: true
        });
      }

      // Crea l'embed per il sondaggio
      const pollEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`📊 SONDAGGIO: ${title}`)
        .setDescription('Vota per il prossimo modpack che sarà installato sul server Minecraft della community!')
        .addFields(
          options.map((option, index) => ({
            name: `Opzione ${index + 1}`,
            value: option as string,
            inline: true
          }))
        )
        .setFooter({ text: `Sondaggio creato da ${interaction.user.username} • Termine: ${new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString()}` })
        .setTimestamp();

      // Crea i pulsanti per il voto
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      options.forEach((_, index) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_option_${index + 1}`)
            .setLabel(`Opzione ${index + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

      // Notifica che il sondaggio è stato creato
      await interaction.reply({
        content: `Creazione del sondaggio "${title}" in corso...`,
        ephemeral: true
      });

      // Invia il sondaggio nel canale target
      const pollMessage = await (targetChannel as TextChannel).send({
        embeds: [pollEmbed],
        components: [row]
      });

      // Salva il sondaggio attivo
      activePolls.set(pollMessage.id, {
        title,
        options,
        votes: new Map(), // Mappa userID -> optionIndex
        endTime: Date.now() + duration * 24 * 60 * 60 * 1000,
        channelId: targetChannel.id,
        authorId: interaction.user.id
      });

      // Imposta un timer per concludere il sondaggio
      setTimeout(() => {
        endPoll(client, pollMessage.id);
      }, duration * 24 * 60 * 60 * 1000);

      // Notifica che il sondaggio è stato creato con successo
      await interaction.followUp({
        content: `Il sondaggio è stato creato con successo nel canale <#${targetChannel.id}>! Rimarrà aperto per ${duration} giorni.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Errore nella creazione del sondaggio:', error);
      await interaction.reply({
        content: 'Si è verificato un errore durante la creazione del sondaggio.',
        ephemeral: true
      });
    }
  }
};

// Funzione per concludere un sondaggio
async function endPoll(client: Client, messageId: string) {
  try {
    const poll = activePolls.get(messageId);
    if (!poll) return;

    const { title, options, votes, channelId } = poll;

    // Calcola i risultati
    const results = Array(options.length).fill(0);
    votes.forEach(optionIndex => {
      results[optionIndex - 1]++;
    });

    // Trova l'opzione vincitrice
    const maxVotes = Math.max(...results);
    const winnerIndices = results.map((votes, index) => votes === maxVotes ? index : -1).filter(index => index !== -1);
    const winnerOptions = winnerIndices.map(index => options[index]);

    // Crea l'embed dei risultati
    const resultsEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle(`📊 RISULTATI SONDAGGIO: ${title}`)
      .setDescription(winnerIndices.length === 1 
        ? `🏆 Il modpack vincitore è: **${winnerOptions[0]}**`
        : `🏆 C'è un pareggio tra: **${winnerOptions.join('** e **')}**`)
      .addFields(
        options.map((option, index) => ({
          name: `${results[index]} voti - ${option}`,
          value: createProgressBar(results[index], Math.max(...results)) + ` (${results[index]} voti)`,
          inline: false
        }))
      )
      .setFooter({ text: `Sondaggio concluso • Voti totali: ${votes.size}` })
      .setTimestamp();

    // Ottieni il canale e invia i risultati
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (channel) {
      try {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          await message.edit({ 
            embeds: [resultsEmbed],
            components: [] // Rimuovi i pulsanti
          });
        }
      } catch (err) {
        // Se il messaggio non esiste più, invia un nuovo messaggio con i risultati
        await channel.send({ embeds: [resultsEmbed] });
      }
    }

    // Rimuovi il sondaggio dalla lista dei sondaggi attivi
    activePolls.delete(messageId);
  } catch (error) {
    console.error('Errore nella conclusione del sondaggio:', error);
  }
}

// Funzione per creare una barra di progresso
function createProgressBar(value: number, maxValue: number, size: number = 20): string {
  if (maxValue === 0) return '░'.repeat(size);
  
  const percentage = value / maxValue;
  const filledBars = Math.round(percentage * size);
  const emptyBars = size - filledBars;
  
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

// Gestore di eventi per le interazioni con i pulsanti
export async function handlePollButtonInteraction(interaction: any) {
  try {
    const { customId, message } = interaction;
    if (!customId.startsWith('poll_option_')) return false;

    const messageId = message.id;
    const poll = activePolls.get(messageId);

    if (!poll) {
      await interaction.reply({
        content: 'Questo sondaggio non è più attivo.',
        ephemeral: true
      });
      return true;
    }

    const optionNumber = parseInt(customId.split('_')[2]);
    const userId = interaction.user.id;

    // Aggiorna il voto dell'utente
    poll.votes.set(userId, optionNumber);

    // Aggiorna l'embed del sondaggio con i conteggi dei voti
    const results = Array(poll.options.length).fill(0);
    poll.votes.forEach(vote => {
      results[vote - 1]++;
    });

    const voteCounts = poll.options.map((option, index) => 
      `Opzione ${index + 1}: ${results[index]} voti`
    ).join('\n');

    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
      .setFields(
        poll.options.map((option, index) => ({
          name: `Opzione ${index + 1} (${results[index]} voti)`,
          value: option,
          inline: true
        }))
      );

    await message.edit({
      embeds: [updatedEmbed],
      components: message.components
    });

    await interaction.reply({
      content: `Hai votato per l'opzione ${optionNumber}: ${poll.options[optionNumber - 1]}`,
      ephemeral: true
    });

    return true;
  } catch (error) {
    console.error('Errore nella gestione del voto:', error);
    return false;
  }
}