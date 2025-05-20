import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Client } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Risponde con Pong!'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.reply({ content: 'Pong!', ephemeral: true });
  }
};