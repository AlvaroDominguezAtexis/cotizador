// backend/src/routes/Project/profilesRoutes.ts
import { Router } from 'express';
import { getProfiles, createProfile } from '../../controllers/project/profilesController';

const router = Router();

router.get('/', getProfiles);
router.post('/', createProfile);

export default router;
