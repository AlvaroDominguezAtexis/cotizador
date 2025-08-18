import { Request, Response } from 'express';
import db from '../../db';

// GET /projects/:projectId/countries-cpi
export const getProjectCountriesCpi = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.cpi
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesCpi error', e);
    res.status(500).json({ error: 'Error al obtener CPI por país' });
  }
};

// PUT /projects/:projectId/countries-cpi/:countryId
export const upsertProjectCountryCpi = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { cpi } = req.body as { cpi?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (cpi == null || isNaN(Number(cpi))) return res.status(400).json({ error: 'cpi numérico requerido' });
  const cpiNum = Number(cpi);
  if (cpiNum < 0) return res.status(400).json({ error: 'cpi debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, cpi)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET cpi = EXCLUDED.cpi
      RETURNING project_id, country_id, cpi
    `;
    const { rows } = await db.query(q, [projectId, countryId, cpiNum]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryCpi error', e);
    res.status(500).json({ error: 'Error al guardar CPI' });
  }
};
