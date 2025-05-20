// Sistema di gestione utenti avanzato
// Questo modulo gestisce utenti, ruoli e permessi

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configurazione
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';
const DEFAULT_ADMIN = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'admin',  // Sarà criptato durante l'inizializzazione
  role: 'admin'
};

// Ruoli disponibili
export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
  SUPPORTER: 'supporter',
  GUEST: 'guest'
};

// Permessi per ogni ruolo
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    'user:manage', 'user:view', 'user:create', 'user:edit', 'user:delete',
    'server:manage', 'server:view', 'server:create', 'server:edit', 'server:delete', 'server:control',
    'wireguard:manage', 'wireguard:view', 'wireguard:create', 'wireguard:edit', 'wireguard:delete',
    'system:manage', 'system:view', 'system:edit',
    'discord:manage', 'discord:view',
    'pterodactyl:manage', 'pterodactyl:view', 'pterodactyl:edit'
  ],
  [USER_ROLES.MODERATOR]: [
    'user:view', 'user:edit',
    'server:view', 'server:edit', 'server:control',
    'wireguard:view', 'wireguard:edit',
    'system:view',
    'discord:view',
    'pterodactyl:view'
  ],
  [USER_ROLES.MEMBER]: [
    'user:view',
    'server:view', 'server:control',
    'wireguard:view',
    'system:view',
    'discord:view',
    'pterodactyl:view'
  ],
  [USER_ROLES.SUPPORTER]: [
    'user:view',
    'server:view', 'server:control',
    'wireguard:view',
    'system:view',
    'discord:view',
    'pterodactyl:view'
  ],
  [USER_ROLES.GUEST]: [
    'user:view',
    'server:view',
    'system:view'
  ]
};

// Riferimenti esterni
let databaseConnector = null;
let auditLogger = null;

// ==========================================
// GESTIONE UTENTI
// ==========================================

/**
 * Crea un nuovo utente
 * @param {Object} userData - Dati dell'utente
 * @param {string} userData.username - Nome utente
 * @param {string} userData.email - Email
 * @param {string} userData.password - Password (verrà criptata)
 * @param {string} userData.role - Ruolo (default: 'member')
 * @param {string} userData.discordId - ID Discord (opzionale)
 * @param {boolean} userData.isVerified - Se l'utente è verificato (default: false)
 * @returns {Promise<Object>} - L'utente creato
 */
export async function createUser(userData) {
  // Verifica che i dati minimi siano presenti
  if (!userData.username || !userData.email || !userData.password) {
    throw new Error('Username, email e password sono obbligatori');
  }
  
  // Verifica che l'utente non esista già
  const existingUser = await getUserByUsername(userData.username);
  if (existingUser) {
    throw new Error('Username già in uso');
  }
  
  const existingEmail = await getUserByEmail(userData.email);
  if (existingEmail) {
    throw new Error('Email già in uso');
  }
  
  // Cripta la password
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // Prepara i dati utente per l'inserimento
  const userToInsert = {
    username: userData.username,
    email: userData.email,
    password: hashedPassword,
    role: userData.role || USER_ROLES.MEMBER,
    discordId: userData.discordId || null,
    isVerified: userData.isVerified || false,
    createdAt: new Date(),
    lastLogin: null
  };
  
  // Inserisci l'utente nel database
  try {
    const user = await databaseConnector.query(
      `INSERT INTO users 
       (username, email, password, role, discord_id, is_verified, created_at, last_login) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email, role, discord_id, is_verified, created_at, last_login`,
      [
        userToInsert.username,
        userToInsert.email,
        userToInsert.password,
        userToInsert.role,
        userToInsert.discordId,
        userToInsert.isVerified,
        userToInsert.createdAt,
        userToInsert.lastLogin
      ]
    );
    
    // Log dell'azione
    if (auditLogger) {
      await auditLogger.logAction({
        action: auditLogger.AUDIT_ACTIONS.USER_CREATE,
        userId: 'system',
        username: 'System',
        description: `Utente ${userData.username} creato`,
        details: {
          username: userData.username,
          email: userData.email,
          role: userToInsert.role
        }
      });
    }
    
    return user.rows[0];
  } catch (error) {
    console.error('Errore durante la creazione dell\'utente:', error);
    throw new Error('Errore durante la creazione dell\'utente');
  }
}

/**
 * Ottiene un utente dal database per ID
 * @param {number} userId - ID dell'utente
 * @returns {Promise<Object|null>} - L'utente trovato o null
 */
