import { Request, Response } from 'express';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import Pool from '../db';

// Login de usuario
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Buscar usuario por email
    const userResult = await Pool.query(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    // Verificar contraseña
    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Crear nueva sesión
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await Pool.query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        sessionToken,
        expiresAt,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      ]
    );

    // Configurar cookie de sesión
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Logout de usuario
export const logoutUser = async (req: Request, res: Response) => {
  try {
    const sessionToken = req.cookies?.session_token;

    if (sessionToken) {
      // Eliminar sesión de la base de datos
      await Pool.query(
        'DELETE FROM user_sessions WHERE session_token = $1',
        [sessionToken]
      );
    }

    // Limpiar cookie
    res.clearCookie('session_token');
    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Verificar sesión actual
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

// Registro de nuevo usuario (opcional, para admins)
export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password, role = 'user' } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Verificar que el usuario actual es admin (si queremos restringir el registro)
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can create new users' });
    }

    // Verificar si el email ya existe
    const existingUser = await Pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash de la contraseña
    const hashedPassword = await argon2.hash(password);

    // Crear usuario
    const result = await Pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashedPassword, role]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Limpiar sesiones expiradas (función utilitaria)
export const cleanExpiredSessions = async () => {
  try {
    await Pool.query('SELECT clean_expired_sessions()');
    console.log('✅ Expired sessions cleaned');
  } catch (error) {
    console.error('Error cleaning expired sessions:', error);
  }
};