import { Request, Response } from 'express';
import db from '../../db';

// Functions for managing project countries
export const getProjectCountriesManagementSalary = async (req: Request, res: Response) => {
  console.log('getProjectCountriesManagementSalary called');
  console.log('Request params:', req.params);
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    console.log('Executing query for projectId:', projectId);
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.management_yearly_salary
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    console.log('Query results:', rows);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesManagementSalary error:', e);
    console.error('Error stack:', (e as Error).stack);
    res.status(500).json({ error: 'Error al obtener salarios de Project Manager por país' });
  }
};

export const upsertProjectCountryManagementSalary = async (req: Request, res: Response) => {
  console.log('upsertProjectCountryManagementSalary called');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { management_yearly_salary } = req.body as { management_yearly_salary?: number | string | null };
  
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (management_yearly_salary == null || isNaN(Number(management_yearly_salary))) {
    return res.status(400).json({ error: 'management_yearly_salary numérico requerido' });
  }
  
  const salary = Number(management_yearly_salary);
  if (salary < 0) return res.status(400).json({ error: 'management_yearly_salary debe ser >= 0' });
  
  try {
    const q = `
      UPDATE project_countries 
      SET management_yearly_salary = $1
      WHERE project_id = $2 AND country_id = $3
      RETURNING project_id, country_id, management_yearly_salary
    `;
    const { rows } = await db.query(q, [salary, projectId, countryId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'País no encontrado en el proyecto' });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryManagementSalary error', e);
    res.status(500).json({ error: 'Error al actualizar salario de Project Manager' });
  }
};

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

// GET /projects/:projectId/countries-working-days
export const getProjectCountriesWorkingDays = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.working_days
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesWorkingDays error', e);
    res.status(500).json({ error: 'Error al obtener Working Days por país' });
  }
};

// GET /projects/:projectId/countries-hours-per-day
export const getProjectCountriesHoursPerDay = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.hours_per_day
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesHoursPerDay error', e);
    res.status(500).json({ error: 'Error al obtener Hours per Day por país' });
  }
};

// POST /projects/:projectId/countries
export const addProjectCountry = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const { countryId } = req.body as { countryId: string };
  
  if (!projectId || !countryId) {
    return res.status(400).json({ error: 'projectId y countryId requeridos' });
  }

  try {
    // First get the default management salary for the country
    const defaultQuery = `
      SELECT management_yearly_salary_by_default
      FROM countries
      WHERE id = $1
    `;
    const defaultResult = await db.query(defaultQuery, [countryId]);
    const defaultSalary = defaultResult.rows[0]?.management_yearly_salary_by_default;

    // Insert the country with the default management salary
    const q = `
      INSERT INTO project_countries (project_id, country_id, management_yearly_salary)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET management_yearly_salary = EXCLUDED.management_yearly_salary
      RETURNING project_id, country_id, management_yearly_salary
    `;
    const { rows } = await db.query(q, [projectId, countryId, defaultSalary]);
    res.json(rows[0]);
  } catch (e) {
    console.error('addProjectCountry error', e);
    res.status(500).json({ error: 'Error al agregar país al proyecto' });
  }
};



// GET /projects/:projectId/countries-markup
export const getProjectCountriesMarkup = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.markup
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesMarkup error', e);
    res.status(500).json({ error: 'Error al obtener Markup por país' });
  }
};

