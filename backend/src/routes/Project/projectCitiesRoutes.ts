import { Router } from 'express';
import { getCountryCities } from '../../controllers/project/citiesController';

const router = Router();

// GET /countries/:countryId/cities
router.get('/countries/:countryId/cities', getCountryCities);

export default router;
