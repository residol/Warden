import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from '../storage';
import { generateToken, generateRefreshToken } from '../middleware/auth-middleware';
import { userRoleEnum, InsertUser, InsertUserInvite } from '@shared/schema';

export class AuthController {
  // Registrazione di un nuovo utente
  async register(req: Request, res: Response) {
    try {
      const { username, email, password, role = 'member' } = req.body;

      // Validazione base
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Tutti i campi sono obbligatori' });
      }

      // Verifica che il ruolo sia valido
      if (!userRoleEnum.enumValues.includes(role)) {
        return res.status(400).json({ message: 'Ruolo non valido' });
      }

      // Verifica se l'utente esiste già
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Nome utente già in uso' });
      }

      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Email già in uso' });
      }

      // Criptare la password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Crea il nuovo utente
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role,
        patreonTier: null,
        isVerified: false
      } as InsertUser);

      // Genera token JWT
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Crea un nuovo oggetto senza la password
      const { password: _, ...userWithoutPassword } = user;

      // Restituisci utente e token
      res.status(201).json({
        message: 'Utente registrato con successo',
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      res.status(500).json({ message: 'Errore del server durante la registrazione' });
    }
  }

  // Login utente
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      // Validazione base
      if (!username || !password) {
        return res.status(400).json({ message: 'Nome utente e password sono obbligatori' });
      }

      // Verifica se l'utente esiste
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Credenziali non valide' });
      }

      // Verifica la password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Credenziali non valide' });
      }

      // Aggiorna l'ultimo login
      await storage.updateUser(user.id, { lastLogin: new Date() });

      // Genera token JWT
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Crea un nuovo oggetto senza la password
      const { password: _, ...userWithoutPassword } = user;

      // Restituisci utente e token
      res.status(200).json({
        message: 'Login effettuato con successo',
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Errore durante il login:', error);
      res.status(500).json({ message: 'Errore del server durante il login' });
    }
  }

  // Ottieni profilo utente
  async getProfile(req: Request, res: Response) {
    try {
      // L'id dell'utente è disponibile grazie al middleware isAuthenticated
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Utente non autenticato' });
      }

      // Ottieni i dati dell'utente
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Utente non trovato' });
      }

      // Crea un nuovo oggetto senza la password
      const { password: _, ...userWithoutPassword } = user;

      res.status(200).json({
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Errore durante il recupero del profilo:', error);
      res.status(500).json({ message: 'Errore del server durante il recupero del profilo' });
    }
  }

  // Crea un invito per un nuovo utente
  async createInvite(req: Request, res: Response) {
    try {
      const { email, role = 'member' } = req.body;
      const creatorId = req.userId;

      // Validazione base
      if (!email) {
        return res.status(400).json({ message: 'Email è obbligatoria' });
      }

      if (!creatorId) {
        return res.status(401).json({ message: 'Utente non autenticato' });
      }

      // Verifica che il ruolo sia valido
      if (!userRoleEnum.enumValues.includes(role)) {
        return res.status(400).json({ message: 'Ruolo non valido' });
      }

      // Controlla se esiste già un invito per questa email
      const existingInvite = await storage.getUserInviteByEmail(email);
      if (existingInvite && !existingInvite.usedAt) {
        return res.status(400).json({ message: 'Esiste già un invito attivo per questa email' });
      }

      // Genera un token univoco
      const token = crypto.randomBytes(32).toString('hex');

      // Imposta la data di scadenza (7 giorni)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Crea l'invito
      const invite = await storage.createUserInvite({
        email,
        role,
        token,
        expiresAt,
        createdBy: creatorId
      } as InsertUserInvite);

      res.status(201).json({
        message: 'Invito creato con successo',
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt
        }
      });
    } catch (error) {
      console.error('Errore durante la creazione dell\'invito:', error);
      res.status(500).json({ message: 'Errore del server durante la creazione dell\'invito' });
    }
  }

  // Registrazione con invito
  async registerWithInvite(req: Request, res: Response) {
    try {
      const { token, username, password } = req.body;

      // Validazione base
      if (!token || !username || !password) {
        return res.status(400).json({ message: 'Tutti i campi sono obbligatori' });
      }

      // Cerca l'invito
      const invite = await storage.getUserInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ message: 'Invito non trovato' });
      }

      // Verifica che l'invito non sia scaduto o già utilizzato
      const now = new Date();
      if (invite.expiresAt < now) {
        return res.status(400).json({ message: 'Invito scaduto' });
      }

      if (invite.usedAt) {
        return res.status(400).json({ message: 'Invito già utilizzato' });
      }

      // Verifica se il nome utente è già in uso
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Nome utente già in uso' });
      }

      // Criptare la password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Crea il nuovo utente
      const user = await storage.createUser({
        username,
        email: invite.email,
        password: hashedPassword,
        role: invite.role,
        patreonTier: null,
        isVerified: true // L'utente è verificato perché ha usato un invito
      } as InsertUser);

      // Marca l'invito come utilizzato
      await storage.updateUserInvite(invite.id, { usedAt: new Date() });

      // Genera token JWT
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Crea un nuovo oggetto senza la password
      const { password: _, ...userWithoutPassword } = user;

      // Restituisci utente e token
      res.status(201).json({
        message: 'Registrazione con invito completata con successo',
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Errore durante la registrazione con invito:', error);
      res.status(500).json({ message: 'Errore del server durante la registrazione con invito' });
    }
  }

  // Genera nuovo access token usando il refresh token
  async refreshToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token di refresh non fornito' });
      }

      // Qui dovresti implementare la logica per verificare il refresh token
      // Ad esempio, potresti cercarlo nella tabella sessions
      // Per ora, facciamo una verifica semplificata usando jwt
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        
        // Ottieni l'ID dell'utente dal token decodificato
        const userId = decoded.userId;
        
        // Ottieni i dati dell'utente
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'Utente non trovato' });
        }
        
        // Genera un nuovo access token
        const newAccessToken = generateToken(user);
        
        res.status(200).json({
          accessToken: newAccessToken
        });
      } catch (error) {
        return res.status(401).json({ message: 'Token di refresh non valido o scaduto' });
      }
    } catch (error) {
      console.error('Errore durante il refresh del token:', error);
      res.status(500).json({ message: 'Errore del server durante il refresh del token' });
    }
  }
}

// Importa dal middleware
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret_key_do_not_use_in_production';

// Esporta un'istanza del controller
export const authController = new AuthController();