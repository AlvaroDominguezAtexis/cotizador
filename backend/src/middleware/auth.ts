import { Request, Response, NextFunction } from 'express';
import Pool from '../db';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

// Middleware para verificar autenticación
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.session_token;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    // Verificar sesión en base de datos
    const sessionResult = await Pool.query(`
      SELECT s.user_id, u.id, u.name, u.email, u.role, u.is_active
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `, [sessionToken]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = sessionResult.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is disabled' });
    }

    // Adjuntar información del usuario al request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware para verificar roles específicos
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware opcional de autenticación (no bloquea si no hay sesión)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.session_token;
    
    if (sessionToken) {
      const sessionResult = await Pool.query(`
        SELECT s.user_id, u.id, u.name, u.email, u.role, u.is_active
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_token = $1 AND s.expires_at > NOW()
      `, [sessionToken]);

      if (sessionResult.rows.length > 0 && sessionResult.rows[0].is_active) {
        const user = sessionResult.rows[0];
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};