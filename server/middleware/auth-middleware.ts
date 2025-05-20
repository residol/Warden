import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { User } from '@shared/schema';

// Controlla che JWT_SECRET sia definito
if (!process.env.JWT_SECRET) {
  console.warn('ATTENZIONE: JWT_SECRET non è definito. Verrà utilizzato un valore casuale temporaneo, ma i token JWT non saranno persistenti tra i riavvii.');
}

// Usa JWT_SECRET dall'ambiente o genera un valore casuale temporaneo
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret_key_do_not_use_in_production';

// Interfaccia per i dati dell'utente nel token JWT
interface JwtPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
}

// Middleware per verificare che l'utente sia autenticato
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Accesso non autorizzato. Token non fornito' });
    }

    // Estrai il token
    const token = authHeader.split(' ')[1];

    // Verifica il token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Aggiungi i dati dell'utente alla richiesta
    req.user = decoded;
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // Continua con la richiesta
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Accesso non autorizzato. Token non valido' });
  }
};

// Middleware per verificare che l'utente abbia il ruolo richiesto
export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Verifica che l'utente sia autenticato
    if (!req.userId || !req.userRole) {
      return res.status(401).json({ message: 'Accesso non autorizzato' });
    }

    // Verifica che l'utente abbia uno dei ruoli richiesti
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Accesso negato. Permessi insufficienti' });
    }

    // Continua con la richiesta
    next();
  };
};

// Estendi l'interfaccia Request di Express per includere i dati dell'utente
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      userId?: number;
      userRole?: string;
    }
  }
}

// Funzione per generare un token JWT
export const generateToken = (user: { id: number; username: string; email: string; role: string }): string => {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

// Funzione per generare un refresh token (con scadenza più lunga)
export const generateRefreshToken = (user: { id: number; username: string; email: string; role: string }): string => {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};