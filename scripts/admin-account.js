// Script per creare o aggiornare un account amministratore
// Questo script permette di creare un utente admin direttamente da riga di comando

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

// Creare l'interfaccia readline per l'input da riga di comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connessione al database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Funzione per chiedere le informazioni dell'utente in modo interattivo
function promptUserInfo() {
  return new Promise((resolve) => {
    console.log('\n=== Creazione Utente Amministratore ===');
    
    rl.question('Username: ', (username) => {
      if (!username.trim()) {
        console.error('Username non valido. Riprova.');
        return resolve(promptUserInfo());
      }
      
      rl.question('Email: ', (email) => {
        if (!email.trim() || !email.includes('@')) {
          console.error('Email non valida. Riprova.');
          return resolve(promptUserInfo());
        }
        
        rl.question('Password (min 8 caratteri): ', (password) => {
          if (!password.trim() || password.length < 8) {
            console.error('Password troppo corta. Riprova con una password di almeno 8 caratteri.');
            return resolve(promptUserInfo());
          }
          
          rl.question('Conferma password: ', (confirmPassword) => {
            if (password !== confirmPassword) {
              console.error('Le password non corrispondono. Riprova.');
              return resolve(promptUserInfo());
            }
            
            resolve({ username, email, password });
          });
        });
      });
    });
  });
}

// Funzione per verificare se un utente esiste già
async function checkExistingUser(username, email) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    return {
      exists: result.rows.length > 0,
      user: result.rows[0],
      usernameExists: result.rows.some(user => user.username === username),
      emailExists: result.rows.some(user => user.email === email)
    };
  } catch (error) {
    console.error('Errore durante la verifica dell\'utente esistente:', error);
    throw error;
  }
}

// Funzione per creare un nuovo utente admin
async function createAdminUser(userData) {
  try {
    // Cripta la password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Crea l'utente
    const result = await pool.query(
      `INSERT INTO users 
       (username, email, password, role, is_verified, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id, username, email, role, created_at`,
      [userData.username, userData.email, hashedPassword, 'admin', true]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Errore durante la creazione dell\'utente admin:', error);
    throw error;
  }
}

// Funzione per promuovere un utente esistente ad admin
async function promoteToAdmin(userId) {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET role = 'admin', is_verified = true 
       WHERE id = $1 
       RETURNING id, username, email, role, created_at`,
      [userId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Errore durante la promozione dell\'utente ad admin:', error);
    throw error;
  }
}

// Funzione per cambiare la password di un utente esistente
async function changePassword(userId, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Errore durante il cambio password:', error);
    throw error;
  }
}

// Funzione principale
async function main() {
  try {
    // Verifica se la tabella users esiste
    try {
      await pool.query('SELECT 1 FROM users LIMIT 1');
    } catch (error) {
      if (error.code === '42P01') { // Codice errore PostgreSQL per tabella inesistente
        console.error('❌ Tabella users non trovata. Devi prima inizializzare il database.');
        rl.close();
        return;
      }
      throw error;
    }
    
    // Chiedi le informazioni dell'utente
    const userData = await promptUserInfo();
    
    // Verifica se l'utente esiste già
    const existingUserCheck = await checkExistingUser(userData.username, userData.email);
    
    if (existingUserCheck.exists) {
      if (existingUserCheck.usernameExists && existingUserCheck.emailExists) {
        console.log(`\nUn utente con username "${userData.username}" e email "${userData.email}" esiste già.`);
        
        // Se l'utente esistente non è un admin, chiedi se promuoverlo
        if (existingUserCheck.user.role !== 'admin') {
          rl.question('Vuoi promuovere questo utente ad amministratore? (s/n): ', async (answer) => {
            if (answer.toLowerCase() === 's') {
              const promotedUser = await promoteToAdmin(existingUserCheck.user.id);
              console.log('\n✅ Utente promosso ad amministratore con successo!');
              console.log('Dettagli:', promotedUser);
            } else {
              console.log('\nOperazione annullata.');
            }
            rl.close();
          });
          return;
        }
        
        // Se l'utente esistente è già un admin, chiedi se cambiare la password
        rl.question('Vuoi cambiare la password di questo utente? (s/n): ', async (answer) => {
          if (answer.toLowerCase() === 's') {
            await changePassword(existingUserCheck.user.id, userData.password);
            console.log('\n✅ Password modificata con successo!');
          } else {
            console.log('\nOperazione annullata.');
          }
          rl.close();
        });
        return;
      }
      
      // Username o email esistono ma non entrambi
      if (existingUserCheck.usernameExists) {
        console.error(`\n❌ Username "${userData.username}" già in uso.`);
      }
      
      if (existingUserCheck.emailExists) {
        console.error(`\n❌ Email "${userData.email}" già in uso.`);
      }
      
      rl.close();
      return;
    }
    
    // Crea l'utente admin
    const newUser = await createAdminUser(userData);
    
    console.log('\n✅ Utente amministratore creato con successo!');
    console.log('Dettagli:');
    console.log(`ID: ${newUser.id}`);
    console.log(`Username: ${newUser.username}`);
    console.log(`Email: ${newUser.email}`);
    console.log(`Ruolo: ${newUser.role}`);
    console.log(`Creato il: ${newUser.created_at}`);
    
    rl.close();
  } catch (error) {
    console.error('❌ Si è verificato un errore:', error);
    rl.close();
  } finally {
    await pool.end();
  }
}

// Esegui il programma
main();