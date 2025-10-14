import { Router } from 'express';
import { loginUser, logoutUser, getCurrentUser, registerUser } from '../controllers/authController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Rutas públicas
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Rutas protegidas
router.get('/me', requireAuth, getCurrentUser);
router.post('/register', requireAuth, requireRole(['admin']), registerUser);

export default router;