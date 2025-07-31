import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import projectsRoutes from './routes/Project/projectsRoutes';
import countriesRoutes from './routes/Project/countriesRoutes';
import businessUnitsRoutes from './routes/Project/businessUnitsRoutes';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Backend Cotizador funcionando'));



app.use('/projects', projectsRoutes);
app.use('/countries', countriesRoutes);
app.use('/business-units', businessUnitsRoutes);

export default app;