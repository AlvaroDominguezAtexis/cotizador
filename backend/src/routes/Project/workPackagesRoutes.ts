import { Router } from 'express';
import { getWorkPackages, createWorkPackage, updateWorkPackage, deleteWorkPackage } from '../../controllers/project/workPackagesController';

const router = Router({ mergeParams: true });

// Rutas anidadas bajo /projects/:projectId/workpackages
router.get('/', getWorkPackages);
router.post('/', createWorkPackage);
router.put('/:id', updateWorkPackage);
router.delete('/:id', deleteWorkPackage);

export default router;
