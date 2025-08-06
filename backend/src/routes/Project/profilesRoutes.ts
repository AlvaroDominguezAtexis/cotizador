// backend/src/routes/Project/profilesRoutes.ts

import { Router } from 'express';
import { getProfiles, createProfile, deleteProfile, updateProfile } from '../../controllers/project/profilesController';
const router = Router();
router.put('/:id', updateProfile);
router.delete('/:id', deleteProfile);

router.get('/', getProfiles);
router.post('/', createProfile);

export default router;
