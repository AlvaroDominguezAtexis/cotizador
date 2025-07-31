import { Router } from 'express';
import { getClients } from '../../controllers/project/clientsController';

const router = Router();

router.get('/', getClients);

export default router;