export async function getUser(userId) {
  try {
    const result = await databaseConnector.query(
      `SELECT id, username, email, role, discord_id, is_verified, created_at, last_login 
       FROM users 
       WHERE id = $1`,
      [userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Errore durante il recupero dell\'utente:', error);
    throw new Error('Errore durante il recupero dell\'utente');
  }
}

/**
 * Ottiene un utente dal database per username
 * @param {string} username - Nome utente
 * @returns {Promise<Object|null>} - L'utente trovato o null
 */
export async function getUserByUsername(username) {
  try {
    const result = await databaseConnector.query(
      `SELECT id, username, email, password, role, discord_id, is_verified, created_at, last_login 
       FROM users 
       WHERE username = $1`,
      [username]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Errore durante il recupero dell\'utente:', error);
    throw new Error('Errore durante il recupero dell\'utente');
  }
}

/**
 * Ottiene un utente dal database per email
 * @param {string} email - Email dell'utente
 * @returns {Promise<Object|null>} - L'utente trovato o null
 */
export async function getUserByEmail(email) {
  try {
    const result = await databaseConnector.query(
      `SELECT id, username, email, password, role, discord_id, is_verified, created_at, last_login 
       FROM users 
       WHERE email = $1`,
      [email]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Errore durante il recupero dell\'utente:', error);
    throw new Error('Errore durante il recupero dell\'utente');
  }
}

/**
 * Ottiene un utente dal database per ID Discord
 * @param {string} discordId - ID Discord dell'utente
 * @returns {Promise<Object|null>} - L'utente trovato o null
 */
export async function getUserByDiscordId(discordId) {
  try {
    const result = await databaseConnector.query(
      `SELECT id, username, email, password, role, discord_id, is_verified, created_at, last_login 
       FROM users 
       WHERE discord_id = $1`,
      [discordId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Errore durante il recupero dell\'utente:', error);
    throw new Error('Errore durante il recupero dell\'utente');
  }
}

/**
 * Ottiene tutti gli utenti dal database
 * @param {number} limit - Limite di risultati
 * @param {number} offset - Offset per la paginazione
 * @returns {Promise<Array>} - Array di utenti
 */
export async function getAllUsers(limit = 100, offset = 0) {
  try {
    const result = await databaseConnector.query(
      `SELECT id, username, email, role, discord_id, is_verified, created_at, last_login 
       FROM users 
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Errore durante il recupero degli utenti:', error);
    throw new Error('Errore durante il recupero degli utenti');
  }
}

/**
 * Aggiorna un utente nel database
 * @param {number} userId - ID dell'utente
 * @param {Object} userData - Dati dell'utente da aggiornare
 * @returns {Promise<Object>} - L'utente aggiornato
 */
export async function updateUser(userId, userData) {
  // Verifica che l'utente esista
  const existingUser = await getUser(userId);
  if (!existingUser) {
    throw new Error('Utente non trovato');
  }
  
  // Prepara i campi da aggiornare
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  // Aggiungi i campi da aggiornare
  if (userData.username) {
    updates.push(`username = $${paramIndex++}`);
    values.push(userData.username);
  }
  
  if (userData.email) {
    updates.push(`email = $${paramIndex++}`);
    values.push(userData.email);
  }
  
  if (userData.password) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    updates.push(`password = $${paramIndex++}`);
    values.push(hashedPassword);
  }
  
  if (userData.role) {
    updates.push(`role = $${paramIndex++}`);
    values.push(userData.role);
  }
  
  if (userData.discordId !== undefined) {
    updates.push(`discord_id = $${paramIndex++}`);
    values.push(userData.discordId);
  }
  
  if (userData.isVerified !== undefined) {
    updates.push(`is_verified = $${paramIndex++}`);
    values.push(userData.isVerified);
  }
  
  if (userData.lastLogin) {
    updates.push(`last_login = $${paramIndex++}`);
    values.push(userData.lastLogin);
  }
  
  // Se non ci sono campi da aggiornare, restituisci l'utente esistente
  if (updates.length === 0) {
    return existingUser;
  }
  
  // Aggiungi l'ID dell'utente ai valori
  values.push(userId);
  
  // Esegui l'aggiornamento
  try {
    const result = await databaseConnector.query(
      `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, username, email, role, discord_id, is_verified, created_at, last_login`,
      values
    );
    
    // Log dell'azione
    if (auditLogger) {
      await auditLogger.logAction({
        action: auditLogger.AUDIT_ACTIONS.USER_MODIFY,
        userId: 'system',
        username: 'System',
        description: `Utente ${existingUser.username} aggiornato`,
        details: {
          userId,
          username: userData.username || existingUser.username,
          changes: Object.keys(userData).filter(key => key !== 'password')
        }
      });
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'utente:', error);
    throw new Error('Errore durante l\'aggiornamento dell\'utente');
  }
}

/**
 * Elimina un utente dal database
 * @param {number} userId - ID dell'utente
 * @returns {Promise<boolean>} - True se l'eliminazione è riuscita
 */
export async function deleteUser(userId) {
  // Verifica che l'utente esista
  const existingUser = await getUser(userId);
  if (!existingUser) {
    throw new Error('Utente non trovato');
  }
  
  // Elimina l'utente
  try {
    await databaseConnector.query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );
    
    // Log dell'azione
    if (auditLogger) {
      await auditLogger.logAction({
        action: auditLogger.AUDIT_ACTIONS.USER_DELETE,
        userId: 'system',
        username: 'System',
        description: `Utente ${existingUser.username} eliminato`,
        details: {
          userId,
          username: existingUser.username
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'utente:', error);
    throw new Error('Errore durante l\'eliminazione dell\'utente');
  }
}

/**
 * Cambia il ruolo di un utente
 * @param {number} userId - ID dell'utente
 * @param {string} newRole - Nuovo ruolo
 * @param {number} adminId - ID dell'amministratore che esegue l'azione
 * @returns {Promise<Object>} - L'utente aggiornato
 */
export async function changeUserRole(userId, newRole, adminId) {
  // Verifica che il ruolo sia valido
  if (!Object.values(USER_ROLES).includes(newRole)) {
    throw new Error('Ruolo non valido');
  }
  
  // Verifica che l'utente esista
  const existingUser = await getUser(userId);
  if (!existingUser) {
    throw new Error('Utente non trovato');
  }
  
  // Verifica che l'amministratore esista
  const admin = await getUser(adminId);
  if (!admin || admin.role !== USER_ROLES.ADMIN) {
    throw new Error('Solo gli amministratori possono cambiare i ruoli');
  }
  
  // Aggiorna il ruolo
  try {
    const result = await databaseConnector.query(
      `UPDATE users 
       SET role = $1 
       WHERE id = $2 
       RETURNING id, username, email, role, discord_id, is_verified, created_at, last_login`,
      [newRole, userId]
    );
    
    // Log dell'azione
    if (auditLogger) {
      await auditLogger.logAction({
        action: auditLogger.AUDIT_ACTIONS.USER_ROLE_CHANGE,
        userId: adminId,
        username: admin.username,
        description: `Ruolo di ${existingUser.username} cambiato da ${existingUser.role} a ${newRole}`,
        details: {
          userId,
          username: existingUser.username,
          oldRole: existingUser.role,
          newRole
        }
      });
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Errore durante il cambio di ruolo:', error);
    throw new Error('Errore durante il cambio di ruolo');
  }
}

// ==========================================
// GESTIONE INVITI
// ==========================================

/**
 * Crea un invito per un nuovo utente
 * @param {Object} inviteData - Dati dell'invito
 * @param {string} inviteData.email - Email dell'utente da invitare
 * @param {string} inviteData.role - Ruolo da assegnare (default: 'member')
 * @param {number} creatorId - ID dell'utente che crea l'invito
 * @returns {Promise<Object>} - L'invito creato
 */
export async function createInvite(inviteData, creatorId) {
  // Verifica che i dati minimi siano presenti
  if (!inviteData.email) {
    throw new Error('Email obbligatoria');
  }
  
  // Verifica che l'utente creatore esista
  const creator = await getUser(creatorId);
  if (!creator) {
    throw new Error('Utente creatore non trovato');
  }
  
  // Verifica che il ruolo sia valido
  const role = inviteData.role || USER_ROLES.MEMBER;
  if (!Object.values(USER_ROLES).includes(role)) {
    throw new Error('Ruolo non valido');
  }
  
  // Verifica che non esista già un utente con questa email
  const existingUser = await getUserByEmail(inviteData.email);
  if (existingUser) {
    throw new Error('Esiste già un utente con questa email');
  }
  
  // Verifica che non esista già un invito attivo per questa email
  try {
    const existingInvite = await databaseConnector.query(
      `SELECT * FROM user_invites 
       WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [inviteData.email]
    );
    
    if (existingInvite.rows.length > 0) {
      throw new Error('Esiste già un invito attivo per questa email');
    }
  } catch (error) {
    if (error.message !== 'Esiste già un invito attivo per questa email') {
      console.error('Errore durante la verifica dell\'invito esistente:', error);
      throw new Error('Errore durante la verifica dell\'invito esistente');
    } else {
      throw error;
    }
  }
  
  // Genera un token univoco
  const token = crypto.randomBytes(32).toString('hex');
  
  // Imposta la data di scadenza (7 giorni)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  // Inserisci l'invito nel database
  try {
    const result = await databaseConnector.query(
      `INSERT INTO user_invites 
       (email, role, token, created_by, created_at, expires_at) 
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING id, email, role, token, created_by, created_at, expires_at, used_at`,
      [inviteData.email, role, token, creatorId, expiresAt]
    );
    
    // Log dell'azione
    if (auditLogger) {
      await auditLogger.logAction({
        action: auditLogger.AUDIT_ACTIONS.USER_INVITE,
        userId: creatorId,
        username: creator.username,
        description: `Invito creato per ${inviteData.email} con ruolo ${role}`,
        details: {
          email: inviteData.email,
          role,
          expiresAt
        }
      });
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Errore durante la creazione dell\'invito:', error);
    throw new Error('Errore durante la creazione dell\'invito');
  }
}

/**
 * Ottiene un invito per token
 * @param {string} token - Token dell'invito
 * @returns {Promise<Object|null>} - L'invito trovato o null
 */
export async function getInviteByToken(token) {
  try {
    const result = await databaseConnector.query(
      `SELECT * FROM user_invites 
       WHERE token = $1`,
      [token]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Errore durante il recupero dell\'invito:', error);
    throw new Error('Errore durante il recupero dell\'invito');
  }
}

/**
 * Registra un utente con un invito
 * @param {Object} userData - Dati dell'utente
 * @param {string} userData.token - Token dell'invito
 * @param {string} userData.username - Nome utente
 * @param {string} userData.password - Password
 * @returns {Promise<Object>} - L'utente creato e il token di accesso
 */
export async function registerWithInvite(userData) {
  // Verifica che i dati minimi siano presenti
  if (!userData.token || !userData.username || !userData.password) {
    throw new Error('Token, username e password sono obbligatori');
  }
  
  // Verifica che l'invito esista
  const invite = await getInviteByToken(userData.token);
  if (!invite) {
    throw new Error('Invito non trovato');
  }
  
  // Verifica che l'invito non sia scaduto
  if (invite.expires_at < new Date()) {
    throw new Error('Invito scaduto');
  }
  
  // Verifica che l'invito non sia già stato utilizzato
  if (invite.used_at) {
    throw new Error('Invito già utilizzato');
  }
  
  // Verifica che lo username non sia già in uso
  const existingUser = await getUserByUsername(userData.username);
  if (existingUser) {
    throw new Error('Username già in uso');
  }
  
  // Crea l'utente
  const user = await createUser({
    username: userData.username,
    email: invite.email,
    password: userData.password,
    role: invite.role,
    isVerified: true // Gli utenti invitati sono già verificati
  });
  
  // Marca l'invito come utilizzato
  try {
    await databaseConnector.query(
      `UPDATE user_invites 
       SET used_at = NOW(), used_by = $1 
       WHERE id = $2`,
      [user.id, invite.id]
    );
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'invito:', error);
    // Non fallire completamente se l'aggiornamento dell'invito fallisce
  }
  
  // Genera il token di accesso
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return {
    user,
    accessToken,
    refreshToken
  };
}

// ==========================================
// AUTENTICAZIONE
// ==========================================

/**
 * Autentica un utente
 * @param {string} username - Nome utente
 * @param {string} password - Password
 * @returns {Promise<Object>} - L'utente autenticato e il token di accesso
 */
export async function login(username, password) {
  // Verifica che username e password siano forniti
  if (!username || !password) {
    throw new Error('Username e password sono obbligatori');
  }
  
  // Ottieni l'utente dal database
  const user = await getUserByUsername(username);
  if (!user) {
    throw new Error('Credenziali non valide');
  }
  
  // Verifica la password
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error('Credenziali non valide');
  }
  
  // Aggiorna la data di ultimo accesso
  await updateUser(user.id, { lastLogin: new Date() });
  
  // Rimuovi la password dall'oggetto utente
  const { password: _, ...userWithoutPassword } = user;
  
  // Genera il token di accesso
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Log dell'azione
  if (auditLogger) {
    await auditLogger.logAction({
      action: auditLogger.AUDIT_ACTIONS.USER_LOGIN,
      userId: user.id,
      username: user.username,
      description: `Accesso utente ${user.username}`,
      details: {
        userId: user.id,
        role: user.role
      }
    });
  }
  
  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken
  };
}

