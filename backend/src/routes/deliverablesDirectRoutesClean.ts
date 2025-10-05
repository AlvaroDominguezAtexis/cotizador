import { Router } from 'express';
import { updateDeliverableCustomerUnitPrice } from '../controllers/project/deliverablesController';

const router = Router();

// /deliverables/:deliverableId/customer-unit-price
router.put('/:deliverableId/customer-unit-price', updateDeliverableCustomerUnitPrice);

export default router;