import { Router } from 'express';

import { addProjectProfile, getProjectProfiles, deleteProjectProfile } from '../../controllers/project/projectProfilesController';
const router = Router();
// DELETE /project-profiles
router.delete('/', deleteProjectProfile);

// POST /project-profiles
router.post('/', addProjectProfile);

// GET /project-profiles/:project_id
router.get('/:project_id', getProjectProfiles);

export default router;