/**
 * Genera un token di accesso per un utente
 * @param {Object} user - Utente
 * @returns {string} - Token di accesso
 */
export function generateAccessToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Genera un token di refresh per un utente
 * @param {Object} user - Utente
 * @returns {string} - Token di refresh
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verifica un token di accesso
 * @param {string} token - Token di accesso
 * @returns {Object} - Payload del token decodificato
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token non valido o scaduto');
  }
}

/**
 * Rinnova un token di accesso usando un token di refresh
 * @param {string} refreshToken - Token di refresh
 * @returns {Promise<Object>} - Nuovo token di accesso
 */
export async function refreshAccessToken(refreshToken) {
  try {
    // Verifica il token di refresh
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Ottieni l'utente dal database
    const user = await getUser(decoded.userId);
    if (!user) {
      throw new Error('Utente non trovato');
    }
    
    // Genera un nuovo token di accesso
    const newAccessToken = generateAccessToken(user);
    
    return {
      accessToken: newAccessToken
    };
  } catch (error) {
    throw new Error('Token di refresh non valido o scaduto');
  }
}

/**
 * Verifica se un utente ha un determinato permesso
 * @param {Object} user - Utente
 * @param {string} permission - Permesso da verificare
 * @returns {boolean} - True se l'utente ha il permesso
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

/**
 * Controlla se esiste un utente admin, se non esiste lo crea
 * @returns {Promise<Object>} - L'utente admin
 */
