import { Router } from 'express';
import { getOfficialProfileSalaries } from '../../controllers/project/officialProfileSalariesController';

const router = Router();

// GET /api/officialprofile-salaries
router.get('/', getOfficialProfileSalaries);

export default router;