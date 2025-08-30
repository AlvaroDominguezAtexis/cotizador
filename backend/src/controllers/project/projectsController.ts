import { Request, Response } from 'express';
import Pool from '../../db';

// 🔹 Normaliza fechas a YYYY-MM-DD (sin zona horaria)
const normalizeProjectDates = (project: any) => {
  if (!project) return project;
  const toDateOnly = (d: any) => {
    if (!d) return null;
    // Convertimos cualquier formato a string y cortamos antes de la T si existe
    const str = d instanceof Date ? d.toISOString() : d.toString();
    return str.includes('T') ? str.split('T')[0] : str;
  };

  return {
    ...project,
    start_date: toDateOnly(project.start_date),
    end_date: toDateOnly(project.end_date),
    created_at: toDateOnly(project.created_at),
    updated_at: toDateOnly(project.updated_at),
  };
};

// 🔹 Obtener todos los proyectos (incluye países asociados desde project_countries)
export const getProjects = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT p.*,
             COALESCE(pc.countries, '[]') AS countries
      FROM projects p
      LEFT JOIN (
        SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
        FROM project_countries
        GROUP BY project_id
      ) pc ON pc.project_id = p.id
      ORDER BY p.created_at DESC;
    `;
    const result = await Pool.query(query);
    const normalized = result.rows.map(r => normalizeProjectDates(r));
    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
};

// 🔹 Obtener un proyecto por ID (con países asociados)
export const getProjectById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT p.*,
             COALESCE(pc.countries, '[]') AS countries
      FROM projects p
      LEFT JOIN (
        SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
        FROM project_countries
        WHERE project_id = $1
        GROUP BY project_id
      ) pc ON pc.project_id = p.id
      WHERE p.id = $1;
    `;
    const result = await Pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json(normalizeProjectDates(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
};

// 🔹 Crear un proyecto
export const createProject = async (req: Request, res: Response) => {
  const client = await Pool.connect();
  try {
    await client.query('BEGIN');
    const {
      title,
      crm_code,
      client: clientName,
      activity,
      start_date,
      end_date,
      business_manager,
  business_unit,
  bu_line,
  ops_domain,
      countries, // array de country_id
      iqp,
  margin_type,
  margin_goal,
      segmentation,
      description
    } = req.body;

    // Basic required fields validation
    const missing: string[] = [];
    if (!title || String(title).trim() === '') missing.push('title');
    if (!start_date) missing.push('start_date');
    if (!end_date) missing.push('end_date');
    if (!Array.isArray(countries) || countries.length === 0) missing.push('countries');
    if (missing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'start_date', 'end_date', 'countries'],
        missing
      });
    }

    const insertProjectQuery = `
    INSERT INTO projects
  (title, crm_code, client, activity, start_date, end_date,
   business_manager, business_unit, bu_line, ops_domain,
   iqp, margin_type, margin_goal, segmentation, description)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *;
    `;
    // Normalize margin fields
    const marginTypeVal = (margin_type === '' || margin_type == null) ? null : String(margin_type);
    const marginGoalVal = (margin_goal === '' || margin_goal == null || isNaN(Number(margin_goal))) ? null : Number(margin_goal);

    const projectValues = [
      title || null,
      crm_code || null,
      clientName || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
  bu_line || null,
      ops_domain || null,
      iqp || null,
      marginTypeVal,
      marginGoalVal,
      segmentation || null,
      description || null,
    ];

    const projectResult = await client.query(insertProjectQuery, projectValues);
    const newProject = projectResult.rows[0];

  // Insertar países (si vienen) con CPI, Activity Rate y NPT Rate por defecto tomados de countries
  if (Array.isArray(countries) && countries.length > 0) {
      const countryIds: number[] = countries.map((c: any) => Number(c)).filter((n: any) => !Number.isNaN(n));
      // Inserta mediante SELECT para tomar el cpi_by_default de cada país
    const insertCountriesQuery = `
  INSERT INTO project_countries (project_id, country_id, cpi, activity_rate, npt_rate, it_cost, working_days, hours_per_day, mng, markup, social_contribution_rate, management_yearly_salary, non_productive_cost_of_productive_staff, it_production_support, operational_quality_costs, operations_management_costs, lean_management_costs)
  SELECT $1 AS project_id, c.id AS country_id,
     c.cpi_by_default AS cpi,
     c.activity_rate_by_default AS activity_rate,
     c.npt_rate_by_default AS npt_rate,
     c.it_cost_by_default AS it_cost,
     c.working_days_by_default AS working_days,
     c.hours_per_day_by_default AS hours_per_day,
     c.mng_by_default AS mng,
     c.markup_by_default AS markup,
     c.social_contribution_rate_by_default AS social_contribution_rate,
     c.management_yearly_salary_by_default AS management_yearly_salary
    ,c.non_productive_cost_of_productive_staff_by_default AS non_productive_cost_of_productive_staff
    ,c.it_production_support_by_default AS it_production_support
  ,c.operational_quality_costs_by_default AS operational_quality_costs
  ,c.operations_management_costs_by_default AS operations_management_costs
  ,c.lean_management_costs_by_default AS lean_management_costs
        FROM countries c
        WHERE c.id = ANY($2::int[])
        ON CONFLICT (project_id, country_id) DO NOTHING;
      `;
      await client.query(insertCountriesQuery, [newProject.id, countryIds]);
    }

  // Auto-add Project Manager profile removed: project manager profile will not be auto-inserted

    await client.query('COMMIT');

    // Recuperar proyecto con países agregados
    const fullProject = await client.query(
      `SELECT p.*,
              COALESCE(pc.countries, '[]') AS countries
       FROM projects p
       LEFT JOIN (
         SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
         FROM project_countries WHERE project_id = $1 GROUP BY project_id
       ) pc ON pc.project_id = p.id
       WHERE p.id=$1`, [newProject.id]
    );

  const returnedRow = fullProject.rows[0] ?? newProject;
  if (!fullProject.rows[0]) console.warn('[createProject] final project SELECT returned no rows; falling back to inserted project object');
  res.status(201).json(normalizeProjectDates(returnedRow));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear proyecto' });
  } finally {
    client.release();
  }
};