// PUT /projects/:projectId/countries-working-days/:countryId
export const upsertProjectCountryWorkingDays = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { working_days } = req.body as { working_days?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (working_days == null || isNaN(Number(working_days))) return res.status(400).json({ error: 'working_days numérico requerido' });
  const wd = Number(working_days);
  if (wd < 0) return res.status(400).json({ error: 'working_days debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, working_days)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET working_days = EXCLUDED.working_days
      RETURNING project_id, country_id, working_days
    `;
    const { rows } = await db.query(q, [projectId, countryId, wd]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryWorkingDays error', e);
    res.status(500).json({ error: 'Error al guardar Working Days' });
  }
};

// PUT /projects/:projectId/countries-hours-per-day/:countryId
export const upsertProjectCountryHoursPerDay = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { hours_per_day } = req.body as { hours_per_day?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (hours_per_day == null || isNaN(Number(hours_per_day))) return res.status(400).json({ error: 'hours_per_day numérico requerido' });
  const hpd = Number(hours_per_day);
  if (hpd < 0) return res.status(400).json({ error: 'hours_per_day debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, hours_per_day)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET hours_per_day = EXCLUDED.hours_per_day
      RETURNING project_id, country_id, hours_per_day
    `;
    const { rows } = await db.query(q, [projectId, countryId, hpd]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryHoursPerDay error', e);
    res.status(500).json({ error: 'Error al guardar Hours per Day' });
  }
};

// PUT /projects/:projectId/countries-mng/:countryId
export const upsertProjectCountryMng = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { mng } = req.body as { mng?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (mng == null || isNaN(Number(mng))) return res.status(400).json({ error: 'mng numérico requerido' });
  const mngNum = Number(mng);
  if (mngNum < 0) return res.status(400).json({ error: 'mng debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, mng)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET mng = EXCLUDED.mng
      RETURNING project_id, country_id, mng
    `;
    const { rows } = await db.query(q, [projectId, countryId, mngNum]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryMng error', e);
    res.status(500).json({ error: 'Error al guardar Mng' });
  }
};

// GET /projects/:projectId/countries-social-contribution-rate
export const getProjectCountriesSocialContributionRate = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.social_contribution_rate
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesSocialContributionRate error', e);
    res.status(500).json({ error: 'Error al obtener Social Contribution Rate por país' });
  }
};

// PUT /projects/:projectId/countries-social-contribution-rate/:countryId
export const upsertProjectCountrySocialContributionRate = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { social_contribution_rate } = req.body as { social_contribution_rate?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (social_contribution_rate == null || isNaN(Number(social_contribution_rate))) return res.status(400).json({ error: 'social_contribution_rate numérico requerido' });
  const scr = Number(social_contribution_rate);
  if (scr < 0) return res.status(400).json({ error: 'social_contribution_rate debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, social_contribution_rate)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET social_contribution_rate = EXCLUDED.social_contribution_rate
      RETURNING project_id, country_id, social_contribution_rate
    `;
    const { rows } = await db.query(q, [projectId, countryId, scr]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountrySocialContributionRate error', e);
    res.status(500).json({ error: 'Error al guardar Social Contribution Rate' });
  }
};

// PUT /projects/:projectId/countries-markup/:countryId
export const upsertProjectCountryMarkup = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { markup } = req.body as { markup?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (markup == null || isNaN(Number(markup))) return res.status(400).json({ error: 'markup numérico requerido' });
  const mk = Number(markup);
  if (mk < 0) return res.status(400).json({ error: 'markup debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, markup)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET markup = EXCLUDED.markup
      RETURNING project_id, country_id, markup
    `;
    const { rows } = await db.query(q, [projectId, countryId, mk]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryMarkup error', e);
    res.status(500).json({ error: 'Error al guardar Markup' });
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

// GET /projects/:projectId/countries-npt-rate
export const getProjectCountriesNptRate = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.npt_rate
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesNptRate error', e);
    res.status(500).json({ error: 'Error al obtener NPT Rate por país' });
  }
};

// PUT /projects/:projectId/countries-npt-rate/:countryId
export const upsertProjectCountryNptRate = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { npt_rate } = req.body as { npt_rate?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (npt_rate == null || isNaN(Number(npt_rate))) return res.status(400).json({ error: 'npt_rate numérico requerido' });
  const npt = Number(npt_rate);
  if (npt < 0) return res.status(400).json({ error: 'npt_rate debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, npt_rate)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET npt_rate = EXCLUDED.npt_rate
      RETURNING project_id, country_id, npt_rate
    `;
    const { rows } = await db.query(q, [projectId, countryId, npt]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryNptRate error', e);
    res.status(500).json({ error: 'Error al guardar NPT Rate' });
  }
};

// GET /projects/:projectId/countries-it-cost
export const getProjectCountriesItCost = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.it_cost
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesItCost error', e);
    res.status(500).json({ error: 'Error al obtener IT Cost por país' });
  }
};

// PUT /projects/:projectId/countries-it-cost/:countryId
export const upsertProjectCountryItCost = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { it_cost } = req.body as { it_cost?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (it_cost == null || isNaN(Number(it_cost))) return res.status(400).json({ error: 'it_cost numérico requerido' });
  const it = Number(it_cost);
  if (it < 0) return res.status(400).json({ error: 'it_cost debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, it_cost)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET it_cost = EXCLUDED.it_cost
      RETURNING project_id, country_id, it_cost
    `;
    const { rows } = await db.query(q, [projectId, countryId, it]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryItCost error', e);
    res.status(500).json({ error: 'Error al guardar IT Cost' });
  }
};

// GET /projects/:projectId/countries-premises-cost
export const getProjectCountriesPremisesCost = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.premises_cost
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesPremisesCost error', e);
    res.status(500).json({ error: 'Error al obtener Premises Cost por país' });
  }
};

// PUT /projects/:projectId/countries-premises-cost/:countryId
export const upsertProjectCountryPremisesCost = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { premises_cost } = req.body as { premises_cost?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (premises_cost == null || isNaN(Number(premises_cost))) return res.status(400).json({ error: 'premises_cost numérico requerido' });
  const pc = Number(premises_cost);
  if (pc < 0) return res.status(400).json({ error: 'premises_cost debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, premises_cost)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET premises_cost = EXCLUDED.premises_cost
      RETURNING project_id, country_id, premises_cost
    `;
    const { rows } = await db.query(q, [projectId, countryId, pc]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryPremisesCost error', e);
    res.status(500).json({ error: 'Error al guardar Premises Cost' });
  }
};
// GET /projects/:projectId/countries-activity-rate
export const getProjectCountriesActivityRate = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.activity_rate
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesActivityRate error', e);
    res.status(500).json({ error: 'Error al obtener Activity Rate por país' });
  }
};

// PUT /projects/:projectId/countries-activity-rate/:countryId
export const upsertProjectCountryActivityRate = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { activity_rate } = req.body as { activity_rate?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (activity_rate == null || isNaN(Number(activity_rate))) return res.status(400).json({ error: 'activity_rate numérico requerido' });
  const arNum = Number(activity_rate);
  if (arNum < 0) return res.status(400).json({ error: 'activity_rate debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, activity_rate)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET activity_rate = EXCLUDED.activity_rate
      RETURNING project_id, country_id, activity_rate
    `;
    const { rows } = await db.query(q, [projectId, countryId, arNum]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryActivityRate error', e);
    res.status(500).json({ error: 'Error al guardar Activity Rate' });
  }
};
