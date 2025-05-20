import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Client } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('guida')
    .setDescription('Istruzioni per configurare il firewall e accedere alla LAN'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Guida Firewall per la LAN')
      .setColor('Orange')
      .setDescription(`
Per connetterti correttamente via WireGuard, segui questi passaggi:

1. Installa il client WireGuard sul tuo dispositivo.

2. Importa il file di configurazione \`.conf\` fornito.

3. Apri queste porte sul firewall del tuo client:
• UDP 51820 (porta predefinita WireGuard)
• TCP 25565 (Minecraft)
• TCP 27015 (Rust)


Windows Firewall
Apri Pannello di Controllo > Sistema e sicurezza > Windows Defender Firewall.
Vai su Impostazioni avanzate > Regole connessioni in entrata > Nuova regola.
Seleziona Porta, scegli UDP, inserisci 51820 e abilita il traffico.
Ripeti per le porte di gioco (TCP 25565 e 27015).

Linux (ufw)
\`\`\`bash
sudo ufw allow 51820/udp
sudo ufw allow 25565/tcp
sudo ufw allow 27015/tcp
sudo ufw reload
\`\`\`
`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};