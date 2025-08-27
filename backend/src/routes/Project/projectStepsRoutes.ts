import { Router } from 'express';
import { recalcProjectStepsCosts } from '../../controllers/project/stepsController';

const router = Router({ mergeParams: true });

router.post('/projects/:projectId/steps/recalc-costs', recalcProjectStepsCosts);

export default router;