// 🔹 Actualizar un proyecto
export const updateProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const clientConn = await Pool.connect();
  try {
    await clientConn.query('BEGIN');
    const {
      title,
      crm_code,
      client: clientName,
      activity,
      start_date,
      end_date,
      business_manager,
  business_unit,
  bu_line,
  ops_domain,
      countries, // array de country_id
      iqp,
  margin_type,
  margin_goal,
      segmentation,
      description
    } = req.body;

    const updateQuery = `
      UPDATE projects
    SET title=$1, crm_code=$2, client=$3, activity=$4,
      start_date=$5, end_date=$6,
      business_manager=$7, business_unit=$8, bu_line=$9, ops_domain=$10,
      iqp=$11, margin_type=$12, margin_goal=$13, segmentation=$14, description=$15,
      updated_at=NOW()
    WHERE id=$16
      RETURNING *;
    `;
    // Normalize margin fields on update as well
    const updMarginTypeVal = (margin_type === '' || margin_type == null) ? null : String(margin_type);
    const updMarginGoalVal = (margin_goal === '' || margin_goal == null || isNaN(Number(margin_goal))) ? null : Number(margin_goal);

    const updateValues = [
      title || null,
      crm_code || null,
      clientName || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
  bu_line || null,
      ops_domain || null,
      iqp || null,
      updMarginTypeVal,
      updMarginGoalVal,
      segmentation || null,
      description || null,
  id,
    ];

    const result = await clientConn.query(updateQuery, updateValues);
    if (result.rows.length === 0) {
      await clientConn.query('ROLLBACK');
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Actualizar países asociados preservando CPI existente
    const existingRes = await clientConn.query(
      'SELECT country_id, cpi FROM project_countries WHERE project_id = $1',
      [id]
    );
    const existingMap = new Map<number, number | null>();
    for (const row of existingRes.rows) existingMap.set(Number(row.country_id), row.cpi == null ? null : Number(row.cpi));

    const newCountries: number[] = Array.isArray(countries) ? countries.map((c: any) => Number(c)) : [];
    const newSet = new Set(newCountries);
    const oldSet = new Set(Array.from(existingMap.keys()));

    // Delete countries removed
    const toDelete: number[] = Array.from(oldSet).filter((cid) => !newSet.has(cid));
    if (toDelete.length > 0) {
      await clientConn.query(
        `DELETE FROM project_countries WHERE project_id = $1 AND country_id = ANY($2::int[])`,
        [id, toDelete]
      );
    }

  // Insertar países nuevos con CPI, Activity Rate y NPT Rate por defecto tomados de countries
    const toInsert: number[] = newCountries.filter((cid) => !oldSet.has(cid));
    if (toInsert.length > 0) {
    const insertCountriesQuery = `
  INSERT INTO project_countries (project_id, country_id, cpi, activity_rate, npt_rate, it_cost, working_days, hours_per_day, mng, markup, social_contribution_rate, management_yearly_salary, non_productive_cost_of_productive_staff, it_production_support, operational_quality_costs, operations_management_costs, lean_management_costs)
  SELECT $1 AS project_id, c.id AS country_id,
         c.cpi_by_default AS cpi,
         c.activity_rate_by_default AS activity_rate,
         c.npt_rate_by_default AS npt_rate,
         c.it_cost_by_default AS it_cost,
         c.working_days_by_default AS working_days,
         c.hours_per_day_by_default AS hours_per_day,
         c.mng_by_default AS mng,
         c.markup_by_default AS markup,
         c.social_contribution_rate_by_default AS social_contribution_rate,
         c.management_yearly_salary_by_default AS management_yearly_salary
    ,c.non_productive_cost_of_productive_staff_by_default AS non_productive_cost_of_productive_staff
    ,c.it_production_support_by_default AS it_production_support
  ,c.operational_quality_costs_by_default AS operational_quality_costs
  ,c.operations_management_costs_by_default AS operations_management_costs
  ,c.lean_management_costs_by_default AS lean_management_costs
        FROM countries c
        WHERE c.id = ANY($2::int[])
        ON CONFLICT (project_id, country_id) DO NOTHING;
      `;
      await clientConn.query(insertCountriesQuery, [id, toInsert]);
    }

    await clientConn.query('COMMIT');

    const fullProject = await clientConn.query(
      `SELECT p.*,
              COALESCE(pc.countries, '[]') AS countries
       FROM projects p
       LEFT JOIN (
         SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
         FROM project_countries WHERE project_id = $1 GROUP BY project_id
       ) pc ON pc.project_id = p.id
       WHERE p.id=$1`, [id]
    );

    res.json(normalizeProjectDates(fullProject.rows[0]));
  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  } finally {
    clientConn.release();
  }
};

// 🔹 Eliminar un proyecto
export const deleteProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await Pool.query('DELETE FROM projects WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proyecto' });
  }
};
