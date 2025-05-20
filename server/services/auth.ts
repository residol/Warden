import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User, InsertUser, userRoleEnum } from '@shared/schema';
import { storage } from '../storage';
import crypto from 'crypto';

// Controlla che JWT_SECRET sia definito
if (!process.env.JWT_SECRET) {
  console.warn('ATTENZIONE: JWT_SECRET non è definito. Verrà utilizzato un valore casuale temporaneo, ma i token JWT non saranno persistenti tra i riavvii.');
}

// Usa JWT_SECRET dall'ambiente o genera un valore casuale temporaneo
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// 15 minuti per l'access token
const ACCESS_TOKEN_EXPIRY = '15m';
// 7 giorni per il refresh token
const REFRESH_TOKEN_EXPIRY = '7d';

// Interfaccia per i payload dei token
interface TokenPayload {
  userId: number;
  username: string;
  email: string;
  role: typeof userRoleEnum.enumValues[number];
  type: 'access' | 'refresh';
}

// Classe per il servizio di autenticazione
export class AuthService {
  // Registra un nuovo utente
  async register(userData: InsertUser): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Controlla se l'utente esiste già
    const existingUserByUsername = await storage.getUserByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error('Il nome utente è già in uso');
    }
    
    // Criptare la password prima di salvarla
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    // Crea l'utente con la password criptata
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword
    });
    
    // Genera token di accesso e refresh
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Salva il refresh token nel database
    await this.saveRefreshToken(user.id, refreshToken);
    
    return { user, accessToken, refreshToken };
  }
  
  // Effettua il login di un utente esistente
  async login(username: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Trova l'utente
    const user = await storage.getUserByUsername(username);
    if (!user) {
      throw new Error('Credenziali non valide');
    }
    
    // Verifica la password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Credenziali non valide');
    }
    
    // Aggiorna lastLogin
    await storage.updateUser(user.id, { lastLogin: new Date() });
    
    // Genera token di accesso e refresh
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Salva il refresh token nel database
    await this.saveRefreshToken(user.id, refreshToken);
    
    return { user, accessToken, refreshToken };
  }
  
  // Rinnova il token di accesso usando un refresh token
  async refreshToken(token: string): Promise<{ accessToken: string; user: User }> {
    try {
      // Verifica e decodifica il token
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      // Controlla che sia un refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Token non valido');
      }
      
      // Trova l'utente
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        throw new Error('Utente non trovato');
      }
      
      // Verifica che il token sia ancora valido nel database
      const isValidToken = await this.isRefreshTokenValid(user.id, token);
      if (!isValidToken) {
        throw new Error('Token non valido o scaduto');
      }
      
      // Genera un nuovo token di accesso
      const accessToken = this.generateAccessToken(user);
      
      return { accessToken, user };
    } catch (error) {
      throw new Error('Impossibile rinnovare il token: ' + (error as Error).message);
    }
  }
  
  // Disconnetti un utente invalidando tutti i suoi refresh token
  async logout(userId: number): Promise<void> {
    // Qui dovremmo rimuovere tutti i refresh token dell'utente
    await this.invalidateAllRefreshTokens(userId);
  }
  
  // Genera un token di accesso per un utente
  private generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      type: 'access'
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }
  
  // Genera un token di refresh per un utente
  private generateRefreshToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      type: 'refresh'
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  }
  
  // Salva un refresh token nel database
  private async saveRefreshToken(userId: number, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 giorni di validità
    
    await storage.createSession({
      userId,
      token,
      expiresAt
    });
  }
  
  // Verifica se un refresh token è valido
  private async isRefreshTokenValid(userId: number, token: string): Promise<boolean> {
    const sessions = await storage.getSessionsByUserId(userId);
    return sessions.some(session => session.token === token && session.expiresAt > new Date());
  }
  
  // Invalida tutti i refresh token di un utente
  private async invalidateAllRefreshTokens(userId: number): Promise<void> {
    await storage.deleteSessionsByUserId(userId);
  }
  
  // Verifica un token JWT e restituisce il payload
  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error('Token non valido');
    }
  }
  
  // Cripta una password
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
  
  // Sincronizza i ruoli di Discord con i ruoli dell'app
  async syncDiscordRole(userId: number, discordId: string, discordRole: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('Utente non trovato');
    }
    
    let role = user.role;
    
    // Mappa i ruoli di Discord ai ruoli dell'app
    switch (discordRole) {
      case 'Admin':
        role = 'admin';
        break;
      case 'Moderator':
        role = 'moderator';
        break;
      case 'Supporter':
        role = 'supporter';
        break;
      default:
        role = 'member';
    }
    
    // Aggiorna i dati dell'utente
    await storage.updateUser(userId, { 
      discordId, 
      role
    });
    
    // Log dell'azione
    await this.logUserAction(userId, 'role_sync', { discordRole, newRole: role });
  }
  
  // Registra un'azione dell'utente nei log di audit
  async logUserAction(userId: number, action: string, details: Record<string, any> = {}, ipAddress?: string, userAgent?: string): Promise<void> {
    await storage.createAuditLog({
      userId,
      action,
      details,
      ipAddress,
      userAgent
    });
  }
}

// Istanza singleton del servizio di autenticazione
export const authService = new AuthService();