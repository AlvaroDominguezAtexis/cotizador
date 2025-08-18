import { Router } from 'express';
import { getProjects, getProjectById, createProject, updateProject, deleteProject } from '../../controllers/project/projectsController';

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;