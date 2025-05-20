// Script di configurazione e integrazione con Pterodactyl
// Questo script configura l'integrazione con Pterodactyl e verifica la connessione

require('dotenv').config();
const axios = require('axios');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

// Configurazione iniziale
const config = {
  url: process.env.PTERODACTYL_URL || '',
  apiKey: process.env.PTERODACTYL_API_KEY || '',
  envFile: '.env'
};

// Verifica delle credenziali Pterodactyl
async function checkConnection() {
  try {
    console.log('Verifica della connessione a Pterodactyl...');
    
    if (!config.url || !config.apiKey) {
      console.error('URL o API key di Pterodactyl non configurati');
      return false;
    }
    
    const response = await axios.get(`${config.url}/api/application/users`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Connessione a Pterodactyl stabilita con successo!');
      console.log(`📊 Server disponibili: ${response.data.meta.pagination.total}`);
      return true;
    } else {
      console.error('❌ Errore durante la connessione a Pterodactyl:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Errore durante la connessione a Pterodactyl:');
    
    if (error.response) {
      console.error(`Stato: ${error.response.status}`);
      console.error('Messaggio:', error.response.data.error || error.response.data.message || 'Errore sconosciuto');
    } else if (error.request) {
      console.error('Nessuna risposta ricevuta dal server. Verifica URL e connessione di rete.');
    } else {
      console.error('Errore:', error.message);
    }
    
    return false;
  }
}

// Ottiene la lista dei server Pterodactyl
async function getServers() {
  try {
    const response = await axios.get(`${config.url}/api/application/servers`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (response.status === 200) {
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Errore durante il recupero dei server:', error.message);
    return [];
  }
}

// Ottiene la lista dei nodi disponibili
async function getNodes() {
  try {
    const response = await axios.get(`${config.url}/api/application/nodes`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (response.status === 200) {
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Errore durante il recupero dei nodi:', error.message);
    return [];
  }
}

// Ottiene i dettagli di un server specifico
async function getServerDetails(serverId) {
  try {
    const response = await axios.get(`${config.url}/api/application/servers/${serverId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (response.status === 200) {
      return response.data.attributes;
    }
    
    return null;
  } catch (error) {
    console.error(`Errore durante il recupero dei dettagli del server ${serverId}:`, error.message);
    return null;
  }
}

// Salva le credenziali nel file .env
async function saveCredentials(url, apiKey) {
  try {
    let envContent = '';
    
    // Leggi il file .env esistente se presente
    if (fs.existsSync(config.envFile)) {
      envContent = fs.readFileSync(config.envFile, 'utf8');
    }
    
    // Sostituisci o aggiungi le credenziali di Pterodactyl
    if (envContent.includes('PTERODACTYL_URL=')) {
      envContent = envContent.replace(/PTERODACTYL_URL=.*/, `PTERODACTYL_URL=${url}`);
    } else {
      envContent += `\nPTERODACTYL_URL=${url}`;
    }
    
    if (envContent.includes('PTERODACTYL_API_KEY=')) {
      envContent = envContent.replace(/PTERODACTYL_API_KEY=.*/, `PTERODACTYL_API_KEY=${apiKey}`);
    } else {
      envContent += `\nPTERODACTYL_API_KEY=${apiKey}`;
    }
    
    // Salva il file .env
    fs.writeFileSync(config.envFile, envContent);
    
    console.log('✅ Credenziali salvate con successo nel file .env');
    return true;
  } catch (error) {
    console.error('❌ Errore durante il salvataggio delle credenziali:', error.message);
    return false;
  }
}

// Crea un nuovo server Minecraft su Pterodactyl
async function createMinecraftServer(serverData) {
  try {
    const response = await axios.post(`${config.url}/api/application/servers`, serverData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (response.status === 201) {
      console.log('✅ Server Minecraft creato con successo!');
      console.log(`📊 ID Server: ${response.data.attributes.id}`);
      console.log(`📊 Identificatore: ${response.data.attributes.identifier}`);
      return response.data.attributes;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Errore durante la creazione del server Minecraft:');
    
    if (error.response) {
      console.error(`Stato: ${error.response.status}`);
      console.error('Messaggio:', error.response.data.errors || error.response.data.message || 'Errore sconosciuto');
    } else {
      console.error('Errore:', error.message);
    }
    
    return null;
  }
}

// Avvia l'interfaccia interattiva
async function startInteractive() {
  try {
    console.log('=== Configurazione Pterodactyl ===');
    
    // Ottieni le credenziali Pterodactyl
    const credentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'URL del pannello Pterodactyl (es. https://panel.example.com):',
        default: config.url,
        validate: input => input.startsWith('http') ? true : 'L\'URL deve iniziare con http:// o https://'
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key di Pterodactyl:',
        default: config.apiKey
      }
    ]);
    
    // Aggiorna la configurazione
    config.url = credentials.url.trim();
    config.apiKey = credentials.apiKey.trim();
    
    // Verifica la connessione
    const connected = await checkConnection();
    
    if (!connected) {
      const retry = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Vuoi riprovare con credenziali diverse?',
          default: true
        }
      ]);
      
      if (retry.retry) {
        return startInteractive();
      } else {
        console.log('Configurazione terminata senza successo.');
        return false;
      }
    }
    
    // Salva le credenziali
    await saveCredentials(config.url, config.apiKey);
    
    // Mostra il menu delle operazioni
    const action = await inquirer.prompt([
      {
        type: 'list',
        name: 'operation',
        message: 'Cosa vuoi fare?',
        choices: [
          { name: 'Mostra tutti i server', value: 'list-servers' },
          { name: 'Mostra tutti i nodi', value: 'list-nodes' },
          { name: 'Crea un nuovo server Minecraft', value: 'create-minecraft' },
          { name: 'Esci', value: 'exit' }
        ]
      }
    ]);
    
    switch (action.operation) {
      case 'list-servers':
        const servers = await getServers();
        console.log('\n=== Server Disponibili ===');
        
        if (servers.length === 0) {
          console.log('Nessun server trovato.');
        } else {
          servers.forEach(server => {
            console.log(`- ID: ${server.attributes.id}`);
            console.log(`  Nome: ${server.attributes.name}`);
            console.log(`  Identificatore: ${server.attributes.identifier}`);
            console.log(`  Stato: ${server.attributes.status || 'sconosciuto'}`);
            console.log(`  Node: ${server.attributes.node}`);
            console.log('---');
          });
        }
        
        // Torna al menu
        const returnToMenu = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'return',
            message: 'Vuoi tornare al menu principale?',
            default: true
          }
        ]);
        
        if (returnToMenu.return) {
          return startInteractive();
        }
        break;
        
      case 'list-nodes':
        const nodes = await getNodes();
        console.log('\n=== Nodi Disponibili ===');
        
        if (nodes.length === 0) {
          console.log('Nessun nodo trovato.');
        } else {
          nodes.forEach(node => {
            console.log(`- ID: ${node.attributes.id}`);
            console.log(`  Nome: ${node.attributes.name}`);
            console.log(`  FQDN: ${node.attributes.fqdn}`);
            console.log(`  Memoria: ${node.attributes.memory} MB`);
            console.log(`  Disco: ${node.attributes.disk} MB`);
            console.log('---');
          });
        }
        
        // Torna al menu
        const returnToMenuFromNodes = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'return',
            message: 'Vuoi tornare al menu principale?',
            default: true
          }
        ]);
        
        if (returnToMenuFromNodes.return) {
          return startInteractive();
        }
        break;
        
      case 'create-minecraft':
        // Ottieni i nodi disponibili
        const availableNodes = await getNodes();
        
        if (availableNodes.length === 0) {
          console.log('❌ Nessun nodo disponibile per creare un server.');
          return startInteractive();
        }
        
        // Prepara le scelte dei nodi
        const nodeChoices = availableNodes.map(node => ({
          name: `${node.attributes.name} (${node.attributes.fqdn})`,
          value: node.attributes.id
        }));
        
        // Chiedi le informazioni per il nuovo server
        const serverInfo = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Nome del server:',
            validate: input => input.trim() !== '' ? true : 'Il nome non può essere vuoto'
          },
          {
            type: 'list',
            name: 'node_id',
            message: 'Seleziona un nodo:',
            choices: nodeChoices
          },
          {
            type: 'input',
            name: 'memory',
            message: 'Memoria (MB):',
            default: '1024',
            validate: input => !isNaN(input) ? true : 'Inserisci un numero valido'
          },
          {
            type: 'input',
            name: 'disk',
            message: 'Spazio disco (MB):',
            default: '10240',
            validate: input => !isNaN(input) ? true : 'Inserisci un numero valido'
          },
          {
            type: 'input',
            name: 'cpu',
            message: 'CPU (%):',
            default: '100',
            validate: input => !isNaN(input) ? true : 'Inserisci un numero valido'
          },
          {
            type: 'list',
            name: 'minecraft_type',
            message: 'Tipo di server Minecraft:',
            choices: [
              { name: 'Paper', value: 'paper' },
              { name: 'Vanilla', value: 'vanilla' },
              { name: 'Forge', value: 'forge' },
              { name: 'Bungeecord', value: 'bungeecord' },
              { name: 'Spigot', value: 'spigot' }
            ]
          }
        ]);
        
        // Crea il server
        const serverData = {
          name: serverInfo.name,
          user: 1, // Assumiamo che l'utente con ID 1 sia l'amministratore
          egg: 1, // ID dell'egg per Minecraft (potrebbe variare, in genere 1 è Vanilla, 5 è Paper)
          docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
          startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
          environment: {
            SERVER_JARFILE: 'server.jar',
            MINECRAFT_VERSION: 'latest',
            BUILD_NUMBER: 'latest',
            SERVER_TYPE: serverInfo.minecraft_type
          },
          limits: {
            memory: parseInt(serverInfo.memory),
            swap: 0,
            disk: parseInt(serverInfo.disk),
            io: 500,
            cpu: parseInt(serverInfo.cpu)
          },
          feature_limits: {
            databases: 1,
            backups: 1
          },
          allocation: {
            default: 1 // Questo valore dovrebbe essere un ID di allocazione valido
          }
        };
        
        // In un'applicazione reale, dovresti ottenere un'allocazione valida
        console.log('\nATTENZIONE: Questo è un esempio e potrebbe non funzionare senza un\'allocazione valida.');
        console.log('Per creare un server reale, usa il pannello Pterodactyl direttamente.\n');
        
        const confirmCreate = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'create',
            message: 'Vuoi procedere con la creazione del server?',
            default: false
          }
        ]);
        
        if (confirmCreate.create) {
          await createMinecraftServer(serverData);
        }
        
        // Torna al menu
        const returnAfterCreate = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'return',
            message: 'Vuoi tornare al menu principale?',
            default: true
          }
        ]);
        
        if (returnAfterCreate.return) {
          return startInteractive();
        }
        break;
        
      case 'exit':
        console.log('Configurazione Pterodactyl completata.');
        return true;
    }
    
    return true;
  } catch (error) {
    console.error('Errore durante la configurazione:', error.message);
    return false;
  }
}

// Modalità non interattiva per script
async function runNonInteractive(url, apiKey) {
  // Aggiorna la configurazione
  if (url) config.url = url;
  if (apiKey) config.apiKey = apiKey;
  
  // Verifica la connessione
  const connected = await checkConnection();
  
  if (!connected) {
    console.error('Impossibile connettersi a Pterodactyl con le credenziali fornite.');
    return false;
  }
  
  // Salva le credenziali
  await saveCredentials(config.url, config.apiKey);
  
  console.log('=== Informazioni Server ===');
  const servers = await getServers();
  console.log(`Numero totale di server: ${servers.length}`);
  
  console.log('=== Informazioni Nodi ===');
  const nodes = await getNodes();
  console.log(`Numero totale di nodi: ${nodes.length}`);
  
  return true;
}

// Script principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--non-interactive') || args.includes('-n')) {
    // Modalità non interattiva
    const urlIndex = args.indexOf('--url');
    const apiKeyIndex = args.indexOf('--api-key');
    
    const url = urlIndex !== -1 ? args[urlIndex + 1] : null;
    const apiKey = apiKeyIndex !== -1 ? args[apiKeyIndex + 1] : null;
    
    await runNonInteractive(url, apiKey);
  } else {
    // Modalità interattiva
    await startInteractive();
  }
}

// Esegui lo script
main().catch(error => {
  console.error('Errore durante l\'esecuzione dello script:', error);
  process.exit(1);
});