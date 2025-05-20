import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder
} from 'discord.js';
import { storage } from '../storage';

// Struttura per memorizzare le statistiche di gioco
interface PlayerStats {
  playerId: string;
  username: string;
  totalPlaytime: number; // in minuti
  lastSession: Date;
  serverStats: {
    [serverName: string]: {
      playTime: number;
      lastPlayed: Date;
      connections: number;
    }
  };
}

// Funzione di utilità per formattare il tempo
function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    return `${hours} ore${remainingMinutes > 0 ? ` e ${remainingMinutes} min` : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  return `${days} giorni${remainingHours > 0 ? `, ${remainingHours} ore` : ''}${remainingMinutes > 0 ? ` e ${remainingMinutes} min` : ''}`;
}

// Mock di dati per statistiche - in produzione si userebbero dati reali
const mockPlayerStats: PlayerStats[] = [
  {
    playerId: '123456789',
    username: 'GamerEpico',
    totalPlaytime: 7320, // 122 ore
    lastSession: new Date(Date.now() - 86400000), // 1 giorno fa
    serverStats: {
      'Minecraft Survival': {
        playTime: 4500,
        lastPlayed: new Date(Date.now() - 86400000),
        connections: 45
      },
      'Rust': {
        playTime: 2820,
        lastPlayed: new Date(Date.now() - 172800000), // 2 giorni fa
        connections: 28
      }
    }
  },
  {
    playerId: '987654321',
    username: 'CraftMaster',
    totalPlaytime: 12600, // 210 ore
    lastSession: new Date(Date.now() - 43200000), // 12 ore fa
    serverStats: {
      'Minecraft Survival': {
        playTime: 10800,
        lastPlayed: new Date(Date.now() - 43200000),
        connections: 108
      },
      'Terraria': {
        playTime: 1800,
        lastPlayed: new Date(Date.now() - 604800000), // 7 giorni fa
        connections: 15
      }
    }
  }
];

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Visualizza statistiche di gioco dei server LAN')
    .addSubcommand(subcommand =>
      subcommand
        .setName('player')
        .setDescription('Visualizza statistiche di un giocatore specifico')
        .addUserOption(option => 
          option.setName('utente')
            .setDescription('L\'utente di cui visualizzare le statistiche')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Visualizza statistiche di un server specifico')
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Il server di cui visualizzare le statistiche')
            .setRequired(true)
            .setAutocomplete(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('top')
        .setDescription('Visualizza la classifica dei giocatori')
        .addStringOption(option =>
          option.setName('tipo')
            .setDescription('Il tipo di classifica da visualizzare')
            .setRequired(true)
            .addChoices(
              { name: 'Tempo di gioco', value: 'playtime' },
              { name: 'Connessioni', value: 'connections' }
            ))
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'player') {
        const user = interaction.options.getUser('utente');
        
        // In una implementazione reale, qui si cercherebbe nel database
        // Per ora usiamo un mock di dati
        const playerStats = mockPlayerStats.find(p => p.username === user?.username) || {
          playerId: user?.id || '0',
          username: user?.username || 'Sconosciuto',
          totalPlaytime: 0,
          lastSession: new Date(),
          serverStats: {}
        };
        
        const embed = new EmbedBuilder()
          .setTitle(`📊 Statistiche di ${playerStats.username}`)
          .setDescription(`Ecco le statistiche di gioco per ${playerStats.username} sui server della LAN.`)
          .setColor('#36C5F0')
          .addFields(
            { 
              name: '⏱️ Tempo di gioco totale', 
              value: formatPlaytime(playerStats.totalPlaytime),
              inline: true 
            },
            { 
              name: '🕰️ Ultima sessione', 
              value: playerStats.lastSession.toLocaleDateString('it-IT'), 
              inline: true 
            },
            { 
              name: '🎮 Server giocati', 
              value: Object.keys(playerStats.serverStats).length.toString() || '0',
              inline: true
            }
          )
          .setFooter({ text: 'Statistiche aggiornate al' })
          .setTimestamp();
        
        // Aggiungi statistiche per ogni server
        Object.entries(playerStats.serverStats).forEach(([serverName, stats]) => {
          embed.addFields({
            name: `📊 ${serverName}`,
            value: `⏱️ Tempo: ${formatPlaytime(stats.playTime)}\n🔄 Connessioni: ${stats.connections}\n🕰️ Ultimo accesso: ${stats.lastPlayed.toLocaleDateString('it-IT')}`,
            inline: true
          });
        });
        
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === 'server') {
        const serverName = interaction.options.getString('nome');
        
        // Ottieni la lista di server dal database
        const servers = await storage.getAllServers();
        const server = servers.find(s => s.name === serverName);
        
        if (!server) {
          return interaction.reply({
            content: `⚠️ Server "${serverName}" non trovato. Verifica di aver digitato il nome corretto.`,
            ephemeral: true
          });
        }
        
        // Calcoliamo statistiche mock per il server
        const playersWithStats = mockPlayerStats.filter(p => p.serverStats[server.name]);
        const totalPlaytime = playersWithStats.reduce((sum, player) => 
          sum + (player.serverStats[server.name]?.playTime || 0), 0);
        const totalConnections = playersWithStats.reduce((sum, player) => 
          sum + (player.serverStats[server.name]?.connections || 0), 0);
        
        const embed = new EmbedBuilder()
          .setTitle(`📊 Statistiche del server ${server.name}`)
          .setDescription(`Ecco le statistiche per il server ${server.name}.`)
          .setColor('#43B581')
          .addFields(
            { 
              name: '👥 Giocatori totali', 
              value: playersWithStats.length.toString(),
              inline: true 
            },
            { 
              name: '⏱️ Tempo di gioco totale', 
              value: formatPlaytime(totalPlaytime),
              inline: true 
            },
            { 
              name: '🔄 Connessioni totali', 
              value: totalConnections.toString(),
              inline: true 
            },
            { 
              name: '📈 Stato attuale', 
              value: `${server.status === 'online' ? '🟢 Online' : '🔴 Offline'}\n👥 ${server.currentPlayers}/${server.maxPlayers} giocatori\n🌐 ${server.ipAddress}:${server.port}`,
              inline: false 
            }
          )
          .setFooter({ text: 'Statistiche aggiornate al' })
          .setTimestamp();
        
        // Aggiungi i top player
        if (playersWithStats.length > 0) {
          // Ordina per tempo di gioco
          const topByPlaytime = [...playersWithStats].sort((a, b) => 
            (b.serverStats[server.name]?.playTime || 0) - (a.serverStats[server.name]?.playTime || 0)
          ).slice(0, 3);
          
          let topPlayersText = '';
          topByPlaytime.forEach((player, index) => {
            topPlayersText += `${index + 1}. **${player.username}**: ${formatPlaytime(player.serverStats[server.name]?.playTime || 0)}\n`;
          });
          
          embed.addFields({
            name: '👑 Top giocatori per tempo',
            value: topPlayersText || 'Nessun dato disponibile',
            inline: true
          });
        }
        
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === 'top') {
        const type = interaction.options.getString('tipo');
        
        let sortedPlayers;
        let title;
        let description;
        
        if (type === 'playtime') {
          sortedPlayers = [...mockPlayerStats].sort((a, b) => b.totalPlaytime - a.totalPlaytime);
          title = '🏆 Classifica per tempo di gioco';
          description = 'I giocatori che hanno trascorso più tempo sui server della LAN.';
        } else { // connections
          // Calcola il numero totale di connessioni per ogni giocatore
          sortedPlayers = [...mockPlayerStats].sort((a, b) => {
            const totalA = Object.values(a.serverStats).reduce((sum, stat) => sum + stat.connections, 0);
            const totalB = Object.values(b.serverStats).reduce((sum, stat) => sum + stat.connections, 0);
            return totalB - totalA;
          });
          title = '🏆 Classifica per numero di connessioni';
          description = 'I giocatori che si sono connessi più volte ai server della LAN.';
        }
        
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor('#FFD700')
          .setFooter({ text: 'Statistiche aggiornate al' })
          .setTimestamp();
        
        // Genera la classifica
        let leaderboardText = '';
        
        sortedPlayers.forEach((player, index) => {
          if (type === 'playtime') {
            leaderboardText += `${index + 1}. **${player.username}**: ${formatPlaytime(player.totalPlaytime)}\n`;
          } else {
            const totalConnections = Object.values(player.serverStats)
              .reduce((sum, stat) => sum + stat.connections, 0);
            leaderboardText += `${index + 1}. **${player.username}**: ${totalConnections} connessioni\n`;
          }
        });
        
        embed.addFields({
          name: 'Classifica',
          value: leaderboardText || 'Nessun dato disponibile'
        });
        
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando stats:', error);
      return interaction.reply({
        content: 'Si è verificato un errore durante la visualizzazione delle statistiche. Riprova più tardi.',
        ephemeral: true
      });
    }
  }
};