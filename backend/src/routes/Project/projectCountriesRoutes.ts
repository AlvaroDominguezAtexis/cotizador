import express from 'express';
import {
	getProjectCountriesCpi,
	upsertProjectCountryCpi,
	getProjectCountriesActivityRate,
	upsertProjectCountryActivityRate,
	getProjectCountriesNptRate,
	upsertProjectCountryNptRate,
	getProjectCountriesNonProductiveCost,
	upsertProjectCountryNonProductiveCost,
	getProjectCountriesItProductionSupport,
	upsertProjectCountryItProductionSupport,
	getProjectCountriesOperationalQualityCosts,
	upsertProjectCountryOperationalQualityCosts,
	getProjectCountriesOperationsManagementCosts,
	upsertProjectCountryOperationsManagementCosts,
	getProjectCountriesLeanManagementCosts,
	upsertProjectCountryLeanManagementCosts,
	getProjectCountriesItCost,
	upsertProjectCountryItCost,
	getProjectCountriesWorkingDays,
	upsertProjectCountryWorkingDays,
	getProjectCountriesHoursPerDay,
	upsertProjectCountryHoursPerDay,
	addProjectCountry,
	getProjectCountriesManagementSalary,
	upsertProjectCountryManagementSalary,
	getProjectCountriesMarkup,
		upsertProjectCountryMarkup,
		getProjectCountriesSocialContributionRate,
		upsertProjectCountrySocialContributionRate,
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

export const projectCountriesNonProductiveCostRouter = express.Router({ mergeParams: true });
projectCountriesNonProductiveCostRouter.get('/', getProjectCountriesNonProductiveCost);
projectCountriesNonProductiveCostRouter.put('/:countryId', upsertProjectCountryNonProductiveCost);

export const projectCountriesItProductionSupportRouter = express.Router({ mergeParams: true });
projectCountriesItProductionSupportRouter.get('/', getProjectCountriesItProductionSupport);
projectCountriesItProductionSupportRouter.put('/:countryId', upsertProjectCountryItProductionSupport);

export const projectCountriesOperationalQualityCostsRouter = express.Router({ mergeParams: true });
projectCountriesOperationalQualityCostsRouter.get('/', getProjectCountriesOperationalQualityCosts);
projectCountriesOperationalQualityCostsRouter.put('/:countryId', upsertProjectCountryOperationalQualityCosts);

export const projectCountriesOperationsManagementCostsRouter = express.Router({ mergeParams: true });
projectCountriesOperationsManagementCostsRouter.get('/', getProjectCountriesOperationsManagementCosts);
projectCountriesOperationsManagementCostsRouter.put('/:countryId', upsertProjectCountryOperationsManagementCosts);

export const projectCountriesLeanManagementCostsRouter = express.Router({ mergeParams: true });
projectCountriesLeanManagementCostsRouter.get('/', getProjectCountriesLeanManagementCosts);
projectCountriesLeanManagementCostsRouter.put('/:countryId', upsertProjectCountryLeanManagementCosts);

export const projectCountriesItRouter = express.Router({ mergeParams: true });
projectCountriesItRouter.get('/', getProjectCountriesItCost);
projectCountriesItRouter.put('/:countryId', upsertProjectCountryItCost);

// Premises routes removed: premises is now managed at city level

export const projectCountriesWorkingDaysRouter = express.Router({ mergeParams: true });
projectCountriesWorkingDaysRouter.get('/', getProjectCountriesWorkingDays);
projectCountriesWorkingDaysRouter.put('/:countryId', upsertProjectCountryWorkingDays);

export const projectCountriesHoursPerDayRouter = express.Router({ mergeParams: true });
projectCountriesHoursPerDayRouter.get('/', getProjectCountriesHoursPerDay);
projectCountriesHoursPerDayRouter.put('/:countryId', upsertProjectCountryHoursPerDay);

export const projectCountriesManagementRouter = express.Router({ mergeParams: true });

// Add a test route
projectCountriesManagementRouter.get('/test', (req, res) => {
  console.log('Test route hit');
  console.log('Params:', req.params);
  res.json({ message: 'Management salary router is working', params: req.params });
});

projectCountriesManagementRouter.get('/', getProjectCountriesManagementSalary);
projectCountriesManagementRouter.put('/:countryId', upsertProjectCountryManagementSalary);

export const projectCountriesMarkupRouter = express.Router({ mergeParams: true });
projectCountriesMarkupRouter.get('/', getProjectCountriesMarkup);
projectCountriesMarkupRouter.put('/:countryId', upsertProjectCountryMarkup);

export const projectCountriesSocialContributionRateRouter = express.Router({ mergeParams: true });
projectCountriesSocialContributionRateRouter.get('/', getProjectCountriesSocialContributionRate);
projectCountriesSocialContributionRateRouter.put('/:countryId', upsertProjectCountrySocialContributionRate);

// For backward compatibility, export CPI router as default
export default projectCountriesCpiRouter;
