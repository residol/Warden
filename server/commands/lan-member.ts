import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder, 
  PermissionFlagsBits,
  GuildMember,
  Role
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lan-member')
    .setDescription('Gestisci gli utenti della rete LAN')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Aggiungi un utente alla rete LAN')
        .addUserOption(option => option.setName('utente').setDescription('L\'utente da aggiungere').setRequired(true))
        .addStringOption(option => option.setName('ip').setDescription('Indirizzo IP da assegnare (es. 10.0.0.10)').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Rimuovi un utente dalla rete LAN')
        .addUserOption(option => option.setName('utente').setDescription('L\'utente da rimuovere').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Elenca tutti gli utenti connessi alla rete LAN')
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Controlla che il ruolo LAN esista
      const guild = interaction.guild;
      let lanRole = guild?.roles.cache.find(role => role.name === 'LAN');
      
      if (!lanRole && (subcommand === 'add' || subcommand === 'remove')) {
        try {
          lanRole = await guild?.roles.create({
            name: 'LAN',
            color: '#36C5F0',
            reason: 'Ruolo per gli utenti della rete LAN',
            permissions: []
          });
          
          await interaction.reply({
            content: 'Il ruolo LAN non esisteva e sono stato costretto a crearlo!',
            ephemeral: true
          });
        } catch (error) {
          return interaction.reply({
            content: 'Non sono riuscito a creare il ruolo LAN. Verifica i miei permessi.',
            ephemeral: true
          });
        }
      }
      
      // Esegui il subcommand appropriato
      switch (subcommand) {
        case 'add':
          return await addMember(interaction, lanRole as Role);
        
        case 'remove':
          return await removeMember(interaction, lanRole as Role);
          
        case 'list':
          return await listMembers(interaction);
          
        default:
          return interaction.reply({
            content: 'Subcomando non riconosciuto.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Errore nell\'esecuzione del comando lan-member:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando.',
        ephemeral: true
      });
    }
  }
};

// Funzione per aggiungere un utente alla LAN
async function addMember(interaction: ChatInputCommandInteraction, lanRole: Role) {
  const targetUser = interaction.options.getUser('utente');
  const targetMember = await interaction.guild?.members.fetch(targetUser!.id);
  const ipAddress = interaction.options.getString('ip') || 'Automatico';
  
  if (!targetMember) {
    return interaction.reply({
      content: 'Utente non trovato nel server.',
      ephemeral: true
    });
  }
  
  // Aggiorna il nickname per includere l'IP se specificato
  let newNickname = targetMember.displayName;
  if (ipAddress !== 'Automatico') {
    // Se l'utente ha già un IP nel nickname, lo sostituiamo
    if (newNickname.match(/\[[\d\.:]+\]/)) {
      newNickname = newNickname.replace(/\[[\d\.:]+\]/, `[${ipAddress}]`);
    } else {
      newNickname = `${newNickname} [${ipAddress}]`;
    }
    
    try {
      await targetMember.setNickname(newNickname);
    } catch (error) {
      console.warn('Non è stato possibile aggiornare il nickname:', error);
      // Continuiamo comunque con l'aggiunta del ruolo
    }
  }
  
  // Aggiungi il ruolo LAN
  await targetMember.roles.add(lanRole);
  
  // Crea un embed per la conferma
  const embed = new EmbedBuilder()
    .setColor('#36C5F0')
    .setTitle('✅ Utente aggiunto alla LAN')
    .setDescription(`**${targetUser?.username}** è stato aggiunto alla rete LAN.`)
    .addFields(
      { name: 'IP', value: ipAddress, inline: true },
      { name: 'Aggiunto da', value: interaction.user.toString(), inline: true }
    )
    .setThumbnail(targetUser?.displayAvatarURL() || null)
    .setTimestamp();
  
  // Invia log nel canale lan-status, se esiste
  const lanStatusChannel = interaction.guild?.channels.cache.find(
    channel => channel.name === 'lan-status'
  );
  
  if (lanStatusChannel?.isTextBased()) {
    await lanStatusChannel.send({ embeds: [embed] });
  }
  
  return interaction.reply({
    content: `✅ **${targetUser?.username}** è stato aggiunto alla rete LAN con IP: ${ipAddress}`,
    ephemeral: true
  });
}

