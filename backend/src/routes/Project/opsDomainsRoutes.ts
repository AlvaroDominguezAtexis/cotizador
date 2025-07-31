import { Router } from 'express';
import { getOpsDomains } from '../../controllers/project/opsDomainController';

const router = Router();

router.get('/', getOpsDomains);

export default router;
