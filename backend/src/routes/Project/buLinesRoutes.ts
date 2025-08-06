import { Router } from 'express';
import { getBuLines } from '../../controllers/project/buLineController';

const router = Router();

router.get('/', getBuLines);

export default router;
