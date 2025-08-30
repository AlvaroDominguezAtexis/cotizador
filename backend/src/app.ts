import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import projectsRoutes from './routes/Project/projectsRoutes';
import countriesRoutes from './routes/Project/countriesRoutes';
import profilesRoutes from './routes/Project/profilesRoutes';
import businessUnitsRoutes from './routes/Project/businessUnitsRoutes';
import opsDomainsRoutes from './routes/Project/opsDomainsRoutes';
import buLinesRoutes from './routes/Project/buLinesRoutes';
import clientsRoutes from './routes/Project/clientsRoutes';
import projectProfilesRoutes from './routes/Project/projectProfilesRoutes';
import projectProfileSalariesRoutes from './routes/Project/projectProfileSalariesRoutes';
import projectCountriesRoutes, {
	projectCountriesActivityRouter,
	projectCountriesNptRouter,
	projectCountriesItRouter,
	projectCountriesWorkingDaysRouter,
	projectCountriesHoursPerDayRouter,
	projectCountriesManagementRouter,
	projectCountriesMarkupRouter,
	projectCountriesSocialContributionRateRouter,
 	projectCountriesNonProductiveCostRouter,
	projectCountriesItProductionSupportRouter,
	projectCountriesOperationalQualityCostsRouter,
	projectCountriesOperationsManagementCostsRouter,
	projectCountriesLeanManagementCostsRouter,
} from './routes/Project/projectCountriesRoutes';
import projectCitiesRoutes from './routes/Project/projectCitiesRoutes';
import nonOperationalCostsRoutes from './routes/nonOperationalCostsRoutes';
import projectStepsRoutes from './routes/Project/projectStepsRoutes';
import workPackagesRoutes from './routes/Project/workPackagesRoutes';
import deliverablesRoutes from './routes/Project/deliverablesRoutes';
import stepsRoutes from './routes/Project/stepsRoutes';
import allocationsRoutes from './routes/Project/allocationsRoutes';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Backend Cotizador funcionando'));

app.use('/projects', projectsRoutes);
app.use('/countries', countriesRoutes);
app.use('/profiles', profilesRoutes);
app.use('/business-units', businessUnitsRoutes);
app.use('/ops-domains', opsDomainsRoutes);
app.use('/bu-lines', buLinesRoutes);
app.use('/clients', clientsRoutes);
app.use('/project-profile-salaries', projectProfileSalariesRoutes);
app.use('/project-profiles', projectProfilesRoutes);
// Non operational costs endpoints mounted without extra prefix so they match /projects/:projectId/non-operational-costs
app.use('', nonOperationalCostsRoutes);
// Project-wide steps routes (like recalc)
app.use('', projectStepsRoutes);
// Workpackages nested under projects
app.use('/projects/:projectId/workpackages', workPackagesRoutes);
app.use('/projects/:projectId/workpackages/:workPackageId/deliverables', deliverablesRoutes);
app.use('/projects/:projectId/workpackages/:workPackageId/deliverables/:deliverableId/steps', stepsRoutes);
app.use('/projects/:projectId/allocations', allocationsRoutes);
// Project countries CPI
app.use('/projects/:projectId/countries-cpi', projectCountriesRoutes);
app.use('/projects/:projectId/countries-activity-rate', projectCountriesActivityRouter);
app.use('/projects/:projectId/countries-npt-rate', projectCountriesNptRouter);
app.use('/projects/:projectId/countries-it-cost', projectCountriesItRouter);
app.use('/projects/:projectId/countries-working-days', projectCountriesWorkingDaysRouter);
app.use('/projects/:projectId/countries-hours-per-day', projectCountriesHoursPerDayRouter);
app.use('/projects/:projectId/countries-non-productive-cost', projectCountriesNonProductiveCostRouter);
app.use('/projects/:projectId/countries-it-production-support', projectCountriesItProductionSupportRouter);
app.use('/projects/:projectId/countries-operational-quality-costs', projectCountriesOperationalQualityCostsRouter);
	app.use('/projects/:projectId/countries-operations-management-costs', projectCountriesOperationsManagementCostsRouter);
	app.use('/projects/:projectId/countries-lean-management-costs', projectCountriesLeanManagementCostsRouter);
// Debug route registration
console.log('Registering management salary routes at /projects/:projectId/countries-management');
app.use('/projects/:projectId/countries-management', projectCountriesManagementRouter);
app.use('/projects/:projectId/countries-markup', projectCountriesMarkupRouter);
app.use('/projects/:projectId/countries-social-contribution-rate', projectCountriesSocialContributionRateRouter);

// Cities endpoint (used by frontend to list cities per country)
app.use('', projectCitiesRoutes);

export default app;