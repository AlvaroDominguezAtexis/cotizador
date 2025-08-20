import express from 'express';
import {
	getProjectCountriesCpi,
	upsertProjectCountryCpi,
	getProjectCountriesActivityRate,
	upsertProjectCountryActivityRate,
	getProjectCountriesNptRate,
	upsertProjectCountryNptRate,
	getProjectCountriesItCost,
	upsertProjectCountryItCost,
	getProjectCountriesPremisesCost,
	upsertProjectCountryPremisesCost,
	getProjectCountriesWorkingDays,
	upsertProjectCountryWorkingDays,
	getProjectCountriesMng,
	upsertProjectCountryMng,
		getProjectCountriesMarkup,
		upsertProjectCountryMarkup,
} from '../../controllers/project/projectCountriesController';

// Individual routers with mergeParams to inherit :projectId from mount path
export const projectCountriesCpiRouter = express.Router({ mergeParams: true });
projectCountriesCpiRouter.get('/', getProjectCountriesCpi);
projectCountriesCpiRouter.put('/:countryId', upsertProjectCountryCpi);

export const projectCountriesActivityRouter = express.Router({ mergeParams: true });
projectCountriesActivityRouter.get('/', getProjectCountriesActivityRate);
projectCountriesActivityRouter.put('/:countryId', upsertProjectCountryActivityRate);

export const projectCountriesNptRouter = express.Router({ mergeParams: true });
projectCountriesNptRouter.get('/', getProjectCountriesNptRate);
projectCountriesNptRouter.put('/:countryId', upsertProjectCountryNptRate);

export const projectCountriesItRouter = express.Router({ mergeParams: true });
projectCountriesItRouter.get('/', getProjectCountriesItCost);
projectCountriesItRouter.put('/:countryId', upsertProjectCountryItCost);

export const projectCountriesPremisesRouter = express.Router({ mergeParams: true });
projectCountriesPremisesRouter.get('/', getProjectCountriesPremisesCost);
projectCountriesPremisesRouter.put('/:countryId', upsertProjectCountryPremisesCost);

export const projectCountriesWorkingDaysRouter = express.Router({ mergeParams: true });
projectCountriesWorkingDaysRouter.get('/', getProjectCountriesWorkingDays);
projectCountriesWorkingDaysRouter.put('/:countryId', upsertProjectCountryWorkingDays);

export const projectCountriesMngRouter = express.Router({ mergeParams: true });
projectCountriesMngRouter.get('/', getProjectCountriesMng);
projectCountriesMngRouter.put('/:countryId', upsertProjectCountryMng);

export const projectCountriesMarkupRouter = express.Router({ mergeParams: true });
projectCountriesMarkupRouter.get('/', getProjectCountriesMarkup);
projectCountriesMarkupRouter.put('/:countryId', upsertProjectCountryMarkup);

// For backward compatibility, export CPI router as default
export default projectCountriesCpiRouter;
