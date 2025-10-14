import { Router } from 'express';
import { createProjectProfileSalary } from '../../controllers/project/projectProfileSalariesController';
import { getProjectProfileSalaries, updateProjectProfileSalary } from '../../controllers/project/projectProfileSalariesController';

const router = Router();

// Crear un registro de salario para un perfil de proyecto
router.post('/', createProjectProfileSalary);

// GET salaries for a project profile
router.get('/', getProjectProfileSalaries);

//PUT salaries for a project profile
router.put('/:id', updateProjectProfileSalary);
export default router;