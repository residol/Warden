import axios from 'axios';
import { log } from '../vite';

interface PterodactylServer {
  id: string;
  identifier: string;
  name: string;
  description: string;
  status: string;
  node: string;
  resources: {
    memory_limit: number;
    disk_limit: number;
    cpu_limit: number;
  };
  relationships?: {
    allocations?: {
      data: Array<{
        ip: string;
        port: number;
      }>;
    };
  };
}

interface PterodactylServerResource {
  current_state: string;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

interface PterodactylServerStats {
  id: string;
  name: string;
  status: string;
  memory: {
    current: number; // MB
    limit: number;   // MB
    percent: number;
  };
  cpu: {
    current: number; // percentuale (0-100)
    limit: number;   // percentuale o numero di core
  };
  disk: {
    current: number; // MB
    limit: number;   // MB
    percent: number;
  };
  network: {
    rx: number;     // bytes
    tx: number;     // bytes
  };
  uptime: number;   // secondi
  node: string;
}

export class PterodactylService {
  private apiKey: string;
  private baseUrl: string;
  private isConfigured: boolean = false;

  constructor() {
    this.apiKey = process.env.PTERODACTYL_API_KEY || '';
    this.baseUrl = process.env.PTERODACTYL_URL || 'https://panel.example.com/api';
    
    this.isConfigured = !!this.apiKey && this.baseUrl !== 'https://panel.example.com/api';
    
    if (this.isConfigured) {
      log('Chiave API Pterodactyl trovata, configurazione possibile', 'express');
    } else {
      log('Chiave API Pterodactyl non configurata o URL non valido', 'express');
    }
  }

  /**
   * Verifica se il servizio Pterodactyl è configurato correttamente
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Ottiene l'elenco di tutti i server
   */
  async getServers(): Promise<PterodactylServer[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/application/servers`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return response.data.data.map((server: any) => ({
        id: server.attributes.id,
        identifier: server.attributes.identifier,
        name: server.attributes.name,
        description: server.attributes.description,
        status: server.attributes.status,
        node: server.attributes.node,
        resources: {
          memory_limit: server.attributes.limits.memory,
          disk_limit: server.attributes.limits.disk,
          cpu_limit: server.attributes.limits.cpu
        },
        relationships: server.attributes.relationships
      }));
    } catch (error) {
      console.error('Errore durante il recupero dei server da Pterodactyl:', error);
      return [];
    }
  }

  /**
   * Ottiene le risorse di un server specifico
   */
  async getServerResources(serverId: string): Promise<PterodactylServerResource | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/application/servers/${serverId}/resources`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return {
        current_state: response.data.attributes.current_state,
        is_suspended: response.data.attributes.is_suspended,
        resources: {
          memory_bytes: response.data.attributes.resources.memory_bytes,
          cpu_absolute: response.data.attributes.resources.cpu_absolute,
          disk_bytes: response.data.attributes.resources.disk_bytes,
          network_rx_bytes: response.data.attributes.resources.network.rx_bytes,
          network_tx_bytes: response.data.attributes.resources.network.tx_bytes,
          uptime: response.data.attributes.resources.uptime
        }
      };
    } catch (error) {
      console.error(`Errore durante il recupero delle risorse del server ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Ottiene statistiche dettagliate per tutti i server
   */
  async getAllServersStats(): Promise<PterodactylServerStats[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const servers = await this.getServers();
      const stats: PterodactylServerStats[] = [];

      for (const server of servers) {
        const resources = await this.getServerResources(server.id);
        
        if (resources) {
          stats.push({
            id: server.id,
            name: server.name,
            status: resources.current_state,
            memory: {
              current: Math.round(resources.resources.memory_bytes / (1024 * 1024)), // Converti in MB
              limit: server.resources.memory_limit,
              percent: server.resources.memory_limit > 0 ? 
                Math.round((resources.resources.memory_bytes / (1024 * 1024) / server.resources.memory_limit) * 100) : 0
            },
            cpu: {
              current: Math.round(resources.resources.cpu_absolute * 100) / 100, // Arrotonda a 2 decimali
              limit: server.resources.cpu_limit
            },
            disk: {
              current: Math.round(resources.resources.disk_bytes / (1024 * 1024)), // Converti in MB
              limit: server.resources.disk_limit,
              percent: server.resources.disk_limit > 0 ? 
                Math.round((resources.resources.disk_bytes / (1024 * 1024) / server.resources.disk_limit) * 100) : 0
            },
            network: {
              rx: resources.resources.network_rx_bytes,
              tx: resources.resources.network_tx_bytes
            },
            uptime: resources.resources.uptime,
            node: server.node
          });
        }
      }

      return stats;
    } catch (error) {
      console.error('Errore durante il recupero delle statistiche dei server:', error);
      return [];
    }
  }

  /**
   * Crea un nuovo server Pterodactyl
   */
  async createServer(options: {
    name: string;
    user: number;
    egg: number;
    docker_image: string;
    startup: string;
    environment: Record<string, string>;
    limits: {
      memory: number;
      swap: number;
      disk: number;
      io: number;
      cpu: number;
    };
    feature_limits: {
      databases: number;
      backups: number;
    };
    allocation: {
      default: number;
    };
  }): Promise<{ id: string; identifier: string } | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/application/servers`, options, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return {
        id: response.data.attributes.id,
        identifier: response.data.attributes.identifier
      };
    } catch (error) {
      console.error('Errore durante la creazione del server su Pterodactyl:', error);
      return null;
    }
  }

