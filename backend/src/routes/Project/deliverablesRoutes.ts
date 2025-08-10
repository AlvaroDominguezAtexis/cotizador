import { Router } from 'express';
import { getDeliverables, createDeliverable, updateDeliverable, deleteDeliverable } from '../../controllers/project/deliverablesController';

const router = Router({ mergeParams: true });

// /projects/:projectId/workpackages/:workPackageId/deliverables
router.get('/', getDeliverables);
router.post('/', createDeliverable);
router.put('/:id', updateDeliverable);
router.delete('/:id', deleteDeliverable);

export default router;
