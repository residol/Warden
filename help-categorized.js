// Sistema di aiuto avanzato per il bot Discord
// Questo modulo gestisce i comandi di aiuto categorizzati per ruoli

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Definizione delle categorie di comandi
const CATEGORIES = {
  ADMIN: {
    name: 'Amministrazione',
    emoji: '🔒',
    description: 'Comandi per amministratori del sistema',
    roles: ['admin']
  },
  MODERATOR: {
    name: 'Moderazione',
    emoji: '🛡️',
    description: 'Comandi per moderatori',
    roles: ['admin', 'moderator']
  },
  SERVER: {
    name: 'Gestione Server',
    emoji: '🖥️',
    description: 'Comandi per gestire i server di gioco',
    roles: ['admin', 'moderator', 'member']
  },
  NETWORK: {
    name: 'Rete e WireGuard',
    emoji: '🌐',
    description: 'Comandi per gestire la rete e le connessioni VPN',
    roles: ['admin', 'moderator']
  },
  UTILITY: {
    name: 'Utilità',
    emoji: '🔧',
    description: 'Comandi di utilità generale',
    roles: ['admin', 'moderator', 'member', 'supporter']
  },
  INFO: {
    name: 'Informazioni',
    emoji: 'ℹ️',
    description: 'Comandi informativi sul sistema',
    roles: ['admin', 'moderator', 'member', 'supporter']
  }
};

// Definizione dei comandi con relative categorie e requisiti di permesso
const COMMANDS = [
  {
    name: 'help',
    description: 'Mostra l\'elenco dei comandi disponibili',
    category: 'INFO',
    requiredRole: null, // Nessun ruolo richiesto (tutti possono usarlo)
    usage: '/help [categoria]',
    examples: ['/help', '/help admin', '/help server']
  },
  {
    name: 'ping',
    description: 'Verifica se il bot è attivo',
    category: 'UTILITY',
    requiredRole: null,
    usage: '/ping',
    examples: ['/ping']
  },
  {
    name: 'status',
    description: 'Mostra lo stato del sistema',
    category: 'INFO',
    requiredRole: null,
    usage: '/status',
    examples: ['/status']
  },
  {
    name: 'servers',
    description: 'Mostra la lista dei server disponibili',
    category: 'SERVER',
    requiredRole: null,
    usage: '/servers',
    examples: ['/servers']
  },
  {
    name: 'server',
    description: 'Mostra informazioni su un server specifico',
    category: 'SERVER',
    requiredRole: null,
    usage: '/server <id>',
    examples: ['/server mc-survival', '/server rust-1']
  },
  {
    name: 'start',
    description: 'Avvia un server',
    category: 'SERVER',
    requiredRole: 'member',
    usage: '/start <id>',
    examples: ['/start mc-survival']
  },
  {
    name: 'stop',
    description: 'Ferma un server',
    category: 'SERVER',
    requiredRole: 'member',
    usage: '/stop <id>',
    examples: ['/stop mc-survival']
  },
  {
    name: 'restart',
    description: 'Riavvia un server',
    category: 'SERVER',
    requiredRole: 'member',
    usage: '/restart <id>',
    examples: ['/restart mc-survival']
  },
  {
    name: 'wireguard',
    description: 'Mostra lo stato di WireGuard',
    category: 'NETWORK',
    requiredRole: 'moderator',
    usage: '/wireguard',
    examples: ['/wireguard']
  },
  {
    name: 'addpeer',
    description: 'Aggiunge un nuovo peer a WireGuard',
    category: 'NETWORK',
    requiredRole: 'admin',
    usage: '/addpeer <nome> <ip>',
    examples: ['/addpeer utente1 10.0.0.2']
  },
  {
    name: 'deletepeer',
    description: 'Rimuove un peer da WireGuard',
    category: 'NETWORK',
    requiredRole: 'admin',
    usage: '/deletepeer <nome>',
    examples: ['/deletepeer utente1']
  },
  {
    name: 'users',
    description: 'Gestisce gli utenti del sistema',
    category: 'ADMIN',
    requiredRole: 'admin',
    usage: '/users <list|add|remove|role> [parametri]',
    examples: ['/users list', '/users add @utente', '/users role @utente moderator']
  },
  {
    name: 'monitor',
    description: 'Monitora l\'utilizzo delle risorse',
    category: 'ADMIN',
    requiredRole: 'admin',
    usage: '/monitor <server|system>',
    examples: ['/monitor system', '/monitor server mc-survival']
  },
  {
    name: 'backup',
    description: 'Gestisce i backup del sistema',
    category: 'ADMIN',
    requiredRole: 'admin',
    usage: '/backup <create|list|restore> [nome]',
    examples: ['/backup create', '/backup list', '/backup restore 20230401']
  },
  {
    name: 'invite',
    description: 'Genera un invito per un nuovo utente',
    category: 'MODERATOR',
    requiredRole: 'moderator',
    usage: '/invite <email> [ruolo]',
    examples: ['/invite user@example.com', '/invite user@example.com member']
  },
  {
    name: 'logs',
    description: 'Mostra i log di sistema o di un server',
    category: 'MODERATOR',
    requiredRole: 'moderator',
    usage: '/logs <system|server> [id] [righe]',
    examples: ['/logs system 20', '/logs server mc-survival 50']
  }
];

