import { Router } from 'express';
import { getBusinessUnits } from '../../controllers/project/businessUnitsController';

const router = Router();

router.get('/', getBusinessUnits);

export default router;
