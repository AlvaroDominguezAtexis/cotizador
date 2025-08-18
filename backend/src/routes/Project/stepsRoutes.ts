import { Router } from 'express';
import { getSteps, createStep, updateStep, deleteStep } from '../../controllers/project/stepsController';

const router = Router({ mergeParams: true });

router.get('/', getSteps);              // GET steps for a deliverable
router.post('/', createStep);           // Create step
router.put('/:stepId', updateStep);     // Update step
router.delete('/:stepId', deleteStep);  // Delete step

export default router;
