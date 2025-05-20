import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Client } from 'discord.js';
import { storage } from '../storage';

export default {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('Elenca gli utenti attualmente connessi alla LAN via WireGuard'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Ottieni i peer WireGuard dal database
      const peers = await storage.getAllWireguardPeers();
      const activePeers = peers.filter(peer => peer.enabled);

      if (activePeers.length === 0) {
        return interaction.editReply('⚠️ Nessun peer connesso.');
      }

      const embed = new EmbedBuilder()
        .setTitle('👥 Peer Connessi')
        .setDescription(activePeers.map(peer => `• \`${peer.deviceName}\` (${peer.ipAddress})`).join('\n'))
        .setColor('Blue')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.editReply('❌ Impossibile recuperare lo stato di WireGuard.');
    }
  }
};