import { Router } from 'express';
import { getProjects, getProjectById, createProject, updateProject, deleteProject, clearProjectWorkPackages } from '../../controllers/project/projectsController';
import { recalcProjectDeliverablesMarginsYearly, getProjectOperationalRevenue, getProjectHourlyPrice, getProjectDeliverablesCosts, getProjectDeliverablesCostsBreakdown, diagnoseBulkMarginData, testBulkMarginCalculation, getProjectCustomerUnitPrices } from '../../controllers/project/deliverablesController';

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.delete('/:id/clear-workpackages', clearProjectWorkPackages);
router.post('/:id/recalc-margins-yearly', recalcProjectDeliverablesMarginsYearly);
router.get('/:id/operational-revenue', getProjectOperationalRevenue);
router.get('/:id/hourly-price', getProjectHourlyPrice);
router.get('/:id/deliverables-costs', getProjectDeliverablesCosts);
router.get('/:id/deliverables-costs-breakdown', getProjectDeliverablesCostsBreakdown);
router.get('/:id/diagnose-margin-data', diagnoseBulkMarginData);
router.get('/:id/test-margins', testBulkMarginCalculation);
router.get('/:id/customer-unit-prices', getProjectCustomerUnitPrices);

export default router;