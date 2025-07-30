import { Router } from 'express';
import { getCountries } from '../../controllers/project/countriesController';

const router = Router();

router.get('/', getCountries);

export default router;
