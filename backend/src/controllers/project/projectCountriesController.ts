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
        working_days_by_default,
        hours_per_day_by_default,
        mng_by_default,
        markup_by_default,
        social_contribution_rate_by_default,
    non_productive_cost_of_productive_staff_by_default,
    it_production_support_by_default,
  operational_quality_costs_by_default,
  operations_management_costs_by_default
  ,lean_management_costs_by_default
      FROM countries
      WHERE id = $1
    `;
    const defaultResult = await db.query(defaultQuery, [countryId]);
    const defaults = defaultResult.rows[0];

    if (!defaults) {
      return res.status(404).json({ error: 'País no encontrado' });
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
        working_days,
        hours_per_day,
        mng,
        markup,
        social_contribution_rate,
        non_productive_cost_of_productive_staff,
        it_production_support,
  operational_quality_costs,
  operations_management_costs
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET 
        management_yearly_salary = EXCLUDED.management_yearly_salary,
        cpi = EXCLUDED.cpi,
        activity_rate = EXCLUDED.activity_rate,
        npt_rate = EXCLUDED.npt_rate,
        it_cost = EXCLUDED.it_cost,
        working_days = EXCLUDED.working_days,
        hours_per_day = EXCLUDED.hours_per_day,
        mng = EXCLUDED.mng,
        markup = EXCLUDED.markup,
        social_contribution_rate = EXCLUDED.social_contribution_rate,
        non_productive_cost_of_productive_staff = EXCLUDED.non_productive_cost_of_productive_staff,
        it_production_support = EXCLUDED.it_production_support,
  operational_quality_costs = EXCLUDED.operational_quality_costs,
  operations_management_costs = EXCLUDED.operations_management_costs
  ,lean_management_costs = EXCLUDED.lean_management_costs
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
      defaults.working_days_by_default,
      defaults.hours_per_day_by_default,
      defaults.mng_by_default,
      defaults.markup_by_default,
      defaults.social_contribution_rate_by_default,
      defaults.non_productive_cost_of_productive_staff_by_default,
      defaults.it_production_support_by_default,
      defaults.operational_quality_costs_by_default
  ,defaults.operations_management_costs_by_default
  ,defaults.lean_management_costs_by_default
    ]);
    res.json(rows[0]);
  } catch (e) {
    console.error('addProjectCountry error', e);
    res.status(500).json({ error: 'Error al agregar país al proyecto' });
  }
};

// GET /projects/:projectId/countries-lean-management-costs
export const getProjectCountriesLeanManagementCosts = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.lean_management_costs
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesLeanManagementCosts error', e);
    res.status(500).json({ error: 'Error al obtener lean management costs por país' });
  }
};

// PUT /projects/:projectId/countries-lean-management-costs/:countryId
export const upsertProjectCountryLeanManagementCosts = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { lean_management_costs } = req.body as { lean_management_costs?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (lean_management_costs == null || isNaN(Number(lean_management_costs))) return res.status(400).json({ error: 'lean_management_costs numérico requerido' });
  const val = Number(lean_management_costs);
  if (val < 0) return res.status(400).json({ error: 'lean_management_costs debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, lean_management_costs)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id) DO UPDATE SET lean_management_costs = EXCLUDED.lean_management_costs
      RETURNING project_id, country_id, lean_management_costs
    `;
    const { rows } = await db.query(q, [projectId, countryId, val]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryLeanManagementCosts error', e);
    res.status(500).json({ error: 'Error al guardar lean_management_costs' });
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

// GET /projects/:projectId/countries-non-productive-cost
export const getProjectCountriesNonProductiveCost = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.non_productive_cost_of_productive_staff
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesNonProductiveCost error', e);
    res.status(500).json({ error: 'Error al obtener Non Productive Cost por país' });
  }
};

