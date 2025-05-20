import { storage } from '../storage';
import { setupMinecraftServer, checkPterodactylSetup } from './pterodactyl-setup';
import { InsertServer, Server } from '../../shared/schema';
import { log } from '../vite';

/**
 * Registra un server Minecraft per la migrazione da Docker a Pterodactyl
 * 
 * @param serverName Nome del server da migrare
 * @param serverType Tipo del server (minecraft, rust, ecc.)
 * @param port Porta del server
 * @param memory Memoria RAM in MB
 * @param disk Spazio disco in MB
 * @returns Il server registrato o null in caso di errore
 */
export async function registerServerForMigration(
  serverName: string,
  serverType: string,
  port: number,
  memory = 2048,
  disk = 10000
): Promise<Server | null> {
  try {
    log(`Registrazione del server ${serverName} per migrazione`, "migration");
    
    // Verifica se il server esiste già
    const existingServer = await storage.getServerByName(serverName);
    if (existingServer) {
      log(`Il server ${serverName} esiste già, non può essere registrato di nuovo`, "migration");
      return null;
    }
    
    // Verifica che Pterodactyl sia configurato
    const isPterodactylConfigured = await checkPterodactylSetup();
    if (!isPterodactylConfigured) {
      log("Pterodactyl non è configurato correttamente", "migration");
      return null;
    }
    
    // Crea un nuovo server in attesa di migrazione
    const newServer: InsertServer = {
      name: serverName,
      type: serverType,
      status: 'migration_pending',
      description: `Server in attesa di migrazione da Docker a Pterodactyl`,
      host: '10.0.0.254', // Indirizzo del nodo Pterodactyl
      port: port,
      maxPlayers: 20,
      currentPlayers: 0,
      version: '',
      createdAt: new Date(),
      lastOnline: new Date(),
      pterodactylId: null, // Sarà impostato dopo la creazione del server su Pterodactyl
      dockerId: null, // ID del container Docker attuale, da impostare durante la migrazione
      memory: memory,
      disk: disk,
      cpu: 100, // Limite CPU in percentuale
    };
    
    // Registra il server nel database
    const server = await storage.createServer(newServer);
    log(`Server ${serverName} registrato con successo per la migrazione con ID ${server.id}`, "migration");
    
    // Ritorna il server creato
    return server;
  } catch (error) {
    log(`Errore durante la registrazione del server per la migrazione: ${error}`, "migration");
    return null;
  }
}

/**
 * Esegue la migrazione effettiva di un server da Docker a Pterodactyl
 * 
 * @param serverId ID del server da migrare
 * @returns True se la migrazione è riuscita, altrimenti false
 */
export async function migrateServer(serverId: number): Promise<boolean> {
  try {
    log(`Avvio migrazione del server con ID ${serverId}`, "migration");
    
    // Ottieni il server dal database
    const server = await storage.getServer(serverId);
    if (!server) {
      log(`Server con ID ${serverId} non trovato`, "migration");
      return false;
    }
    
    if (server.status !== 'migration_pending') {
      log(`Il server ${server.name} non è in attesa di migrazione (stato attuale: ${server.status})`, "migration");
      return false;
    }
    
    // Aggiorna lo stato del server
    await storage.updateServer(serverId, { status: 'migration_in_progress' });
    
    // Configura il nuovo server su Pterodactyl
    if (server.type === 'minecraft') {
      log(`Configurazione server Minecraft ${server.name} su Pterodactyl`, "migration");
      
      // Crea il server su Pterodactyl
      const result = await setupMinecraftServer({
        name: server.name,
        description: server.description || '',
        port: server.port
      });
      
      if (!result) {
        log(`Errore nella creazione del server su Pterodactyl`, "migration");
        await storage.updateServer(serverId, { status: 'migration_failed' });
        return false;
      }
      
      log(`Server creato con successo su Pterodactyl con ID ${result.id}`, "migration");
      
      // Aggiorna lo stato e l'ID Pterodactyl nel database
      await storage.updateServer(serverId, { 
        pterodactylId: result.id, 
        status: 'migration_completed' 
      });
      
      // La migrazione dei dati (mondo, configurazione, ecc.) dovrà essere fatta manualmente
      // o implementando un meccanismo di sincronizzazione dei file
      
      return true;
    } else {
      log(`Migrazione del tipo di server ${server.type} non implementata`, "migration");
      await storage.updateServer(serverId, { status: 'migration_failed' });
      return false;
    }
  } catch (error) {
    log(`Errore durante la migrazione del server: ${error}`, "migration");
    
    // Se possibile, aggiorna lo stato del server
    if (serverId) {
      await storage.updateServer(serverId, { status: 'migration_failed' });
    }
    
    return false;
  }
}

/**
 * Ottiene lo stato di una migrazione
 * 
 * @param serverId ID del server
 * @returns Stato della migrazione o null se il server non esiste
 */
export async function getMigrationStatus(serverId: number): Promise<string | null> {
  try {
    const server = await storage.getServer(serverId);
    if (!server) {
      return null;
    }
    
    // Controlla se lo stato è uno degli stati di migrazione
    const migrationStates = [
      'migration_pending', 
      'migration_in_progress', 
      'migration_completed', 
      'migration_failed'
    ];
    
    if (migrationStates.includes(server.status)) {
      return server.status;
    }
    
    return 'not_in_migration';
  } catch (error) {
    log(`Errore nel recupero dello stato di migrazione: ${error}`, "migration");
    return null;
  }
}

/**
 * Verifica se un server è stato migrato con successo
 * 
 * @param serverId ID del server
 * @returns True se la migrazione è stata completata con successo
 */
export async function isMigrationCompleted(serverId: number): Promise<boolean> {
  const status = await getMigrationStatus(serverId);
  return status === 'migration_completed';
}