// Funzione per ottenere i comandi disponibili per un ruolo
function getCommandsForRole(userRole) {
  if (!userRole) return COMMANDS.filter(cmd => !cmd.requiredRole);
  
  // Se l'utente è admin, ha accesso a tutti i comandi
  if (userRole === 'admin') return COMMANDS;
  
  // Altrimenti, filtra i comandi in base al ruolo
  return COMMANDS.filter(cmd => {
    // Comandi senza requisiti di ruolo sono disponibili a tutti
    if (!cmd.requiredRole) return true;
    
    // Verifica ruoli specifici
    if (userRole === 'moderator') {
      return ['moderator', 'member', 'supporter'].includes(cmd.requiredRole);
    } else if (userRole === 'member') {
      return ['member', 'supporter'].includes(cmd.requiredRole);
    } else if (userRole === 'supporter') {
      return cmd.requiredRole === 'supporter';
    }
    
    return false;
  });
}

// Funzione per ottenere i comandi per categoria
function getCommandsByCategory(commands) {
  const categorized = {};
  
  // Inizializza le categorie
  Object.keys(CATEGORIES).forEach(key => {
    categorized[key] = [];
  });
  
  // Popola le categorie con i comandi
  commands.forEach(command => {
    if (command.category && categorized[command.category]) {
      categorized[command.category].push(command);
    } else {
      // Se la categoria non esiste, aggiungi a UTILITY
      categorized.UTILITY.push(command);
    }
  });
  
  return categorized;
}

// Funzione per creare l'embed del comando help
function createHelpEmbed(interaction, category = null) {
  // Determina il ruolo dell'utente
  let userRole = 'member'; // Default
  
  // Controlla i permessi dell'utente
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    userRole = 'admin';
  } else if (interaction.member.roles.cache.some(role => role.name.toLowerCase() === 'moderator')) {
    userRole = 'moderator';
  } else if (interaction.member.roles.cache.some(role => role.name.toLowerCase() === 'supporter')) {
    userRole = 'supporter';
  }
  
  // Ottieni i comandi disponibili per questo ruolo
  const availableCommands = getCommandsForRole(userRole);
  
  // Se è specificata una categoria, mostra solo quella
  if (category) {
    const categoryKey = Object.keys(CATEGORIES).find(key => 
      CATEGORIES[key].name.toLowerCase() === category.toLowerCase()
    );
    
    if (!categoryKey) {
      return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Categoria non trovata')
        .setDescription(`La categoria "${category}" non esiste. Usa /help per vedere le categorie disponibili.`);
    }
    
    // Filtra i comandi per questa categoria
    const categoryCommands = availableCommands.filter(cmd => cmd.category === categoryKey);
    
    if (categoryCommands.length === 0) {
      return new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle(`${CATEGORIES[categoryKey].emoji} ${CATEGORIES[categoryKey].name}`)
        .setDescription('Non hai comandi disponibili in questa categoria.');
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00AAFF)
      .setTitle(`${CATEGORIES[categoryKey].emoji} ${CATEGORIES[categoryKey].name}`)
      .setDescription(CATEGORIES[categoryKey].description);
    
    categoryCommands.forEach(cmd => {
      embed.addFields({
        name: `/${cmd.name}`,
        value: `**Descrizione**: ${cmd.description}\n**Uso**: ${cmd.usage}\n**Esempi**: ${cmd.examples.join(', ')}`,
        inline: false
      });
    });
    
    return embed;
  }
  
  // Mostra tutte le categorie
  const categorizedCommands = getCommandsByCategory(availableCommands);
  const embed = new EmbedBuilder()
    .setColor(0x00AAFF)
    .setTitle('📚 Guida Comandi')
    .setDescription('Ecco le categorie di comandi disponibili. Usa `/help <categoria>` per vedere i comandi in una categoria specifica.');
  
  Object.keys(CATEGORIES).forEach(key => {
    const category = CATEGORIES[key];
    const commands = categorizedCommands[key];
    
    if (commands && commands.length > 0) {
      embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: `${category.description}\nComandi: ${commands.map(c => '`/' + c.name + '`').join(', ')}`,
        inline: false
      });
    }
  });
  
  return embed;
}

// Comando slash per help
export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Mostra i comandi disponibili')
  .addStringOption(option => 
    option.setName('categoria')
      .setDescription('Categoria di comandi da visualizzare')
      .setRequired(false)
  );

export async function execute(interaction) {
  const category = interaction.options.getString('categoria');
  const embed = createHelpEmbed(interaction, category);
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Esporta le funzioni utili per altri moduli
export function getCategorizedCommands(userRole) {
  const availableCommands = getCommandsForRole(userRole);
  return getCommandsByCategory(availableCommands);
}

export function getCommandDetails(commandName) {
  return COMMANDS.find(cmd => cmd.name === commandName);
}

export default {
  data,
  execute,
  getCategorizedCommands,
  getCommandDetails
};