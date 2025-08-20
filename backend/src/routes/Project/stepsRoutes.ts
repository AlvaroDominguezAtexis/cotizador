import { Router } from 'express';
import { getSteps, createStep, updateStep, deleteStep, getAnnualData, upsertAnnualData, deleteAnnualData, recalcSalaries } from '../../controllers/project/stepsController';

const router = Router({ mergeParams: true });

router.get('/', getSteps);              // GET steps for a deliverable
router.post('/', createStep);           // Create step
router.put('/:stepId', updateStep);     // Update step
router.delete('/:stepId', deleteStep);  // Delete step
// Annual data for a step
router.get('/:stepId/annual-data', getAnnualData);
router.put('/:stepId/annual-data/:year', upsertAnnualData);
router.delete('/:stepId/annual-data/:year', deleteAnnualData);
// Recalculate and persist salaries cost
router.post('/:stepId/recalc-salaries', recalcSalaries);

export default router;
