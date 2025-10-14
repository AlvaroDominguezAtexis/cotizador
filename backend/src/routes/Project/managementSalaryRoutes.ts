import { Router } from 'express';
import { getProjectCountriesManagementSalary, updateProjectCountriesManagementSalary } from '../../controllers/project/managementSalaryController';

const router = Router();



router.get('/projects/:projectId/countries-management-salary', getProjectCountriesManagementSalary);
router.put('/projects/:projectId/countries-management-salary', updateProjectCountriesManagementSalary);

export default router;