export async function ensureAdminExists() {
  try {
    // Controlla se esiste già un utente admin
    const result = await databaseConnector.query(
      `SELECT COUNT(*) FROM users WHERE role = $1`,
      [USER_ROLES.ADMIN]
    );
    
    const count = parseInt(result.rows[0].count, 10);
    
    // Se non esistono admin, crea l'utente admin predefinito
    if (count === 0) {
      console.log('Nessun utente admin trovato, creazione dell\'utente admin predefinito...');
      
      // Crea l'utente admin
      const admin = await createUser({
        username: DEFAULT_ADMIN.username,
        email: DEFAULT_ADMIN.email,
        password: DEFAULT_ADMIN.password,
        role: DEFAULT_ADMIN.role,
        isVerified: true
      });
      
      console.log(`Utente admin predefinito creato: ${admin.username}`);
      return admin;
    }
    
    return null;
  } catch (error) {
    console.error('Errore durante la verifica/creazione dell\'utente admin:', error);
    throw new Error('Errore durante la verifica/creazione dell\'utente admin');
  }
}

// ==========================================
// INIZIALIZZAZIONE
// ==========================================

/**
 * Inizializza il sistema di gestione utenti
 * @param {Object} options - Opzioni di configurazione
 * @param {Object} options.databaseConnector - Connettore al database
 * @param {Object} options.auditLogger - Logger per audit
 * @param {string} options.jwtSecret - Secret per JWT
 * @returns {Promise<boolean>} - True se l'inizializzazione è riuscita
 */
