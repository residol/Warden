import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Client } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('grant-supporter')
    .setDescription('Assegna o rimuove il ruolo Sostenitore (solo admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addUserOption(option => 
      option
        .setName('utente')
        .setDescription('L\'utente a cui assegnare o rimuovere il ruolo')
        .setRequired(true)
    )
    .addBooleanOption(option => 
      option
        .setName('azione')
        .setDescription('true per aggiungere, false per rimuovere')
        .setRequired(true)
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    // Controlla se l'utente è admin
    const adminId = process.env.ADMIN_USER_ID;
    if (interaction.user.id !== adminId) {
      return interaction.reply({ content: '❌ Non sei autorizzato ad usare questo comando.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('utente');
    const shouldGrant = interaction.options.getBoolean('azione');
    
    if (!targetUser) {
      return interaction.reply({ content: '❌ Utente non valido.', ephemeral: true });
    }

    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID || '');
      if (!guild) {
        return interaction.reply({ content: '❌ Server non trovato.', ephemeral: true });
      }

      const member = await guild.members.fetch(targetUser.id);
      const supporterRoleId = process.env.RUOLO_SOSTENITORE_ID;
      
      if (!supporterRoleId) {
        return interaction.reply({ content: '❌ ID del ruolo Sostenitore non configurato.', ephemeral: true });
      }

      if (shouldGrant) {
        // Assegna il ruolo
        await member.roles.add(supporterRoleId);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Ruolo Assegnato')
          .setDescription(`Il ruolo Sostenitore è stato assegnato a ${targetUser.username}`)
          .setColor('Green')
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      } else {
        // Rimuovi il ruolo
        await member.roles.remove(supporterRoleId);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Ruolo Rimosso')
          .setDescription(`Il ruolo Sostenitore è stato rimosso da ${targetUser.username}`)
          .setColor('Red')
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Errore durante la gestione del ruolo:', error);
      return interaction.reply({ content: '❌ Si è verificato un errore durante l\'esecuzione del comando.', ephemeral: true });
    }
  }
};