import { Router } from 'express';import { Router } from 'express';

import { getDeliverableOperationalTO, updateDeliverableManualUnitPrice, updateDeliverableCustomerUnitPrice } from '../controllers/project/deliverablesController';import { getDeliverableOperationalTO, updateDeliverableManualUnitPrice } from '../controllers/project/deliverablesController';



const router = Router();const router = Router();



// /deliverables/:deliverableId/operational-to// /deliverables/:deliverableId/operational-to

router.get('/:deliverableId/operational-to', getDeliverableOperationalTO);router.get('/:deliverableId/operational-to', getDeliverableOperationalTO);

// /deliverables/:deliverableId/manual-unit-price// /deliverables/:deliverableId/manual-unit-price

router.put('/:deliverableId/manual-unit-price', updateDeliverableManualUnitPrice);router.put('/:deliverableId/manual-unit-price', updateDeliverableManualUnitPrice);

// /deliverables/:deliverableId/customer-unit-price

router.put('/:deliverableId/customer-unit-price', updateDeliverableCustomerUnitPrice);export default router;

export default router;