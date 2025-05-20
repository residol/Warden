import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Client } from 'discord.js';
import { storage } from '../storage';

export default {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Elenca i server di gioco attualmente disponibili'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Ottieni i server dal database
      const servers = await storage.getAllServers();
      
      if (servers.length === 0) {
        return interaction.editReply('⚠️ Nessun server disponibile.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Server Disponibili')
        .setColor('#7289DA')
        .setTimestamp();

      // Aggiungi i server all'embed
      servers.forEach(server => {
        const statusEmoji = server.status === 'online' ? '🟢' : 
                           server.status === 'restarting' ? '🔄' : 
                           server.status === 'starting' ? '⏳' : '🔴';
        
        const playersInfo = server.status === 'online' 
          ? `${server.currentPlayers}/${server.maxPlayers} giocatori online`
          : 'Offline';
        
        embed.addFields({
          name: `${statusEmoji} ${server.name} (${server.type})`,
          value: `IP: \`${server.ipAddress}:${server.port}\`\nStato: ${server.status}\n${playersInfo}`,
          inline: true
        });
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.editReply('❌ Impossibile recuperare i server.');
    }
  }
};