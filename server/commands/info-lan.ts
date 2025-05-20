import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('info-lan')
    .setDescription('Informazioni sulla LAN Giardini di Bellion'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Crea un embed con le informazioni sulla LAN
      const embed = new EmbedBuilder()
        .setTitle('🌿 Benvenuto ai Giardini di Bellion 🌿')
        .setColor('#36C5F0')
        .setDescription(
          'I **Giardini di Bellion** sono una community di giocatori uniti dalla passione per i videogiochi e dalla voglia di condividere esperienze in un ambiente amichevole e accogliente.'
        )
        .addFields(
          { 
            name: '📜 Storia', 
            value: 'La LAN è nata nell\'estate del 2023 da un piccolo gruppo di amici che desideravano uno spazio dove giocare insieme senza le limitazioni dei server pubblici. Il nome "Giardini di Bellion" si ispira all\'idea di un giardino virtuale dove le persone possono coltivare amicizie e divertimento.', 
            inline: false 
          },
          { 
            name: '🔄 Evoluzione', 
            value: 'Ciò che è iniziato con un semplice server Minecraft si è evoluto in una rete che ospita diversi giochi. La crescita è stata guidata dalle richieste della community e dalla volontà di creare un ecosistema integrato.', 
            inline: false 
          },
          { 
            name: '🛠️ Tecnologia', 
            value: 'La rete utilizza **WireGuard** come tecnologia VPN per garantire connessioni sicure e stabili tra tutti i membri. I server di gioco sono gestiti tramite **Pterodactyl**, una piattaforma che permette di gestire facilmente diversi tipi di server.', 
            inline: false 
          },
          { 
            name: '👥 Community', 
            value: 'L\'aspetto più importante dei Giardini di Bellion è la sua community. Accogliamo giocatori di ogni livello di esperienza che condividono i nostri valori di rispetto e collaborazione.',
            inline: false 
          },
          { 
            name: '🌱 Valori', 
            value: '• **Inclusività**: Tutti sono benvenuti indipendentemente dall\'esperienza\n• **Rispetto**: Ci trattiamo reciprocamente con cortesia\n• **Collaborazione**: Aiutarsi a vicenda è fondamentale\n• **Divertimento**: Il nostro obiettivo principale è divertirci insieme', 
            inline: false 
          },
          { 
            name: '🎮 Server disponibili', 
            value: 'Attualmente ospitiamo server per:\n• **Minecraft** (Vanilla e vari modpack)\n• **Terraria**\n• **Valheim**\n• Altri giochi su richiesta della community', 
            inline: false 
          },
          { 
            name: '🔑 Come unirsi', 
            value: 'Per entrare a far parte della community:\n1. Ottieni il ruolo LAN nel canale <#ruoli>\n2. Usa il comando `/lan-access` per ottenere la configurazione WireGuard\n3. Configura il client WireGuard sul tuo dispositivo\n4. Collegati ai server attraverso gli indirizzi IP della LAN', 
            inline: false 
          }
        )
        .setFooter({ text: 'Per maggiori informazioni, consulta il canale #guida o contatta un amministratore' })
        .setTimestamp();

      // Invia la risposta
      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando info-lan:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
        ephemeral: true
      });
    }
  }
};