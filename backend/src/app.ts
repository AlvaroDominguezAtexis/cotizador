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
import nonOperationalCostsRoutes from './routes/nonOperationalCostsRoutes';
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
// Workpackages nested under projects
app.use('/projects/:projectId/workpackages', workPackagesRoutes);
app.use('/projects/:projectId/workpackages/:workPackageId/deliverables', deliverablesRoutes);
app.use('/projects/:projectId/workpackages/:workPackageId/deliverables/:deliverableId/steps', stepsRoutes);
app.use('/projects/:projectId/allocations', allocationsRoutes);

export default app;