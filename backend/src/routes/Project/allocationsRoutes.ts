import { Router } from 'express';
import { getProjectAllocations, getProjectAllocationsSummary } from '../../controllers/project/allocationsController';

const router = Router({ mergeParams: true });

router.get('/', getProjectAllocations);
router.get('/summary', getProjectAllocationsSummary);

export default router;
