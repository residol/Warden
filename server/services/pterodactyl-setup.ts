import axios from 'axios';
import { storage } from '../storage';

// Configurazione Pterodactyl
const apiUrl = process.env.PTERODACTYL_API_URL || 'http://10.0.0.254';
const apiKey = process.env.PTERODACTYL_API_KEY;

// Crea client API per Pterodactyl
const pterodactylAPI = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Gestione degli errori
pterodactylAPI.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      console.error('Pterodactyl API error:', error.response.data);
    } else if (error.request) {
      console.error('Pterodactyl API error: Nessuna risposta ricevuta');
    } else {
      console.error('Pterodactyl API error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Verifica se Pterodactyl è configurato correttamente
 */
export const checkPterodactylSetup = async (): Promise<boolean> => {
  try {
    if (!apiKey) {
      console.error('API key di Pterodactyl non configurata');
      return false;
    }
    
    // Verifica connessione a Pterodactyl (endpoint semplice)
    const response = await pterodactylAPI.get('/api/application/users');
    console.log('Connessione a Pterodactyl riuscita!');
    return true;
  } catch (error) {
    console.error('Errore durante la verifica della configurazione di Pterodactyl');
    return false;
  }
};

/**
 * Ottiene o crea una location in Pterodactyl
 */
export const getOrCreateLocation = async (name: string = 'LAN'): Promise<number> => {
  try {
    // Cerca location esistenti
    const locationsResponse = await pterodactylAPI.get('/api/application/locations');
    const locations = locationsResponse.data.data;
    
    // Cerca una location con il nome specificato
    const existingLocation = locations.find((location: any) => location.attributes.short === name);
    if (existingLocation) {
      return existingLocation.attributes.id;
    }
    
    // Crea una nuova location
    const createResponse = await pterodactylAPI.post('/api/application/locations', {
      short: name,
      long: `Bellion Garden ${name}`
    });
    
    return createResponse.data.attributes.id;
  } catch (error) {
    console.error('Errore durante la creazione della location:', error);
    throw error;
  }
};

/**
 * Ottiene o crea un nodo in Pterodactyl
 */
export const getOrCreateNode = async (config: {
  name: string,
  location_id: number,
  fqdn?: string
}): Promise<number> => {
  try {
    // Cerca nodi esistenti
    const nodesResponse = await pterodactylAPI.get('/api/application/nodes');
    const nodes = nodesResponse.data.data;
    
    // Cerca un nodo con il nome specificato
    const existingNode = nodes.find((node: any) => node.attributes.name === config.name);
    if (existingNode) {
      return existingNode.attributes.id;
    }
    
    // Crea un nuovo nodo
    const fqdn = config.fqdn || '10.0.0.254';
    const createResponse = await pterodactylAPI.post('/api/application/nodes', {
      name: config.name,
      location_id: config.location_id,
      fqdn: fqdn,
      scheme: 'http', // Usa http per la rete locale
      memory: 8192,
      memory_overallocate: 20,
      disk: 50000,
      disk_overallocate: 20,
      upload_size: 100,
      daemon_sftp: 2022,
      daemon_listen: 8080
    });
    
    return createResponse.data.attributes.id;
  } catch (error) {
    console.error('Errore durante la creazione del nodo:', error);
    throw error;
  }
};

/**
 * Ottiene o crea un'allocazione per un nodo
 */
export const getOrCreateAllocation = async (nodeId: number, ip: string = '10.0.0.254', port: number = 25565): Promise<number> => {
  try {
    // Cerca allocazioni esistenti
    const allocationsResponse = await pterodactylAPI.get(`/api/application/nodes/${nodeId}/allocations`);
    const allocations = allocationsResponse.data.data;
    
    // Cerca un'allocazione per la porta specificata
    const existingAllocation = allocations.find((allocation: any) => 
      allocation.attributes.ip === ip && allocation.attributes.port === port
    );
    
    if (existingAllocation) {
      return existingAllocation.attributes.id;
    }
    
    // Crea una nuova allocazione
    await pterodactylAPI.post(`/api/application/nodes/${nodeId}/allocations`, {
      ip: ip,
      ports: [port.toString()]
    });
    
    // Ricarica le allocazioni per ottenere l'ID
    const updatedAllocationsResponse = await pterodactylAPI.get(`/api/application/nodes/${nodeId}/allocations`);
    const updatedAllocations = updatedAllocationsResponse.data.data;
    
    const newAllocation = updatedAllocations.find((allocation: any) => 
      allocation.attributes.ip === ip && allocation.attributes.port === port
    );
    
    if (!newAllocation) {
      throw new Error('Impossibile trovare l\'allocazione appena creata');
    }
    
    return newAllocation.attributes.id;
  } catch (error) {
    console.error('Errore durante la creazione dell\'allocazione:', error);
    throw error;
  }
};

/**
 * Ottiene o crea un utente in Pterodactyl
 */
export const getOrCreateUser = async (email: string = 'admin@bellion.garden', username: string = 'admin', firstName: string = 'Admin', lastName: string = 'User'): Promise<string> => {
  try {
    // Cerca utenti esistenti
    const usersResponse = await pterodactylAPI.get('/api/application/users');
    const users = usersResponse.data.data;
    
    // Cerca un utente con l'email specificata
    const existingUser = users.find((user: any) => user.attributes.email === email);
    if (existingUser) {
      return existingUser.attributes.uuid;
    }
    
    // Crea un nuovo utente
    const password = Math.random().toString(36).substring(2, 15);
    const createResponse = await pterodactylAPI.post('/api/application/users', {
      email: email,
      username: username,
      first_name: firstName,
      last_name: lastName,
      password: password,
      root_admin: false
    });
    
    console.log(`Utente creato con password: ${password}`);
    return createResponse.data.attributes.uuid;
  } catch (error) {
    console.error('Errore durante la creazione dell\'utente:', error);
    throw error;
  }
};

/**
 * Ottiene un egg di Minecraft 
 */
export const getMinecraftEgg = async (): Promise<{ nestId: number, eggId: number }> => {
  try {
    // Cerca tutti i nests
    const nestsResponse = await pterodactylAPI.get('/api/application/nests');
    const nests = nestsResponse.data.data;
    
    // Cerca il nest di Minecraft
    let minecraftNest = nests.find((nest: any) => nest.attributes.name.toLowerCase().includes('minecraft'));
    
    // Se non trova il nest di Minecraft, cerca quello generico
    if (!minecraftNest) {
      minecraftNest = nests[0]; // Prendi il primo nest disponibile
    }
    
    const nestId = minecraftNest.attributes.id;
    
    // Cerca gli eggs nel nest
    const eggsResponse = await pterodactylAPI.get(`/api/application/nests/${nestId}/eggs`);
    const eggs = eggsResponse.data.data;
    
    // Cerca l'egg di Minecraft o Vanilla/Paper
    let minecraftEgg = eggs.find((egg: any) => 
      egg.attributes.name.toLowerCase().includes('vanilla') || 
      egg.attributes.name.toLowerCase().includes('paper')
    );
    
    // Se non trova l'egg specifico, prendi il primo
    if (!minecraftEgg && eggs.length > 0) {
      minecraftEgg = eggs[0];
    }
    
    if (!minecraftEgg) {
      throw new Error('Nessun egg Minecraft trovato. Verifica l\'installazione di Pterodactyl.');
    }
    
    return {
      nestId,
      eggId: minecraftEgg.attributes.id
    };
  } catch (error) {
    console.error('Errore durante la ricerca dell\'egg Minecraft:', error);
    throw error;
  }
};

/**
 * Configura un server Minecraft in Pterodactyl
 */
export const setupMinecraftServer = async (config: {
  name: string,
  port: number,
  memory: number,
  disk: number,
  location?: string,
  nodePrefix?: string,
  serverType?: 'java' | 'bedrock'
}): Promise<{ serverId: string, serverIdentifier: string }> => {
  try {
    // Configurazione predefinita
    const serverType = config.serverType || 'java';
    const location = config.location || 'LAN';
    const nodePrefix = config.nodePrefix || 'BellionNode';
    
    // 1. Ottieni o crea location
    const locationId = await getOrCreateLocation(location);
    
    // 2. Ottieni o crea nodo
    const nodeId = await getOrCreateNode({
      name: `${nodePrefix}-${locationId}`,
      location_id: locationId
    });
    
    // 3. Ottieni o crea un'allocazione per il nodo
    const allocationId = await getOrCreateAllocation(nodeId, '10.0.0.254', config.port);
    
    // 4. Ottieni o crea un utente
    const userId = await getOrCreateUser();
    
    // 5. Ottieni l'egg di Minecraft
    const { nestId, eggId } = await getMinecraftEgg();
    
    // 6. Crea il server Minecraft
    const serverResponse = await pterodactylAPI.post('/api/application/servers', {
      name: config.name,
      user: userId,
      egg: eggId,
      docker_image: serverType === 'java' ? 'ghcr.io/pterodactyl/yolks:java_17' : 'ghcr.io/pterodactyl/yolks:java_17',
      startup: serverType === 'java' ? 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}' : 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
      environment: {
        SERVER_JARFILE: serverType === 'java' ? 'server.jar' : 'bedrock_server.jar',
        MINECRAFT_VERSION: 'latest',
        BUILD_TYPE: serverType === 'java' ? 'paper' : 'bedrock',
        JAVA_VERSION: '17'
      },
      limits: {
        memory: config.memory,
        swap: 0,
        disk: config.disk,
        io: 500,
        cpu: 0
      },
      feature_limits: {
        databases: 0,
        backups: 1,
        allocations: 1
      },
      allocation: {
        default: allocationId
      },
      start_on_completion: true
    });
    
    const serverAttributes = serverResponse.data.attributes;
    
    // 7. Salva il server nel nostro database interno
    await storage.createServer({
      name: config.name,
      type: serverType === 'java' ? 'minecraft' : 'minecraft-bedrock',
      status: 'offline', // Il server sarà inizialmente offline
      ipAddress: '10.0.0.254',
      port: config.port,
      maxPlayers: 20,
      pterodactylId: serverAttributes.identifier
    });
    
    console.log(`Server Minecraft "${config.name}" creato con successo in Pterodactyl`);
    return {
      serverId: serverAttributes.id.toString(),
      serverIdentifier: serverAttributes.identifier
    };
  } catch (error) {
    console.error('Errore durante la configurazione del server Minecraft:', error);
    throw error;
  }
};

/**
 * Configura l'ambiente Pterodactyl di base
 */
export const setupPterodactylEnvironment = async (): Promise<boolean> => {
  try {
    // Verifica connessione con Pterodactyl
    console.log('Verificando la connessione a Pterodactyl...');
    
    if (!apiKey) {
      console.error('API key di Pterodactyl non configurata');
      return false;
    }
    
    try {
      // Test base della connessione
      const response = await pterodactylAPI.get('/api/application/users');
      console.log('Connessione a Pterodactyl riuscita!');
      
      // Ritorna subito true per questa prima versione semplificata
      return true;
    } catch (error) {
      console.error('Impossibile connettersi a Pterodactyl. Verifica l\'URL e l\'API key.');
      return false;
    }
  } catch (error) {
    console.error('Errore durante il setup dell\'ambiente Pterodactyl');
    return false;
  }
};