  /**
   * Avvia un server
   */
  async startServer(serverId: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await axios.post(`${this.baseUrl}/application/servers/${serverId}/power`, {
        signal: 'start'
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error) {
      console.error(`Errore durante l'avvio del server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Ferma un server
   */
  async stopServer(serverId: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await axios.post(`${this.baseUrl}/application/servers/${serverId}/power`, {
        signal: 'stop'
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error) {
      console.error(`Errore durante l'arresto del server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Riavvia un server
   */
  async restartServer(serverId: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await axios.post(`${this.baseUrl}/application/servers/${serverId}/power`, {
        signal: 'restart'
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error) {
      console.error(`Errore durante il riavvio del server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Crea un backup per un server
   */
  async createBackup(serverId: string, name?: string): Promise<{ identifier: string; name: string; } | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/application/servers/${serverId}/backups`, {
        name: name || `Backup automatico ${new Date().toISOString()}`
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return {
        identifier: response.data.attributes.uuid,
        name: response.data.attributes.name
      };
    } catch (error) {
      console.error(`Errore durante la creazione del backup per il server ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Verifica lo stato di Pterodactyl e restituisce informazioni diagnostiche
   */
  async checkStatus(): Promise<{
    isAvailable: boolean;
    version?: string;
    servers?: number;
    nodes?: number;
    totalResources?: {
      memory: number;
      disk: number;
      cpu: number;
    }
  }> {
    if (!this.isConfigured) {
      return { isAvailable: false };
    }

    try {
      // Tenta di ottenere la lista dei server come verifica di disponibilità
      const servers = await this.getServers();
      
      // In un'implementazione reale, qui otterremmo anche le informazioni sui nodi
      // e altre metriche di sistema, ma per semplicità simuliamo alcune informazioni
      
      return {
        isAvailable: true,
        version: '1.10.1', // Simulato
        servers: servers.length,
        nodes: 1, // Simulato
        totalResources: {
          memory: servers.reduce((total, server) => total + server.resources.memory_limit, 0),
          disk: servers.reduce((total, server) => total + server.resources.disk_limit, 0),
          cpu: servers.reduce((total, server) => total + server.resources.cpu_limit, 0)
        }
      };
    } catch (error) {
      console.error('Errore durante la verifica dello stato di Pterodactyl:', error);
      return { isAvailable: false };
    }
  }
}

// Esporta un'istanza singleton
export const pterodactyl = new PterodactylService();