// Funzione per rimuovere un utente dalla LAN
async function removeMember(interaction: ChatInputCommandInteraction, lanRole: Role) {
  const targetUser = interaction.options.getUser('utente');
  const targetMember = await interaction.guild?.members.fetch(targetUser!.id);
  
  if (!targetMember) {
    return interaction.reply({
      content: 'Utente non trovato nel server.',
      ephemeral: true
    });
  }
  
  // Verifica che l'utente abbia il ruolo LAN
  if (!targetMember.roles.cache.has(lanRole.id)) {
    return interaction.reply({
      content: `**${targetUser?.username}** non è un membro della rete LAN.`,
      ephemeral: true
    });
  }
  
  // Rimuovi il ruolo LAN
  await targetMember.roles.remove(lanRole);
  
  // Se l'utente ha un IP nel nickname, lo rimuoviamo
  let newNickname = targetMember.displayName;
  if (newNickname.match(/\[[\d\.:]+\]/)) {
    newNickname = newNickname.replace(/\s?\[[\d\.:]+\]/, '');
    try {
      await targetMember.setNickname(newNickname);
    } catch (error) {
      console.warn('Non è stato possibile aggiornare il nickname:', error);
    }
  }
  
  // Crea un embed per la conferma
  const embed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle('❌ Utente rimosso dalla LAN')
    .setDescription(`**${targetUser?.username}** è stato rimosso dalla rete LAN.`)
    .addFields(
      { name: 'Rimosso da', value: interaction.user.toString(), inline: true }
    )
    .setThumbnail(targetUser?.displayAvatarURL() || null)
    .setTimestamp();
  
  // Invia log nel canale lan-status, se esiste
  const lanStatusChannel = interaction.guild?.channels.cache.find(
    channel => channel.name === 'lan-status'
  );
  
  if (lanStatusChannel?.isTextBased()) {
    await lanStatusChannel.send({ embeds: [embed] });
  }
  
  return interaction.reply({
    content: `❌ **${targetUser?.username}** è stato rimosso dalla rete LAN.`,
    ephemeral: true
  });
}

// Funzione per listare tutti gli utenti della LAN
async function listMembers(interaction: ChatInputCommandInteraction) {
  try {
    // Trova il ruolo LAN
    const guild = interaction.guild;
    const lanRole = guild?.roles.cache.find(role => role.name === 'LAN');
    
    if (!lanRole) {
      return interaction.reply({
        content: 'Il ruolo LAN non esiste ancora.',
        ephemeral: true
      });
    }
    
    // Ottieni tutti i membri con il ruolo LAN
    const members = await guild?.members.fetch();
    const lanMembers = members?.filter(member => member.roles.cache.has(lanRole.id));
    
    if (!lanMembers || lanMembers.size === 0) {
      return interaction.reply({
        content: 'Non ci sono utenti nella rete LAN.',
        ephemeral: true
      });
    }
    
    // Crea un embed con la lista degli utenti
    const embed = new EmbedBuilder()
      .setColor('#36C5F0')
      .setTitle('🌐 Utenti della rete LAN')
      .setDescription(`Ci sono **${lanMembers.size}** utenti connessi alla rete LAN:`)
      .setTimestamp();
    
    // Aggiungi ogni membro all'embed
    lanMembers.forEach(member => {
      // Estrai l'IP dal nickname, se presente
      const ipMatch = member.displayName.match(/\[([\d\.:]+)\]/);
      const ip = ipMatch ? ipMatch[1] : 'Non specificato';
      
      embed.addFields({
        name: member.user.username,
        value: `IP: ${ip}`,
        inline: true
      });
    });
    
    return interaction.reply({
      embeds: [embed],
      ephemeral: false
    });
  } catch (error) {
    console.error('Errore nel listare i membri della LAN:', error);
    return interaction.reply({
      content: 'Si è verificato un errore durante il recupero degli utenti della LAN.',
      ephemeral: true
    });
  }
}