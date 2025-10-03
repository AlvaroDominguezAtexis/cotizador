import { Router } from 'express';
import { getWorkPackages, createWorkPackage, updateWorkPackage, deleteWorkPackage, createTimeAndMaterialWorkPackage, getTimeAndMaterialWorkPackage, updateTimeAndMaterialStep, deleteStep } from '../../controllers/project/workPackagesController';

const router = Router({ mergeParams: true });

// Rutas anidadas bajo /projects/:projectId/workpackages
router.get('/', getWorkPackages);
router.post('/', createWorkPackage);
router.get('/time-and-material', getTimeAndMaterialWorkPackage); // Nueva ruta GET
router.post('/time-and-material', createTimeAndMaterialWorkPackage); // Nueva ruta POST
router.put('/:id', updateWorkPackage);
router.delete('/:id', deleteWorkPackage);
router.put('/:workpackageId/steps/:stepId/time-and-material', updateTimeAndMaterialStep); // Actualizar step Time & Material
router.delete('/:workpackageId/steps/:stepId', deleteStep); // Eliminar step individual

export default router;
