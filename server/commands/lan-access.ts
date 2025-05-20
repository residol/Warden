import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lan-access')
    .setDescription('Ottieni automaticamente accesso alla rete LAN')
    .addUserOption(option => 
      option.setName('utente')
        .setDescription('Utente a cui dare accesso (solo per admin, lascia vuoto per te stesso)')
        .setRequired(false)),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Verifica che il bot sia configurato correttamente
      const guildId = process.env.GUILD_ID;
      const lanRoleId = process.env.RUOLO_LAN_ID;
      const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID;
      
      if (!guildId || !lanRoleId) {
        return interaction.reply({
          content: 'Configurazione ruoli incompleta. Contatta un amministratore.',
          ephemeral: true
        });
      }

      const guild = await client.guilds.fetch(guildId);
      
      // Determina se l'utente è un admin e chi riceverà il ruolo
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      const targetUser = interaction.options.getUser('utente') || interaction.user;
      
      // Se l'utente ha specificato un altro utente e non è admin, blocca l'operazione
      if (targetUser.id !== interaction.user.id && !isAdmin) {
        return interaction.reply({
          content: 'Solo gli amministratori possono assegnare il ruolo LAN ad altri utenti.',
          ephemeral: true
        });
      }
      
      // Ottieni il membro dal target
      const member = await guild.members.fetch(targetUser.id);
      
      // Controlla se l'utente ha già il ruolo LAN
      if (member.roles.cache.has(lanRoleId)) {
        return interaction.reply({
          content: `${targetUser.id === interaction.user.id ? 'Hai' : `${targetUser.username} ha`} già il ruolo LAN!`,
          ephemeral: true
        });
      }
      
      // Assegna il ruolo LAN
      await member.roles.add(lanRoleId);
      
      // Prepara messaggi di conferma
      const selfMessage = '✅ Hai ottenuto il ruolo **LAN**! Ora puoi accedere ai canali dei Giardini di Bellion e alla rete LAN.';
      const adminMessage = `✅ L'utente **${targetUser.username}** ha ottenuto il ruolo LAN.`;
      
      // Invia conferma
      await interaction.reply({
        content: targetUser.id === interaction.user.id ? selfMessage : adminMessage,
        ephemeral: true
      });
      
      // Invia messaggio pubblico nel canale annunci se esiste
      if (announceChannelId) {
        try {
          const announceChannel = await guild.channels.fetch(announceChannelId);
          if (announceChannel?.isTextBased()) {
            // Crea un embed più accattivante
            const embed = new EmbedBuilder()
              .setColor('#36C5F0')
              .setTitle('🎉 Nuovo membro LAN!')
              .setDescription(`**${targetUser.username}** si è unito alla rete LAN!`)
              .setThumbnail(targetUser.displayAvatarURL())
              .setTimestamp();
            
            await announceChannel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Errore nell\'invio del messaggio nel canale annunci:', error);
        }
      }
      
      // Se l'utente non aveva il ruolo prima, fornisci istruzioni per la connessione
      const followUpMessage = `
Ecco cosa fare per connetterti alla rete LAN:

1️⃣ **Scarica WireGuard** dal sito ufficiale: https://www.wireguard.com/install/

2️⃣ **Ottieni la configurazione personalizzata** usando il comando \`/wireguard config\` (in sviluppo)

3️⃣ **Importa il file di configurazione** in WireGuard

4️⃣ **Attiva la connessione** e sei pronto per giocare!

Per assistenza, scrivi nel canale <#bot-commands> o contatta un amministratore.
      `;
      
      // Invia le istruzioni come messaggio privato a chi ha ricevuto il ruolo
      try {
        if (targetUser.id === interaction.user.id) {
          await interaction.followUp({
            content: followUpMessage,
            ephemeral: true
          });
        } else {
          await member.send(followUpMessage);
          await interaction.followUp({
            content: `✅ Istruzioni di configurazione inviate in un messaggio privato a ${targetUser.username}.`,
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Errore nell\'invio del messaggio privato:', error);
        await interaction.followUp({
          content: 'Non è stato possibile inviare le istruzioni di configurazione in privato. Assicurati di avere i messaggi privati abilitati.',
          ephemeral: true
        });
      }
      
    } catch (error) {
      console.error('Errore durante l\'assegnazione del ruolo LAN:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'assegnazione del ruolo LAN. Riprova più tardi o contatta un amministratore.',
        ephemeral: true
      });
    }
  }
};