import { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('donate')
    .setDescription('Ricevi il link per supportare il progetto'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const link = process.env.LINK_DONAZIONI || 'https://ko-fi.com/residol';

    const embed = new EmbedBuilder()
      .setTitle('🙏 Supporta il Progetto')
      .setDescription(`[Clicca qui per donare](${link})`)
      .setColor('Gold')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};