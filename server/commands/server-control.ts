import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { storage } from '../storage';
import { pterodactyl } from '../services/pterodactyl';

export default {
  data: new SlashCommandBuilder()
    .setName('server-control')
    .setDescription('Controlla i server di gioco (avvia, ferma, riavvia)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Avvia un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Nome del server da avviare')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Ferma un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Nome del server da fermare')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restart')
        .setDescription('Riavvia un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Nome del server da riavviare')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Visualizza lo stato di un server')
        .addStringOption(option =>
          option
            .setName('server')
            .setDescription('Nome del server')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Verifica che l'utente abbia il ruolo LAN
      const member = interaction.member;
      if (!member) {
        return interaction.reply({
          content: '❌ Non sei un membro del server Discord.',
          ephemeral: true
        });
      }
      
      const hasLanRole = (member as any).roles?.cache?.some((r: any) => r.name === 'LAN');
      
      if (!hasLanRole && !(member as any).permissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ È necessario avere il ruolo **LAN** per utilizzare questo comando.',
          ephemeral: true
        });
      }
      
      const subcommand = interaction.options.getSubcommand();
      const serverName = interaction.options.getString('server');
      
      if (!serverName) {
        return interaction.reply({
          content: '❌ Nome del server non specificato.',
          ephemeral: true
        });
      }
      
      // Ottieni il server dal database
      const servers = await storage.getAllServers();
      const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
      
      if (!server) {
        return interaction.reply({
          content: `❌ Server "${serverName}" non trovato. Verifica di aver specificato il nome corretto.`,
          ephemeral: true
        });
      }
      
      // Controllo che l'utente abbia i permessi per gestire questo server
      // Solo gli admin possono gestire i server che non sono loro
      const isAdmin = (member as any).permissions?.has(PermissionFlagsBits.Administrator);
      
      // Per ora consentiamo a tutti gli utenti LAN di gestire tutti i server
      // In una implementazione reale, verificheremmo se l'utente è il proprietario o un admin
      
      if (subcommand === 'start') {
        // Verifica che il server non sia già online
        if (server.status === 'online') {
          return interaction.reply({
            content: `⚠️ Il server "${server.name}" è già online!`,
            ephemeral: true
          });
        }
        
        await interaction.deferReply();
        
        try {
          // In una implementazione reale, qui chiameremmo l'API di Pterodactyl
          // per avviare il server
          if (server.pterodactylId) {
            await pterodactyl.startServer(server.pterodactylId);
          }
          
          // Aggiorna lo stato del server nel database
          await storage.updateServer(server.id, { status: 'starting' });
          
          const embed = new EmbedBuilder()
            .setTitle(`🚀 Avvio del server ${server.name}`)
            .setDescription(`Il server **${server.name}** è in fase di avvio. Potrebbe richiedere fino a 1-2 minuti.`)
            .setColor('#43B581')
            .addFields(
              { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: true },
              { name: 'Tipo', value: server.type, inline: true }
            )
            .setFooter({ text: `Avviato da ${interaction.user.tag}` })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          // Simuliamo l'avvio del server dopo 5 secondi
          setTimeout(async () => {
            await storage.updateServer(server.id, { 
              status: 'online',
              currentPlayers: 0
            });
            
            // Notifica il canale degli annunci
            const guild = interaction.guild;
            if (guild) {
              const announcesChannel = guild.channels.cache.find(
                ch => ch.name === 'annunci' && ch.isTextBased()
              );
              
              if (announcesChannel && announcesChannel.isTextBased()) {
                const announceEmbed = new EmbedBuilder()
                  .setTitle(`✅ Server ${server.name} online!`)
                  .setDescription(`Il server **${server.name}** è ora disponibile.`)
                  .setColor('#43B581')
                  .addFields(
                    { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: true },
                    { name: 'Tipo', value: server.type, inline: true },
                    { name: 'Giocatori', value: `0/${server.maxPlayers}`, inline: true }
                  )
                  .setTimestamp();
                
                await announcesChannel.send({ embeds: [announceEmbed] });
              }
            }
          }, 5000);
        } catch (error) {
          console.error('Errore durante l\'avvio del server:', error);
          await interaction.editReply({
            content: `❌ Si è verificato un errore durante l'avvio del server "${server.name}". Riprova più tardi.`
          });
        }
      }
      else if (subcommand === 'stop') {
        // Verifica che il server sia online
        if (server.status !== 'online' && server.status !== 'starting') {
          return interaction.reply({
            content: `⚠️ Il server "${server.name}" non è online!`,
            ephemeral: true
          });
        }
        
        await interaction.deferReply();
        
        try {
          // In una implementazione reale, qui chiameremmo l'API di Pterodactyl
          if (server.pterodactylId) {
            await pterodactyl.stopServer(server.pterodactylId);
          }
          
          // Aggiorna lo stato del server nel database
          await storage.updateServer(server.id, { status: 'stopping' });
          
          const embed = new EmbedBuilder()
            .setTitle(`🛑 Arresto del server ${server.name}`)
            .setDescription(`Il server **${server.name}** è in fase di arresto. Potrebbe richiedere fino a 1-2 minuti.`)
            .setColor('#F04747')
            .addFields(
              { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: true },
              { name: 'Tipo', value: server.type, inline: true }
            )
            .setFooter({ text: `Fermato da ${interaction.user.tag}` })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          // Simuliamo l'arresto del server dopo 5 secondi
          setTimeout(async () => {
            await storage.updateServer(server.id, { 
              status: 'offline',
              currentPlayers: 0
            });
            
            // Notifica il canale degli annunci
            const guild = interaction.guild;
            if (guild) {
              const announcesChannel = guild.channels.cache.find(
                ch => ch.name === 'annunci' && ch.isTextBased()
              );
              
              if (announcesChannel && announcesChannel.isTextBased()) {
                const announceEmbed = new EmbedBuilder()
                  .setTitle(`⏹️ Server ${server.name} offline`)
                  .setDescription(`Il server **${server.name}** è stato fermato.`)
                  .setColor('#F04747')
                  .addFields(
                    { name: 'Tipo', value: server.type, inline: true }
                  )
                  .setTimestamp();
                
                await announcesChannel.send({ embeds: [announceEmbed] });
              }
            }
          }, 5000);
        } catch (error) {
          console.error('Errore durante l\'arresto del server:', error);
          await interaction.editReply({
            content: `❌ Si è verificato un errore durante l'arresto del server "${server.name}". Riprova più tardi.`
          });
        }
      }
      else if (subcommand === 'restart') {
        // Verifica che il server sia online
        if (server.status !== 'online') {
          return interaction.reply({
            content: `⚠️ Il server "${server.name}" non è online! Puoi avviarlo con \`/server-control start server:${server.name}\`.`,
            ephemeral: true
          });
        }
        
        await interaction.deferReply();
        
        try {
          // In una implementazione reale, qui chiameremmo l'API di Pterodactyl
          if (server.pterodactylId) {
            await pterodactyl.restartServer(server.pterodactylId);
          }
          
          // Aggiorna lo stato del server nel database
          await storage.updateServer(server.id, { status: 'restarting' });
          
          const embed = new EmbedBuilder()
            .setTitle(`🔄 Riavvio del server ${server.name}`)
            .setDescription(`Il server **${server.name}** è in fase di riavvio. Potrebbe richiedere fino a 1-2 minuti.`)
            .setColor('#FAA61A')
            .addFields(
              { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: true },
              { name: 'Tipo', value: server.type, inline: true }
            )
            .setFooter({ text: `Riavviato da ${interaction.user.tag}` })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          // Simuliamo il riavvio del server dopo 8 secondi
          setTimeout(async () => {
            await storage.updateServer(server.id, { 
              status: 'online'
            });
            
            // Notifica il canale degli annunci
            const guild = interaction.guild;
            if (guild) {
              const announcesChannel = guild.channels.cache.find(
                ch => ch.name === 'annunci' && ch.isTextBased()
              );
              
              if (announcesChannel && announcesChannel.isTextBased()) {
                const announceEmbed = new EmbedBuilder()
                  .setTitle(`✅ Server ${server.name} riavviato`)
                  .setDescription(`Il server **${server.name}** è stato riavviato ed è ora disponibile.`)
                  .setColor('#43B581')
                  .addFields(
                    { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: true },
                    { name: 'Tipo', value: server.type, inline: true },
                    { name: 'Giocatori', value: `0/${server.maxPlayers}`, inline: true }
                  )
                  .setTimestamp();
                
                await announcesChannel.send({ embeds: [announceEmbed] });
              }
            }
          }, 8000);
        } catch (error) {
          console.error('Errore durante il riavvio del server:', error);
          await interaction.editReply({
            content: `❌ Si è verificato un errore durante il riavvio del server "${server.name}". Riprova più tardi.`
          });
        }
      }
      else if (subcommand === 'status') {
        // Crea un embed con le informazioni sul server
        const statusText = this.getStatusEmoji(server.status);
        const statusColor = this.getStatusColor(server.status);
        
        const embed = new EmbedBuilder()
          .setTitle(`${statusText} Server ${server.name}`)
          .setDescription(`Informazioni dettagliate sul server **${server.name}**.`)
          .setColor(statusColor)
          .addFields(
            { name: 'Stato', value: `${statusText} ${this.getStatusText(server.status)}`, inline: true },
            { name: 'Tipo', value: server.type, inline: true },
            { name: 'Giocatori', value: `${server.currentPlayers || 0}/${server.maxPlayers || 0}`, inline: true },
            { name: 'IP', value: `\`${server.ipAddress}:${server.port}\``, inline: false }
          )
          .setFooter({ text: `ID: ${server.id}` })
          .setTimestamp();
        
        // Se ci sono giocatori connessi, mostrali
        if (server.status === 'online' && (server.currentPlayers || 0) > 0 && server.playerList && server.playerList.length > 0) {
          embed.addFields({
            name: '👥 Giocatori online',
            value: server.playerList.join(', '),
            inline: false
          });
        }
        
        // Aggiungi pulsanti per il controllo rapido
        // (in un'implementazione avanzata, questi sarebbero pulsanti Discord)
        const actions = [
          server.status === 'online' ? '`/server-control stop server:' + server.name + '`' : '',
          server.status === 'online' ? '`/server-control restart server:' + server.name + '`' : '',
          server.status !== 'online' ? '`/server-control start server:' + server.name + '`' : '',
        ].filter(Boolean);
        
        if (actions.length > 0) {
          embed.addFields({
            name: '🔧 Azioni disponibili',
            value: actions.join('\n'),
            inline: false
          });
        }
        
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando server-control:', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.'
        });
      } else {
        await interaction.reply({
          content: 'Si è verificato un errore durante l\'esecuzione del comando. Riprova più tardi.',
          ephemeral: true
        });
      }
    }
  },
  
  // Metodo per ottenere l'emoji dello stato
  getStatusEmoji(status: string): string {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'starting':
        return '🚀';
      case 'stopping':
        return '🛑';
      case 'restarting':
        return '🔄';
      default:
        return '⚪';
    }
  },
  
  // Metodo per ottenere il colore dello stato
  getStatusColor(status: string): number {
    switch (status) {
      case 'online':
        return 0x43B581; // Verde
      case 'offline':
        return 0xF04747; // Rosso
      case 'starting':
        return 0x3498DB; // Blu
      case 'stopping':
        return 0xF1C40F; // Giallo
      case 'restarting':
        return 0xFAA61A; // Arancione
      default:
        return 0x95A5A6; // Grigio
    }
  },
  
  // Metodo per ottenere il testo dello stato
  getStatusText(status: string): string {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'starting':
        return 'In avvio...';
      case 'stopping':
        return 'In arresto...';
      case 'restarting':
        return 'In riavvio...';
      default:
        return 'Sconosciuto';
    }
  }
};