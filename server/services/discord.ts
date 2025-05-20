import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

// Initialize Discord client
const setupDiscordBot = async () => {
  try {
    const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
    
    if (!token) {
      console.error('No Discord bot token provided. Discord bot will not be initialized.');
      return null;
    }
    
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });
    
    client.once('ready', () => {
      console.log(`Discord bot logged in as ${client.user?.tag}`);
    });
    
    // Log in to Discord with the bot token
    await client.login(token);
    
    return client;
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    return null;
  }
};

// Send message to a specific channel
const sendChannelMessage = async (client: Client, channelId: string, message: string) => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send(message);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to send message to channel:', error);
    return false;
  }
};

// Send system alert to the designated channel
const sendSystemAlert = async (
  client: Client, 
  channelId: string, 
  title: string, 
  message: string, 
  type: 'info' | 'warning' | 'error' = 'info'
) => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      // Color based on alert type
      const colorMap = {
        info: '#7289DA', // Discord Blurple
        warning: '#FAA61A', // Discord Yellow
        error: '#F04747' // Discord Red
      };
      
      const color = colorMap[type];
      const icon = type === 'info' ? 'ℹ️' : type === 'warning' ? '⚠️' : '🔴';
      
      await channel.send({
        embeds: [{
          title: `${icon} ${title}`,
          description: message,
          color: parseInt(color.replace('#', ''), 16),
          timestamp: new Date().toISOString()
        }]
      });
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to send system alert:', error);
    return false;
  }
};

// Grant or revoke a role to a Discord user
const updateUserRole = async (
  client: Client, 
  guildId: string, 
  userId: string, 
  roleId: string, 
  shouldHaveRole: boolean
) => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    
    if (shouldHaveRole) {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
      }
    } else {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to update user role:', error);
    return false;
  }
};

export {
  setupDiscordBot,
  sendChannelMessage,
  sendSystemAlert,
  updateUserRole
};