// PUT /projects/:projectId/countries-non-productive-cost/:countryId
export const upsertProjectCountryNonProductiveCost = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { non_productive_cost_of_productive_staff } = req.body as { non_productive_cost_of_productive_staff?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (non_productive_cost_of_productive_staff == null || isNaN(Number(non_productive_cost_of_productive_staff))) return res.status(400).json({ error: 'non_productive_cost_of_productive_staff numérico requerido' });
  const val = Number(non_productive_cost_of_productive_staff);
  if (val < 0) return res.status(400).json({ error: 'non_productive_cost_of_productive_staff debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, non_productive_cost_of_productive_staff)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET non_productive_cost_of_productive_staff = EXCLUDED.non_productive_cost_of_productive_staff
      RETURNING project_id, country_id, non_productive_cost_of_productive_staff
    `;
    const { rows } = await db.query(q, [projectId, countryId, val]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryNonProductiveCost error', e);
    res.status(500).json({ error: 'Error al guardar Non Productive Cost' });
  }
};

// GET /projects/:projectId/countries-it-production-support
export const getProjectCountriesItProductionSupport = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.it_production_support
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesItProductionSupport error', e);
    res.status(500).json({ error: 'Error al obtener IT Production Support por país' });
  }
};

// PUT /projects/:projectId/countries-it-production-support/:countryId
export const upsertProjectCountryItProductionSupport = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { it_production_support } = req.body as { it_production_support?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (it_production_support == null || isNaN(Number(it_production_support))) return res.status(400).json({ error: 'it_production_support numérico requerido' });
  const val = Number(it_production_support);
  if (val < 0) return res.status(400).json({ error: 'it_production_support debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, it_production_support)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET it_production_support = EXCLUDED.it_production_support
      RETURNING project_id, country_id, it_production_support
    `;
    const { rows } = await db.query(q, [projectId, countryId, val]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryItProductionSupport error', e);
    res.status(500).json({ error: 'Error al guardar IT Production Support' });
  }
};

// GET /projects/:projectId/countries-operational-quality-costs
export const getProjectCountriesOperationalQualityCosts = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  try {
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.operational_quality_costs
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesOperationalQualityCosts error', e);
    res.status(500).json({ error: 'Error al obtener Operational Quality Costs por país' });
  }
};

// PUT /projects/:projectId/countries-operational-quality-costs/:countryId
export const upsertProjectCountryOperationalQualityCosts = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params as { projectId: string; countryId: string };
  const { operational_quality_costs } = req.body as { operational_quality_costs?: number | string | null };
  if (!projectId || !countryId) return res.status(400).json({ error: 'projectId y countryId requeridos' });
  if (operational_quality_costs == null || isNaN(Number(operational_quality_costs))) return res.status(400).json({ error: 'operational_quality_costs numérico requerido' });
  const val = Number(operational_quality_costs);
  if (val < 0) return res.status(400).json({ error: 'operational_quality_costs debe ser >= 0' });
  try {
    const q = `
      INSERT INTO project_countries (project_id, country_id, operational_quality_costs)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, country_id)
      DO UPDATE SET operational_quality_costs = EXCLUDED.operational_quality_costs
      RETURNING project_id, country_id, operational_quality_costs
    `;
    const { rows } = await db.query(q, [projectId, countryId, val]);
    res.json(rows[0]);
  } catch (e) {
    console.error('upsertProjectCountryOperationalQualityCosts error', e);
    res.status(500).json({ error: 'Error al guardar Operational Quality Costs' });
  }
};

// GET /projects/:projectId/countries-operations-management-costs
export const getProjectCountriesOperationsManagementCosts = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      `SELECT pc.country_id, c.name AS country_name, pc.operations_management_costs
       FROM project_countries pc
       JOIN countries c ON c.id = pc.country_id
       WHERE pc.project_id = $1
       ORDER BY c.name`, [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener operations management costs por país' });
  }
};

// PUT /projects/:projectId/countries-operations-management-costs/:countryId
export const upsertProjectCountryOperationsManagementCosts = async (req: Request, res: Response) => {
  const { projectId, countryId } = req.params;
  const { operations_management_costs } = req.body as { operations_management_costs?: number | string | null };
  if (operations_management_costs == null || isNaN(Number(operations_management_costs))) return res.status(400).json({ error: 'operations_management_costs numérico requerido' });
  const val = Number(operations_management_costs);
  if (val < 0) return res.status(400).json({ error: 'operations_management_costs debe ser >= 0' });
  try {
    const result = await db.query(
      `INSERT INTO project_countries (project_id, country_id, operations_management_costs)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, country_id) DO UPDATE SET operations_management_costs = EXCLUDED.operations_management_costs
       RETURNING project_id, country_id, operations_management_costs`,
      [projectId, countryId, val]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar operations_management_costs' });
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

// Premises cost is now managed at city level. Country-level premises endpoints removed.
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
