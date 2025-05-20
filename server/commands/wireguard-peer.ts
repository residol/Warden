import { SlashCommandBuilder } from 'discord.js';
import { 
  ChatInputCommandInteraction, 
  Client, 
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction
} from 'discord.js';
import { storage } from '../storage';
import { wireguard } from '../services/wireguard';
import * as fs from 'fs';

// Interfaccia per la configurazione WireGuard
interface WireGuardPeerConfig {
  privateKey: string;
  publicKey: string;
  presharedKey?: string;
  allowedIPs: string[];
  endpoint?: string;
  persistentKeepalive?: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('wireguard')
    .setDescription('Gestisce le connessioni WireGuard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('aggiungi-peer')
        .setDescription('Aggiunge un nuovo peer WireGuard')
        .addStringOption(option => 
          option.setName('nome')
            .setDescription('Nome del peer (es. username o dispositivo)')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('descrizione')
            .setDescription('Descrizione del peer (es. laptop, smartphone)')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rimuovi-peer')
        .setDescription('Rimuove un peer WireGuard esistente')
        .addStringOption(option => 
          option.setName('pubkey')
            .setDescription('La chiave pubblica del peer da rimuovere')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lista')
        .setDescription('Mostra tutti i peer WireGuard configurati')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('genera-config')
        .setDescription('Genera un file di configurazione WireGuard per un peer')
        .addStringOption(option => 
          option.setName('pubkey')
            .setDescription('La chiave pubblica del peer')
            .setRequired(true))
    ),

  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    try {
      // Verifica che l'interazione provenga da un membro del server con i permessi necessari
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: 'Non hai i permessi necessari per gestire WireGuard.',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'aggiungi-peer':
          await this.handleAddPeer(interaction);
          break;
        case 'rimuovi-peer':
          await this.handleRemovePeer(interaction);
          break;
        case 'lista':
          await this.handleListPeers(interaction);
          break;
        case 'genera-config':
          await this.handleGenerateConfig(interaction);
          break;
        default:
          await interaction.reply({
            content: 'Comando non riconosciuto.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Errore durante l\'esecuzione del comando WireGuard:', error);
      await interaction.reply({
        content: `Si è verificato un errore: ${error}`,
        ephemeral: true
      });
    }
  },

  /**
   * Gestisce l'aggiunta di un nuovo peer WireGuard
   */
  async handleAddPeer(interaction: ChatInputCommandInteraction) {
    // Ottieni i parametri dal comando
    const peerName = interaction.options.getString('nome', true);
    const peerDescription = interaction.options.getString('descrizione');

    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Genera una nuova coppia di chiavi per il peer
      const privateKey = await wireguard.generatePrivateKey();
      const publicKey = await wireguard.derivePublicKey(privateKey);
      
      // 2. Trova un indirizzo IP disponibile nella sottorete WireGuard
      const ipAddress = await wireguard.findAvailableIP();
      
      if (!ipAddress) {
        return interaction.editReply('Non è stato possibile trovare un indirizzo IP disponibile nella rete WireGuard.');
      }

      // 3. Crea il nuovo peer nel database
      const newPeer = await storage.createWireguardPeer({
        userId: null, // Opzionale, può essere collegato a un account utente
        name: peerName,
        description: peerDescription || `Peer per ${peerName}`,
        publicKey: publicKey,
        allowedIps: `${ipAddress}/32`,
        createdBy: interaction.user.id,
        enabled: true
      });

      // 4. Aggiungi il peer alla configurazione WireGuard
      const added = await wireguard.addPeerToServer(publicKey, ipAddress);
      
      if (!added) {
        // Rollback - rimuovi il peer dal database se l'aggiunta alla configurazione fallisce
        return interaction.editReply('Errore durante l\'aggiunta del peer alla configurazione WireGuard.');
      }

      // 5. Genera la configurazione cliente
      const configFileName = `${peerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.conf`;
      const configContent = wireguard.generateClientConfig(privateKey, ipAddress);
      
      // 6. Invia la risposta con le informazioni sul nuovo peer
      const embed = new EmbedBuilder()
        .setTitle('🔑 Nuovo peer WireGuard creato')
        .setDescription(`Peer **${peerName}** configurato con successo.`)
        .addFields(
          { name: 'Nome', value: peerName, inline: true },
          { name: 'Indirizzo IP', value: ipAddress, inline: true },
          { name: 'Chiave Pubblica', value: `${publicKey.substring(0, 16)}...`, inline: false },
          { name: '⚠️ Avviso', value: 'Scarica il file di configurazione qui sotto. Per motivi di sicurezza, questo messaggio e il file saranno disponibili solo temporaneamente.' }
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'WireGuard Manager' })
        .setTimestamp();

      // Crea un pulsante per scaricare la configurazione
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`download_config_${newPeer.id}`)
            .setLabel('Download Configurazione')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📥')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      // Salva la configurazione temporaneamente per il download
      wireguard.storeTempConfig(
        `download_config_${newPeer.id}`,
        configContent,
        configFileName
      );

    } catch (error) {
      console.error('Errore nella creazione del peer WireGuard:', error);
      await interaction.editReply('Si è verificato un errore durante la creazione del peer WireGuard.');
    }
  },

  /**
   * Gestisce la rimozione di un peer WireGuard esistente
   */
  async handleRemovePeer(interaction: ChatInputCommandInteraction) {
    const publicKey = interaction.options.getString('pubkey', true);
    
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Trova il peer nel database
      const peer = await storage.getWireguardPeerByPublicKey(publicKey);
      
      if (!peer) {
        return interaction.editReply('Peer non trovato. Verifica la chiave pubblica.');
      }

      // 2. Rimuovi il peer dalla configurazione WireGuard
      const removed = await wireguard.removePeerFromServer(publicKey);
      
      if (!removed) {
        return interaction.editReply('Errore durante la rimozione del peer dalla configurazione WireGuard.');
      }

      // 3. Aggiorna lo stato del peer nel database (disabilitato)
      await storage.updateWireguardPeer(peer.id, {
        enabled: false
      });

      // 4. Invia conferma
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Peer WireGuard rimosso')
        .setDescription(`Il peer **${peer.name}** è stato rimosso con successo.`)
        .addFields(
          { name: 'Chiave Pubblica', value: `${publicKey.substring(0, 16)}...`, inline: false },
          { name: 'Indirizzo IP', value: peer.allowedIps.split('/')[0], inline: true }
        )
        .setColor(0xE74C3C)
        .setFooter({ text: 'WireGuard Manager' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Errore nella rimozione del peer WireGuard:', error);
      await interaction.editReply('Si è verificato un errore durante la rimozione del peer WireGuard.');
    }
  },

  /**
   * Mostra una lista di tutti i peer WireGuard configurati
   */
  async handleListPeers(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Ottieni tutti i peer dal database
      const peers = await storage.getAllWireguardPeers();
      
      if (peers.length === 0) {
        return interaction.editReply('Non ci sono peer WireGuard configurati.');
      }

      // 2. Formatta i peer in una lista
      const embed = new EmbedBuilder()
        .setTitle('📋 Peer WireGuard configurati')
        .setDescription(`Ci sono **${peers.length}** peer configurati sulla rete WireGuard.`)
        .setColor(0x2ECC71)
        .setFooter({ text: 'WireGuard Manager' })
        .setTimestamp();

      // Aggiungi i peer all'embed
      peers.forEach((peer, index) => {
        embed.addFields({
          name: `${index + 1}. ${peer.name}`,
          value: `📍 **IP**: ${peer.allowedIps.split('/')[0]} • 🔑 **Pubkey**: ${peer.publicKey.substring(0, 8)}... • ${peer.enabled ? '✅ Attivo' : '❌ Disabilitato'}`,
          inline: false
        });
      });

      // 3. Invia la lista
      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Errore nel recupero della lista dei peer WireGuard:', error);
      await interaction.editReply('Si è verificato un errore durante il recupero della lista dei peer WireGuard.');
    }
  },

  /**
   * Genera un file di configurazione WireGuard per un peer esistente
   */
  async handleGenerateConfig(interaction: ChatInputCommandInteraction) {
    const publicKey = interaction.options.getString('pubkey', true);
    
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Trova il peer nel database
      const peer = await storage.getWireguardPeerByPublicKey(publicKey);
      
      if (!peer) {
        return interaction.editReply('Peer non trovato. Verifica la chiave pubblica.');
      }

      // 2. Per generare una configurazione è necessario avere la chiave privata
      // Nota: in un sistema reale, non dovresti salvare le chiavi private
      // Dovresti invece richiedere all'utente di salvare la chiave privata quando 
      // il peer viene creato inizialmente
      await interaction.editReply({
        content: 'Per motivi di sicurezza, le chiavi private non vengono salvate sul server. È possibile generare una nuova configurazione creando un nuovo peer.'
      });

    } catch (error) {
      console.error('Errore nella generazione della configurazione WireGuard:', error);
      await interaction.editReply('Si è verificato un errore durante la generazione della configurazione WireGuard.');
    }
  },



  // Utility functions

  /**
   * Gestisce le interazioni con i pulsanti
   */
  async handleButtonInteraction(client: Client, interaction: ButtonInteraction) {
    // Controllo sul prefisso del customId
    if (!interaction.customId.startsWith('download_config_')) return;
    
    const peerId = interaction.customId.replace('download_config_', '');
    
    // Recupera la configurazione dal servizio WireGuard
    const configData = wireguard.getTempConfig(interaction.customId);
    
    if (!configData) {
      return interaction.reply({
        content: 'La configurazione richiesta non è più disponibile. Per motivi di sicurezza, le configurazioni sono disponibili solo temporaneamente.',
        ephemeral: true
      });
    }
    
    // Invia il file di configurazione
    await interaction.reply({
      content: 'Ecco la tua configurazione WireGuard. Importala nel client WireGuard sul tuo dispositivo.',
      files: [{
        attachment: Buffer.from(configData.content),
        name: configData.filename
      }],
      ephemeral: true
    });
  }
};