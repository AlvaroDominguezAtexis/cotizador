import { Router } from 'express';
import { getProjects, getProjectById, createProject, updateProject, deleteProject } from '../../controllers/project/projectsController';
import { recalcProjectDeliverablesMarginsYearly } from '../../controllers/project/deliverablesController';

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/recalc-margins-yearly', recalcProjectDeliverablesMarginsYearly);

export default router;