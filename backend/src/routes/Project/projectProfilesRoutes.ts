import { getOfficialProfileSalaries } from '../../controllers/project/projectProfilesController';
import { Router } from 'express';
import { addProjectProfile, getProjectProfiles, deleteProjectProfile, switchProjectProfile } from '../../controllers/project/projectProfilesController';
const router = Router();
// GET /project-profiles/:profile_id/salaries
router.get('/:profile_id/salaries', getOfficialProfileSalaries);
// DELETE /project-profiles
router.delete('/', deleteProjectProfile);

// POST /project-profiles
router.post('/', addProjectProfile);

// PUT /project-profiles/switch - cambia el perfil asociado sin tocar salarios
router.put('/switch', switchProjectProfile);

// GET /project-profiles/:project_id
router.get('/:project_id', getProjectProfiles);

export default router;
