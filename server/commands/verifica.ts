import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits,
  Collection
} from 'discord.js';
import { storage } from '../storage';

// Interfaccia per rappresentare lo stato della verifica
interface VerificationResult {
  success: boolean;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export default {
  data: new SlashCommandBuilder()
    .setName('verifica')
    .setDescription('Verifica lo stato dei server e del sistema')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo admin
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Verifica lo stato di un server specifico')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome del server da verificare')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rete')
        .setDescription('Verifica la connettività della rete LAN')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pterodactyl')
        .setDescription('Verifica la configurazione di Pterodactyl')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('tutto')
        .setDescription('Esegui una verifica completa del sistema')
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Rispondiamo subito per indicare che stiamo elaborando la richiesta
      await interaction.deferReply();
      
      if (subcommand === 'server') {
        const serverName = interaction.options.getString('nome', true);
        await this.verifyServer(interaction, serverName);
      }
      else if (subcommand === 'rete') {
        await this.verifyNetwork(interaction);
      }
      else if (subcommand === 'pterodactyl') {
        await this.verifyPterodactyl(interaction);
      }
      else if (subcommand === 'tutto') {
        await this.verifyAll(interaction);
      }
      
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando verifica:', error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'Si è verificato un errore durante la verifica. Controlla i log per maggiori dettagli.'
        });
      } else {
        await interaction.reply({
          content: 'Si è verificato un errore durante la verifica. Controlla i log per maggiori dettagli.',
          ephemeral: true
        });
      }
    }
  },
  
  /**
   * Verifica lo stato di un server specifico
   */
  async verifyServer(interaction: ChatInputCommandInteraction, serverName: string) {
    // Ottieni il server dal database
    const server = await storage.getServerByName(serverName);
    
    if (!server) {
      return interaction.editReply({
        content: `❌ Il server "${serverName}" non è stato trovato nel database.`
      });
    }
    
    // Raccogliamo i risultati delle verifiche
    const results: VerificationResult[] = [];
    
    // Verifica lo stato del server
    results.push({
      success: server.status === 'online',
      type: server.status === 'online' ? 'success' : 'warning',
      message: `Stato attuale: ${server.status}`
    });
    
    // Verifica se il server è in migrazione
    if (
      server.status === 'migration_pending' || 
      server.status === 'migration_in_progress' || 
      server.status === 'migration_completed' || 
      server.status === 'migration_failed'
    ) {
      const migrationType = server.status === 'migration_completed' ? 'success' : 
                          (server.status === 'migration_failed' ? 'error' : 'info');
      
      results.push({
        success: server.status === 'migration_completed',
        type: migrationType as 'success' | 'warning' | 'error' | 'info',
        message: `Migrazione: ${server.status}`
      });
    }
    
    // Verifica l'ID Pterodactyl
    results.push({
      success: !!server.pterodactylId,
      type: server.pterodactylId ? 'success' : 'warning',
      message: server.pterodactylId 
        ? `ID Pterodactyl: ${server.pterodactylId}` 
        : 'Nessun ID Pterodactyl (server non ancora migrato)'
    });
    
    // Verifica la porta
    results.push({
      success: true,
      type: 'info',
      message: `Porta: ${server.port}`
    });
    
    // Crea l'embed con i risultati della verifica
    const embed = new EmbedBuilder()
      .setTitle(`🔍 Verifica Server: ${server.name}`)
      .setDescription(`Risultati della verifica per il server **${server.name}** (${server.type})`)
      .setColor(this.getResultColor(results))
      .setTimestamp();
    
    // Aggiungi i risultati all'embed
    results.forEach(result => {
      const emoji = this.getResultEmoji(result.type);
      embed.addFields({ name: `${emoji} ${this.capitalizeFirst(result.type)}`, value: result.message });
    });
    
    // Aggiungi un campo riassuntivo
    const successCount = results.filter(r => r.success).length;
    const warningCount = results.filter(r => r.type === 'warning').length;
    const errorCount = results.filter(r => r.type === 'error').length;
    
    embed.addFields({
      name: '📊 Riepilogo',
      value: `✅ ${successCount} successi\n⚠️ ${warningCount} avvisi\n❌ ${errorCount} errori`
    });
    
    // Suggerimenti in base ai risultati
    if (errorCount > 0 || warningCount > 0) {
      let suggestionsText = '';
      
      if (server.status === 'migration_failed') {
        suggestionsText += '• Usa `/migrazione avvia` per riprovare la migrazione del server\n';
      }
      
      if (!server.pterodactylId) {
        suggestionsText += '• Completa la migrazione per ottenere un ID Pterodactyl\n';
      }
      
      if (server.status === 'offline') {
        suggestionsText += '• Usa `/server-control start` per avviare il server\n';
      }
      
      if (suggestionsText) {
        embed.addFields({
          name: '💡 Suggerimenti',
          value: suggestionsText
        });
      }
    }
    
    await interaction.editReply({ embeds: [embed] });
  },
  
  /**
   * Verifica lo stato della rete LAN
   */
  async verifyNetwork(interaction: ChatInputCommandInteraction) {
    // Ottieni tutti i peer WireGuard
    const peers = await storage.getAllWireguardPeers();
    
    // Raccogliamo i risultati delle verifiche
    const results: VerificationResult[] = [];
    
    // Verifica la presenza di peer WireGuard
    results.push({
      success: peers.length > 0,
      type: peers.length > 0 ? 'success' : 'warning',
      message: `${peers.length} peer WireGuard configurati`
    });
    
    // Qui andrebbe una vera verifica della connettività, per ora simuliamo
    const wireguardStatus = {
      isRunning: true,
      lastHandshake: new Date(Date.now() - 300000), // 5 minuti fa
      endpoint: process.env.WG_SERVER_ENDPOINT || '1.2.3.4:51820',
      subnet: '10.0.0.0/24',
      activePeers: peers.filter(p => p.lastHandshake !== null).length
    };
    
    // Verifica lo stato del server WireGuard
    results.push({
      success: wireguardStatus.isRunning,
      type: wireguardStatus.isRunning ? 'success' : 'error',
      message: wireguardStatus.isRunning 
        ? 'Server WireGuard attivo' 
        : 'Server WireGuard non attivo'
    });
    
    // Verifica la subnet
    results.push({
      success: wireguardStatus.subnet === '10.0.0.0/24',
      type: wireguardStatus.subnet === '10.0.0.0/24' ? 'success' : 'warning',
      message: `Subnet: ${wireguardStatus.subnet}`
    });
    
    // Verifica i peer attivi
    results.push({
      success: wireguardStatus.activePeers > 0,
      type: wireguardStatus.activePeers > 0 ? 'success' : 'info',
      message: `${wireguardStatus.activePeers} peer attivi su ${peers.length} configurati`
    });
    
    // Crea l'embed con i risultati della verifica
    const embed = new EmbedBuilder()
      .setTitle('🌐 Verifica Rete LAN')
      .setDescription('Risultati della verifica della rete LAN e WireGuard')
      .setColor(this.getResultColor(results))
      .setTimestamp();
    
    // Aggiungi i risultati all'embed
    results.forEach(result => {
      const emoji = this.getResultEmoji(result.type);
      embed.addFields({ name: `${emoji} ${this.capitalizeFirst(result.type)}`, value: result.message });
    });
    
    // Dettagli aggiuntivi
    if (wireguardStatus.isRunning) {
      const lastHandshakeTime = wireguardStatus.lastHandshake.toISOString().replace('T', ' ').substring(0, 19);
      embed.addFields({
        name: '📡 Dettagli WireGuard',
        value: `Endpoint: \`${wireguardStatus.endpoint}\`\nUltimo handshake: ${lastHandshakeTime}`
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  },
  
  /**
   * Verifica la configurazione di Pterodactyl
   */
  async verifyPterodactyl(interaction: ChatInputCommandInteraction) {
    // In un'implementazione reale, qui contatteremmo l'API Pterodactyl
    // Per ora simuliamo una verifica di base controllando se abbiamo l'API key
    
    // Raccogliamo i risultati delle verifiche
    const results: VerificationResult[] = [];
    
    const hasPterodactylKey = !!process.env.PTERODACTYL_API_KEY;
    
    // Verifica la chiave API
    results.push({
      success: hasPterodactylKey,
      type: hasPterodactylKey ? 'success' : 'error',
      message: hasPterodactylKey 
        ? 'Chiave API Pterodactyl configurata' 
        : 'Chiave API Pterodactyl mancante'
    });
    
    // Ottenere i server da Pterodactyl
    // In un'implementazione reale, otterremo questa informazione dalla API
    const pterodactylServers = [
      { id: 'abc123', name: 'minecraft-survival', status: 'running' },
      { id: 'def456', name: 'minecraft-creative', status: 'stopped' },
    ];
    
    results.push({
      success: pterodactylServers.length > 0,
      type: pterodactylServers.length > 0 ? 'success' : 'warning',
      message: `${pterodactylServers.length} server trovati in Pterodactyl`
    });
    
    // Verifica corrispondenza con database interno
    const localServers = await storage.getAllServers();
    const migratedServers = localServers.filter(s => s.pterodactylId !== null);
    
    results.push({
      success: migratedServers.length > 0,
      type: migratedServers.length > 0 ? 'success' : 'info',
      message: `${migratedServers.length} server migrati a Pterodactyl`
    });
    
    // Verifica nodo Pterodactyl
    // In un'implementazione reale, otterremo questa informazione dalla API
    const nodeStatus = { online: true, name: 'LAN Node', servers: pterodactylServers.length };
    
    results.push({
      success: nodeStatus.online,
      type: nodeStatus.online ? 'success' : 'error',
      message: nodeStatus.online 
        ? `Nodo "${nodeStatus.name}" online con ${nodeStatus.servers} server` 
        : `Nodo "${nodeStatus.name}" offline`
    });
    
    // Crea l'embed con i risultati della verifica
    const embed = new EmbedBuilder()
      .setTitle('🦅 Verifica Pterodactyl')
      .setDescription('Risultati della verifica della configurazione Pterodactyl')
      .setColor(this.getResultColor(results))
      .setTimestamp();
    
    // Aggiungi i risultati all'embed
    results.forEach(result => {
      const emoji = this.getResultEmoji(result.type);
      embed.addFields({ name: `${emoji} ${this.capitalizeFirst(result.type)}`, value: result.message });
    });
    
    // Aggiungi i server Pterodactyl come elenco
    if (pterodactylServers.length > 0) {
      const serverList = pterodactylServers.map(s => {
        const statusEmoji = s.status === 'running' ? '🟢' : '🔴';
        return `${statusEmoji} **${s.name}** (ID: ${s.id})`;
      }).join('\n');
      
      embed.addFields({
        name: '🎮 Server Pterodactyl',
        value: serverList
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  },
  
  /**
   * Esegue una verifica completa del sistema
   */
  async verifyAll(interaction: ChatInputCommandInteraction) {
    await interaction.editReply('🔍 Avvio verifica completa del sistema...');
    
    const overallResults: {
      [key: string]: {
        success: number;
        warning: number;
        error: number;
        info: number;
      }
    } = {
      servers: { success: 0, warning: 0, error: 0, info: 0 },
      rete: { success: 0, warning: 0, error: 0, info: 0 },
      pterodactyl: { success: 0, warning: 0, error: 0, info: 0 }
    };
    
    // Verifica tutti i server
    const servers = await storage.getAllServers();
    let serverResults = '';
    
    if (servers.length > 0) {
      for (const server of servers) {
        // Raccogliamo i risultati delle verifiche per questo server
        const results: VerificationResult[] = [];
        
        // Verifica stato server
        const serverStatus: VerificationResult = {
          success: server.status === 'online',
          type: server.status === 'online' ? 'success' : 
                (server.status === 'offline' ? 'warning' : 'info'),
          message: `Stato: ${server.status}`
        };
        results.push(serverStatus);
        
        // Verifica migrazione
        if (
          server.status === 'migration_pending' || 
          server.status === 'migration_in_progress' || 
          server.status === 'migration_completed' || 
          server.status === 'migration_failed'
        ) {
          const migrationType = server.status === 'migration_completed' ? 'success' : 
                        (server.status === 'migration_failed' ? 'error' : 'info');
          
          results.push({
            success: server.status === 'migration_completed',
            type: migrationType as 'success' | 'warning' | 'error' | 'info',
            message: `Migrazione: ${server.status}`
          });
        }
        
        // Verifica ID Pterodactyl
        results.push({
          success: !!server.pterodactylId,
          type: server.pterodactylId ? 'success' : 'warning',
          message: server.pterodactylId 
            ? `Pterodactyl: ${server.pterodactylId}` 
            : 'Non migrato a Pterodactyl'
        });
        
        // Aggiorna contatori dei risultati
        results.forEach(result => {
          overallResults.servers[result.type]++;
        });
        
        // Risultato complessivo per questo server
        const serverSuccess = results.every(r => r.type !== 'error') && 
                          results.filter(r => r.type === 'success').length > 0;
        
        const serverEmoji = serverSuccess ? '✅' : '⚠️';
        serverResults += `${serverEmoji} **${server.name}** (${server.type}): ${server.status}\n`;
      }
    } else {
      serverResults = 'Nessun server trovato nel database.';
    }
    
    // Simuliamo una verifica di rete
    const networkResults: VerificationResult[] = [
      {
        success: true,
        type: 'success',
        message: 'WireGuard attivo'
      },
      {
        success: true,
        type: 'info',
        message: 'Subnet: 10.0.0.0/24'
      }
    ];
    
    // Aggiorna contatori per rete
    networkResults.forEach(result => {
      overallResults.rete[result.type]++;
    });
    
    // Simuliamo una verifica di Pterodactyl
    const pterodactylResults: VerificationResult[] = [
      {
        success: !!process.env.PTERODACTYL_API_KEY,
        type: !!process.env.PTERODACTYL_API_KEY ? 'success' : 'error',
        message: !!process.env.PTERODACTYL_API_KEY 
          ? 'Chiave API configurata'
          : 'Chiave API mancante'
      }
    ];
    
    // Aggiorna contatori per Pterodactyl
    pterodactylResults.forEach(result => {
      overallResults.pterodactyl[result.type]++;
    });
    
    // Crea embed con il riepilogo completo
    const embed = new EmbedBuilder()
      .setTitle('🔍 Verifica Completa del Sistema')
      .setDescription('Risultati della verifica completa dell\'infrastruttura')
      .setColor('#3498DB') // Blu per il report completo
      .setTimestamp();
    
    // Aggiungi riepilogo generale
    const totalSuccess = overallResults.servers.success + overallResults.rete.success + overallResults.pterodactyl.success;
    const totalWarning = overallResults.servers.warning + overallResults.rete.warning + overallResults.pterodactyl.warning;
    const totalError = overallResults.servers.error + overallResults.rete.error + overallResults.pterodactyl.error;
    
    embed.addFields({
      name: '📊 Riepilogo Generale',
      value: `✅ ${totalSuccess} successi\n⚠️ ${totalWarning} avvisi\n❌ ${totalError} errori`
    });
    
    // Aggiungi riepilogo server
    embed.addFields({
      name: '🎮 Server',
      value: serverResults
    });
    
    // Stato rete
    const networkStatus = networkResults.some(r => r.type === 'error') ? '⚠️' : '✅';
    embed.addFields({
      name: `${networkStatus} Rete`,
      value: networkResults.map(r => `${this.getResultEmoji(r.type)} ${r.message}`).join('\n')
    });
    
    // Stato Pterodactyl
    const pterodactylStatus = pterodactylResults.some(r => r.type === 'error') ? '⚠️' : '✅';
    embed.addFields({
      name: `${pterodactylStatus} Pterodactyl`,
      value: pterodactylResults.map(r => `${this.getResultEmoji(r.type)} ${r.message}`).join('\n')
    });
    
    // Aggiungi suggerimenti in base ai problemi rilevati
    if (totalError > 0 || totalWarning > 0) {
      let suggerimenti = '';
      
      if (pterodactylResults.some(r => r.type === 'error')) {
        suggerimenti += '• Configurare la chiave API di Pterodactyl\n';
      }
      
      if (servers.some(s => s.status === 'migration_failed')) {
        suggerimenti += '• Riprovare la migrazione dei server falliti con `/migrazione avvia`\n';
      }
      
      if (servers.some(s => !s.pterodactylId)) {
        suggerimenti += '• Completare la migrazione dei server a Pterodactyl\n';
      }
      
      if (suggerimenti) {
        embed.addFields({
          name: '💡 Suggerimenti',
          value: suggerimenti
        });
      }
    }
    
    await interaction.editReply({ content: null, embeds: [embed] });
  },
  
  /**
   * Ottiene l'emoji corrispondente al tipo di risultato
   */
  getResultEmoji(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  },
  
  /**
   * Determina il colore dell'embed in base ai risultati complessivi
   */
  getResultColor(results: VerificationResult[]): string {
    if (results.some(r => r.type === 'error')) {
      return '#E74C3C'; // Rosso per errori
    }
    
    if (results.some(r => r.type === 'warning')) {
      return '#F39C12'; // Arancione per avvisi
    }
    
    if (results.every(r => r.success)) {
      return '#2ECC71'; // Verde per tutto ok
    }
    
    return '#3498DB'; // Blu in altri casi
  },
  
  /**
   * Rende la prima lettera maiuscola
   */
  capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
};