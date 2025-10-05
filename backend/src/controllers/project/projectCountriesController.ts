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
    // Get all default values for the country
    const defaultQuery = `
      SELECT 
        management_yearly_salary_by_default,
        cpi_by_default,
        activity_rate_by_default,
        npt_rate_by_default,
        it_cost_by_default,
        holidays_by_default,
        total_days_by_default,
        hours_per_day_by_default,
        mng_by_default,
        markup_by_default,
        social_contribution_rate_by_default,
        premises_rate_by_default
      FROM countries
      WHERE id = $1
    `;
    const defaultResult = await db.query(defaultQuery, [countryId]);
    const defaults = defaultResult.rows[0];

    if (!defaults) {
      return res.status(404).json({ error: 'País no encontrado' });
    }

    // Calculate working_days (total_days - holidays), max 216 for Spain (id = 1)
    const totalDays = defaults.total_days_by_default || 0;
    const holidays = defaults.holidays_by_default || 0;
    let workingDays = totalDays - holidays;
    
    // Apply Spain limit (country id = 1)
    if (parseInt(countryId) === 1 && workingDays > 216) {
      workingDays = 216;
    }

    // Insert the country with all default values
    const q = `
      INSERT INTO project_countries (
        project_id, 
        country_id, 
        management_yearly_salary,
        cpi,
        activity_rate,
        npt_rate,
        it_cost,
        holidays,
        total_days,
        working_days,
        hours_per_day,
        mng,
        markup,
        social_contribution_rate,
        premises_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET 
        management_yearly_salary = EXCLUDED.management_yearly_salary,
        cpi = EXCLUDED.cpi,
        activity_rate = EXCLUDED.activity_rate,
        npt_rate = EXCLUDED.npt_rate,
        it_cost = EXCLUDED.it_cost,
        holidays = EXCLUDED.holidays,
        total_days = EXCLUDED.total_days,
        working_days = EXCLUDED.working_days,
        hours_per_day = EXCLUDED.hours_per_day,
        mng = EXCLUDED.mng,
        markup = EXCLUDED.markup,
        social_contribution_rate = EXCLUDED.social_contribution_rate,
        premises_rate = EXCLUDED.premises_rate
      RETURNING *
    `;
    const { rows } = await db.query(q, [
      projectId,
      countryId,
      defaults.management_yearly_salary_by_default,
      defaults.cpi_by_default,
      defaults.activity_rate_by_default,
      defaults.npt_rate_by_default,
      defaults.it_cost_by_default,
      defaults.holidays_by_default,
      defaults.total_days_by_default,
      workingDays,
      defaults.hours_per_day_by_default,
      defaults.mng_by_default,
      defaults.markup_by_default,
      defaults.social_contribution_rate_by_default,
      defaults.premises_rate_by_default,
    ]);
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
// Working days is now a calculated field (total_days - holidays), not directly editable
export const upsertProjectCountryWorkingDays = async (req: Request, res: Response) => {
  return res.status(400).json({ 
    error: 'working_days es un campo calculado (total_days - holidays) y no puede editarse directamente. Use holidays o total_days.' 
  });
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

// GET /projects/:projectId/countries-holidays
export const getProjectCountriesHolidays = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.holidays
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesHolidays error', e);
    res.status(500).json({ error: 'Error al obtener Holidays por país' });
  }
};

// PUT /projects/:projectId/countries-holidays/:countryId
export const upsertProjectCountryHolidays = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { holidays } = req.body as { holidays?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (holidays == null || isNaN(Number(holidays))) return res.status(400).json({ error: 'holidays numérico requerido' });
  const h = Number(holidays);
  if (h < 0) return res.status(400).json({ error: 'holidays debe ser >= 0' });
  
  try {
    // First, get total_days for recalculation
    const totalDaysQuery = `SELECT total_days FROM project_countries WHERE project_id = $1 AND country_id = $2`;
    const totalDaysResult = await db.query(totalDaysQuery, [projectId, countryId]);
    const totalDays = totalDaysResult.rows[0]?.total_days || 0;
    
    // Calculate new working_days (total_days - holidays), max 216 for Spain (id = 1)
    let workingDays = totalDays - h;
    if (parseInt(countryId) === 1 && workingDays > 216) {
      workingDays = 216;
    }

    const q = `
      INSERT INTO project_countries (project_id, country_id, holidays, working_days)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET holidays = EXCLUDED.holidays, working_days = EXCLUDED.working_days
      RETURNING project_id, country_id, holidays, working_days
    `;
    const { rows } = await db.query(q, [projectId, countryId, h, workingDays]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryHolidays error', e);
    res.status(500).json({ error: 'Error al guardar Holidays' });
  }
};

// GET /projects/:projectId/countries-total-days
export const getProjectCountriesTotalDays = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.total_days
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesTotalDays error', e);
    res.status(500).json({ error: 'Error al obtener Total Days por país' });
  }
};

// PUT /projects/:projectId/countries-total-days/:countryId
export const upsertProjectCountryTotalDays = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { total_days } = req.body as { total_days?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (total_days == null || isNaN(Number(total_days))) return res.status(400).json({ error: 'total_days numérico requerido' });
  const td = Number(total_days);
  if (td < 0) return res.status(400).json({ error: 'total_days debe ser >= 0' });
  
  try {
    // First, get holidays for recalculation
    const holidaysQuery = `SELECT holidays FROM project_countries WHERE project_id = $1 AND country_id = $2`;
    const holidaysResult = await db.query(holidaysQuery, [projectId, countryId]);
    const holidays = holidaysResult.rows[0]?.holidays || 0;
    
    // Calculate new working_days (total_days - holidays), max 216 for Spain (id = 1)
    let workingDays = td - holidays;
    if (parseInt(countryId) === 1 && workingDays > 216) {
      workingDays = 216;
    }

    const q = `
      INSERT INTO project_countries (project_id, country_id, total_days, working_days)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET total_days = EXCLUDED.total_days, working_days = EXCLUDED.working_days
      RETURNING project_id, country_id, total_days, working_days
    `;
    const { rows } = await db.query(q, [projectId, countryId, td, workingDays]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryTotalDays error', e);
    res.status(500).json({ error: 'Error al guardar Total Days' });
  }
};

// PUT /projects/:projectId/countries-mng/:countryId
// %Mng editing removed from Advance Settings; mng is still stored and used internally for calculations.

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

// GET /projects/:projectId/countries-premises-rate
export const getProjectCountriesPremisesRate = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.premises_rate
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesPremisesRate error', e);
    res.status(500).json({ error: 'Error al obtener Premises Rate por país' });
  }
};

// PUT /projects/:projectId/countries-premises-rate/:countryId
export const upsertProjectCountryPremisesRate = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { premises_rate } = req.body as { premises_rate: number };
  
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (premises_rate === undefined || premises_rate === null) return res.status(400).json({ error: 'premises_rate requerido' });

  try {
    const q = `
      UPDATE project_countries
      SET premises_rate = $1
      WHERE project_id = $2 AND country_id = $3
      RETURNING *
    `;
    const { rows } = await db.query(q, [premises_rate, projectId, countryId]);
    if (rows.length === 0) return res.status(404).json({ error: 'País no encontrado en el proyecto' });
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryPremisesRate error', e);
    res.status(500).json({ error: 'Error al actualizar Premises Rate del país' });
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

// GET /projects/:projectId/countries-mng - Obtener porcentajes de management por país para Time & Material
export const getProjectCountriesMng = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.mng
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesMng error', e);
    res.status(500).json({ error: 'Error al obtener porcentajes de Management por país' });
  }
};
