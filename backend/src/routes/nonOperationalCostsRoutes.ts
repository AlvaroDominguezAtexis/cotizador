import { Router } from 'express';
import {
  getNonOperationalCosts,
  createNonOperationalCost,
  updateNonOperationalCost,
  deleteNonOperationalCost
} from '../controllers/project/nonOperationalCostsController';

const router = Router({ mergeParams: true });

router.get('/projects/:projectId/non-operational-costs', getNonOperationalCosts);
router.post('/projects/:projectId/non-operational-costs', createNonOperationalCost);
router.put('/projects/:projectId/non-operational-costs/:id', updateNonOperationalCost);
router.delete('/projects/:projectId/non-operational-costs/:id', deleteNonOperationalCost);

export default router;