export async function initUserManagement(options = {}) {
  // Imposta i riferimenti esterni
  databaseConnector = options.databaseConnector;
  
  if (options.auditLogger) {
    auditLogger = options.auditLogger;
  }
  
  if (options.jwtSecret) {
    JWT_SECRET = options.jwtSecret;
  }
  
  // Verifica che il database sia configurato
  if (!databaseConnector) {
    console.error('Database connector non configurato');
    return false;
  }
  
  try {
    // Crea le tabelle se non esistono
    await databaseConnector.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        discord_id VARCHAR(255),
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);
    
    await databaseConnector.query(`
      CREATE TABLE IF NOT EXISTS user_invites (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        token VARCHAR(255) NOT NULL UNIQUE,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        used_by INTEGER REFERENCES users(id)
      )
    `);
    
    // Crea un indice per migliorare le prestazioni delle query
    await databaseConnector.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id);
      CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites (token);
      CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites (email);
    `);
    
    // Assicura che esista un utente admin
    await ensureAdminExists();
    
    console.log('Sistema di gestione utenti inizializzato con successo');
    return true;
  } catch (error) {
    console.error('Errore durante l\'inizializzazione del sistema di gestione utenti:', error);
    return false;
  }
}

// Esporta tutte le funzioni pubbliche
export default {
  USER_ROLES,
  ROLE_PERMISSIONS,
  initUserManagement,
  createUser,
  getUser,
  getUserByUsername,
  getUserByEmail,
  getUserByDiscordId,
  getAllUsers,
  updateUser,
  deleteUser,
  changeUserRole,
  createInvite,
  getInviteByToken,
  registerWithInvite,
  login,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  refreshAccessToken,
  hasPermission,
  ensureAdminExists
};