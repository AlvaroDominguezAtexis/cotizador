import { Router } from 'express';
import {
  getNonOperationalCosts,
  getNonOperationalCostById,
  createNonOperationalCost,
  updateNonOperationalCost,
  deleteNonOperationalCost
  , recomputeItCostsForProjectYear
} from '../controllers/project/nonOperationalCostsController';

const router = Router({ mergeParams: true });

router.get('/projects/:projectId/non-operational-costs', getNonOperationalCosts);
router.get('/projects/:projectId/non-operational-costs/:id', getNonOperationalCostById);
router.post('/projects/:projectId/non-operational-costs', createNonOperationalCost);
router.put('/projects/:projectId/non-operational-costs/:id', updateNonOperationalCost);
router.delete('/projects/:projectId/non-operational-costs/:id', deleteNonOperationalCost);
router.post('/projects/:projectId/it-costs/recompute', recomputeItCostsForProjectYear);

export default router;