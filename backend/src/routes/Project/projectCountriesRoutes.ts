import express from 'express';
import { getProjectCountriesCpi, upsertProjectCountryCpi } from '../../controllers/project/projectCountriesController';

const router = express.Router({ mergeParams: true });

// GET CPI values for all countries in a project
router.get('/', getProjectCountriesCpi);

// Upsert CPI for a specific country in a project
router.put('/:countryId', upsertProjectCountryCpi);

export default router;
