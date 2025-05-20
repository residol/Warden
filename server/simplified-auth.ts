import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from './simplified-storage';
import { generateToken, generateRefreshToken } from './middleware/auth-middleware';
import { InsertUser, userRoleEnum } from '@shared/schema';

// Controller per la gestione dell'autenticazione (versione semplificata)
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
        isVerified: false
      } as InsertUser);

      // Genera token JWT
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Crea un oggetto senza la password
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

      // Crea un oggetto senza la password
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
  async getUserProfile(req: Request, res: Response) {
    try {
      // L'id dell'utente è disponibile grazie al middleware isAuthenticated
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Utente non autenticato' });
      }

      // Ottieni i dati dell'utente
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Utente non trovato' });
      }

      // Crea un oggetto senza la password
      const { password: _, ...userWithoutPassword } = user;

      res.status(200).json({
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Errore durante il recupero del profilo:', error);
      res.status(500).json({ message: 'Errore del server durante il recupero del profilo' });
    }
  }

  // Genera nuovo access token usando il refresh token
  async refreshToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token di refresh non fornito' });
      }

      // Verifica il refresh token (Nota: questa è una versione semplificata)
      // In produzione, verifica nella tabella sessions se il token è valido
      // Per ora gestiamo solo la generazione di un nuovo token
      
      // Estrai l'id dell'utente dal token (usando JWT)
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {userId: number};
        const userId = decoded.userId;
        
        // Ottieni i dati dell'utente
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: 'Utente non trovato' });
        }
        
        // Genera nuovo access token
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
import { JwtPayload } from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret_key_do_not_use_in_production';

// Esporta un'istanza del controller
export const authController = new AuthController();