/**
 * Script per testare la migrazione dei server Minecraft da Docker a Pterodactyl
 * 
 * Questo script invia una richiesta POST all'endpoint /api/servers/migrate
 * per registrare un server Minecraft per la migrazione.
 */

import http from 'http';

function migrateServer(serverName, serverType, port, memory = 2048, disk = 10000) {
  // Dati del server da migrare
  const data = JSON.stringify({
    name: serverName,
    type: serverType || 'minecraft',
    port: parseInt(port),
    memory: parseInt(memory),
    disk: parseInt(disk)
  });

  // Opzioni della richiesta HTTP
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/servers/migrate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  // Esegui la richiesta HTTP
  const req = http.request(options, (res) => {
    console.log(`Stato della risposta: ${res.statusCode}`);
    
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(responseData);
        console.log('Risposta server:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        if (res.statusCode === 201) {
          console.log('\n✅ Server registrato per migrazione con successo!');
          console.log(`\nIl server "${serverName}" (${serverType}) è ora registrato per la migrazione a Pterodactyl.`);
          console.log(`- ID: ${parsedData.server.id}`);
          console.log(`- Porta: ${parsedData.server.port}`);
          console.log(`- Stato: ${parsedData.server.status}`);
        } else {
          console.log('\n❌ Errore durante la registrazione del server.');
        }
      } catch (e) {
        console.error('Errore nel parsing della risposta:', e);
        console.log('Risposta raw:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Errore durante la richiesta:', error);
  });

  // Invia i dati della richiesta
  req.write(data);
  req.end();
  
  console.log(`Invio richiesta per migrare il server "${serverName}" (${serverType}) sulla porta ${port}...`);
}

// Ottieni i parametri dalla riga di comando
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Utilizzo: node migration-test.js <nome_server> <tipo_server> <porta> [memoria_MB] [disco_MB]');
  console.log('Esempio: node migration-test.js "Minecraft Survival" minecraft 25565 2048 10000');
  process.exit(1);
}

const [serverName, serverType, port, memory, disk] = args;

// Esegui la migrazione
migrateServer(serverName, serverType, port, memory, disk);