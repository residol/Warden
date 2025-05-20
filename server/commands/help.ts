import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Client } from 'discord.js';

const commandsList = [
  { cmd: '/ping', desc: 'Controlla la latenza del bot' },
  { cmd: '/servers', desc: 'Elenca i server Pterodactyl online' },
  { cmd: '/players', desc: 'Mostra chi è connesso alla LAN' },
  { cmd: '/donate', desc: 'Link per supportare il progetto' },
  { cmd: '/grant-supporter', desc: 'Assegna/rimuove il ruolo Sostenitore (admin)' },
  { cmd: '/help', desc: 'Mostra questa guida rapida' },
  { cmd: '/guida', desc: 'Istruzioni firewall per la LAN' }
];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra i comandi disponibili'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🆘 Help - Comandi Disponibili')
      .setColor('Grey')
      .setTimestamp()
      .addFields(commandsList.map(c => ({ name: c.cmd, value: c.desc, inline: false })));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};