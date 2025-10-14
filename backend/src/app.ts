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
import officialProfileSalariesRoutes from './routes/Project/officialProfileSalariesRoutes';
import projectCountriesRoutes, {
	projectCountriesActivityRouter,
	projectCountriesNptRouter,
	projectCountriesItRouter,
	projectCountriesPremisesRouter,
	projectCountriesWorkingDaysRouter,
	projectCountriesHoursPerDayRouter,
	projectCountriesHolidaysRouter,
	projectCountriesTotalDaysRouter,
	projectCountriesMngRouter,
	projectCountriesMarkupRouter,
	projectCountriesSocialContributionRateRouter,
} from './routes/Project/projectCountriesRoutes';
import projectCitiesRoutes from './routes/Project/projectCitiesRoutes';
import managementSalaryRoutes from './routes/Project/managementSalaryRoutes';
import nonOperationalCostsRoutes from './routes/nonOperationalCostsRoutes';
import projectStepsRoutes from './routes/Project/projectStepsRoutes';
import workPackagesRoutes from './routes/Project/workPackagesRoutes';
import deliverablesRoutes from './routes/Project/deliverablesRoutes';
import stepsRoutes from './routes/Project/stepsRoutes';
import allocationsRoutes from './routes/Project/allocationsRoutes';
import deliverablesDirectRoutes from './routes/deliverablesDirectRoutesClean';
import authRoutes from './routes/authRoutes';
import { requireAuth } from './middleware/auth';
import cookieParser from 'cookie-parser';

dotenv.config();
const app = express();

app.use(cors({
  credentials: true,
  origin: ['http://localhost:3000']
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => res.send('Backend Cotizador funcionando'));



// Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes);

// Rutas protegidas (requieren autenticación)
app.use('/api/projects', requireAuth, projectsRoutes);
app.use('/api/countries', requireAuth, countriesRoutes);
app.use('/api/profiles', requireAuth, profilesRoutes);
app.use('/api/business-units', requireAuth, businessUnitsRoutes);
app.use('/api/ops-domains', requireAuth, opsDomainsRoutes);
app.use('/api/bu-lines', requireAuth, buLinesRoutes);
app.use('/api/clients', requireAuth, clientsRoutes);
app.use('/api/project-profile-salaries', requireAuth, projectProfileSalariesRoutes);
app.use('/api/project-profiles', requireAuth, projectProfilesRoutes);
app.use('/api/officialprofile-salaries', requireAuth, officialProfileSalariesRoutes);
// Non operational costs endpoints mounted without extra prefix so they match /api/projects/:projectId/non-operational-costs
app.use('/api', requireAuth, nonOperationalCostsRoutes);
// Project-wide steps routes (like recalc)
app.use('/api', requireAuth, projectStepsRoutes);
// Workpackages nested under projects
app.use('/api/projects/:projectId/workpackages', requireAuth, workPackagesRoutes);
app.use('/api/projects/:projectId/workpackages/:workPackageId/deliverables', requireAuth, deliverablesRoutes);
app.use('/api/projects/:projectId/workpackages/:workPackageId/deliverables/:deliverableId/steps', requireAuth, stepsRoutes);
app.use('/api/projects/:projectId/allocations', requireAuth, allocationsRoutes);
// Direct deliverables routes (not nested under project/workpackage)
app.use('/api/deliverables', requireAuth, deliverablesDirectRoutes);
// Project countries CPI
app.use('/api/projects/:projectId/countries-cpi', requireAuth, projectCountriesRoutes);
app.use('/api/projects/:projectId/countries-activity-rate', requireAuth, projectCountriesActivityRouter);
app.use('/api/projects/:projectId/countries-npt-rate', requireAuth, projectCountriesNptRouter);
app.use('/api/projects/:projectId/countries-it-cost', requireAuth, projectCountriesItRouter);
app.use('/api/projects/:projectId/countries-premises-rate', requireAuth, projectCountriesPremisesRouter);
app.use('/api/projects/:projectId/countries-working-days', requireAuth, projectCountriesWorkingDaysRouter);
app.use('/api/projects/:projectId/countries-hours-per-day', requireAuth, projectCountriesHoursPerDayRouter);
app.use('/api/projects/:projectId/countries-holidays', requireAuth, projectCountriesHolidaysRouter);
app.use('/api/projects/:projectId/countries-total-days', requireAuth, projectCountriesTotalDaysRouter);

// Management Salary routes (must be before generic /api routes)
app.use('/api', requireAuth, managementSalaryRoutes);

app.use('/api/projects/:projectId/countries-mng', requireAuth, projectCountriesMngRouter);
app.use('/api/projects/:projectId/countries-markup', requireAuth, projectCountriesMarkupRouter);
app.use('/api/projects/:projectId/countries-social-contribution-rate', requireAuth, projectCountriesSocialContributionRateRouter);

// Cities endpoint (used by frontend to list cities per country)
app.use('/api', projectCitiesRoutes);

export default app;