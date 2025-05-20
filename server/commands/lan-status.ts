import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  AttachmentBuilder
} from 'discord.js';
import { storage } from '../storage';

export default {
  data: new SlashCommandBuilder()
    .setName('lan-status')
    .setDescription('Mostra lo stato attuale della LAN e dei server attivi'),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();
      
      // Ottieni tutti i server dal sistema
      const servers = await storage.getAllServers();
      
      // Filtra i server attivi
      const activeServers = servers.filter(server => server.status === 'online');
      
      // Ottieni informazioni sulle connessioni WireGuard
      const wireguardPeers = await storage.getAllWireguardPeers();
      const activeConnections = wireguardPeers.filter(peer => peer.isOnline);
      
      // Crea statistiche di base
      const totalServers = servers.length;
      const totalActiveUsers = activeConnections.length;
      
      // Crea l'embed principale con stato LAN
      const embed = new EmbedBuilder()
        .setTitle('🌐 Stato della LAN "Giardini di Bellion"')
        .setDescription('Panoramica dello stato attuale della rete LAN e dei server di gioco connessi.')
        .setColor('#3498DB')
        .setTimestamp();
      
      // Aggiungi informazioni generali
      embed.addFields(
        { name: '🟢 Server attivi', value: `${activeServers.length}/${totalServers}`, inline: true },
        { name: '👥 Utenti connessi', value: `${totalActiveUsers}`, inline: true },
        { name: '📊 Prestazioni rete', value: 'Ottime', inline: true }
      );
      
      // Aggiungi sezione con server online
      if (activeServers.length > 0) {
        const serversInfo = activeServers.map(server => {
          const playerInfo = server.currentPlayers && server.maxPlayers 
            ? `${server.currentPlayers}/${server.maxPlayers} giocatori`
            : 'Giocatori sconosciuti';
          
          return `**${server.name}** (${server.type}) - ${playerInfo}`;
        }).join('\\n');
        
        embed.addFields({ name: '🎮 Server Online', value: serversInfo });
      } else {
        embed.addFields({ name: '🎮 Server Online', value: 'Nessun server attivo al momento' });
      }
      
      // Aggiungi informazioni sugli utenti più attivi
      // In un'implementazione reale, qui leggeremmo le statistiche dei giocatori dal database
      const topPlayers = [
        { name: 'GiardinieroX', hours: 42 },
        { name: 'BellionFan99', hours: 36 },
        { name: 'CrafterPro', hours: 28 }
      ];
      
      // Simula un server operativo da 30 giorni
      const uptime = 30 * 24; // 30 giorni in ore
      
      // Formatta le ore in un formato più leggibile
      const formatHours = (hours: number): string => {
        if (hours < 24) return `${hours} ore`;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}g ${remainingHours}h` : `${days} giorni`;
      };
      
      // Aggiungi i top player
      const topPlayersText = topPlayers.map((player, index) => 
        `${index + 1}. **${player.name}** - ${formatHours(player.hours)}`
      ).join('\\n');
      
      embed.addFields(
        { name: '⏱️ Uptime LAN', value: formatHours(uptime), inline: true },
        { name: '🏆 Giocatori più attivi', value: topPlayersText }
      );
      
      // Suggerimenti e consigli
      embed.addFields({
        name: '💡 Suggerimenti',
        value: '• Usa `/lan-access` per generare la tua configurazione WireGuard\n'
             + '• Usa `/servers` per vedere i dettagli di tutti i server\n'
             + '• Usa `/stats` per controllare le tue statistiche di gioco'
      });
      
      // Piè di pagina
      embed.setFooter({ text: 'I Giardini di Bellion - Comunità Gaming LAN' });
      
      // Invia il messaggio
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando lan-status:', error);
      
      // Se la risposta non è stata già inviata
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'Si è verificato un errore durante il recupero dello stato della LAN. Riprova più tardi.'
        });
      } else {
        await interaction.reply({
          content: 'Si è verificato un errore durante il recupero dello stato della LAN. Riprova più tardi.',
          ephemeral: true
        });
      }
    }
  }
};