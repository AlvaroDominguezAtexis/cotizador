import { Request, Response } from 'express';
import db from '../../db';
import { 
  calcStepSalariesCost, 
  saveStepSalariesCost, 
  calcStepManagementCost, 
  saveStepManagementCost,
  batchCalculateProjectCosts 
} from '../../services/steps/costs';


const mapStep = (row: any) => ({
  id: row.id,
  deliverable_id: row.deliverable_id,
  profile_id: row.profile_id,
  country_id: row.country_id,
  city_id: row.city_id != null ? Number(row.city_id) : null,
  city: row.city != null ? row.city : null,
  nombre: row.nombre,
  unit: row.unit,
  // Compat fields (no yearly join now)
  process_time: row.process_time != null ? Number(row.process_time) : undefined,
  mng: row.mng != null ? Number(row.mng) : undefined,
  office: row.office != null ? !!row.office : undefined,
  hardware: row.hardware != null ? !!row.hardware : undefined,
  year: row.year != null ? Number(row.year) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const getSteps = async (req: Request, res: Response) => {
  const { deliverableId } = req.params;
  try {
    const q = `
      SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
      FROM steps s
      LEFT JOIN LATERAL (
        SELECT year, process_time, mng, office, hardware
        FROM step_yearly_data y
        WHERE y.step_id = s.id
        ORDER BY year ASC
        LIMIT 1
      ) y ON TRUE
      WHERE s.deliverable_id = $1
      ORDER BY s.id ASC
    `;
    const result = await db.query(q, [deliverableId]);
    res.json(result.rows.map(mapStep));
  } catch (err) {
    console.error('Error fetching steps', err);
    res.status(500).json({ error: 'Error al obtener steps' });
  }
};

export const createStep = async (req: Request, res: Response) => {
  const { projectId, workPackageId, deliverableId } = req.params as any;
  const { profile_id, country_id, city_id, city, nombre, process_time, unit, office, hardware } = req.body as any;
  try {
    // Required fields validation
    const missing: string[] = [];
    if (!nombre || String(nombre).trim() === '') missing.push('nombre');
    if (!profile_id) missing.push('profile_id');
    if (!country_id) missing.push('country_id');
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes', missing });
    }
    console.log('[stepsController#createStep] params', { projectId, workPackageId, deliverableId });
    console.log('[stepsController#createStep] body', { profile_id, country_id, nombre, process_time, unit, office, hardware });
    // Determine project years
    let years: number[] = [];
    if (projectId) {
      const pr = await db.query(`SELECT start_date, end_date FROM projects WHERE id = $1`, [projectId]);
      if (pr.rows.length > 0) {
        const sd = pr.rows[0].start_date ? new Date(pr.rows[0].start_date) : null;
        const ed = pr.rows[0].end_date ? new Date(pr.rows[0].end_date) : null;
        if (sd && ed) {
          const sy = sd.getFullYear();
          const ey = ed.getFullYear();
          for (let y = sy; y <= ey; y++) years.push(y);
        }
      }
    }
    console.log('[stepsController#createStep] computed years', years);
  // Default office and hardware to true (Yes) when creating a step
  const hw = hardware != null ? !!hardware : true;
  const ofc = office != null ? !!office : true;
  console.log('[stepsController#createStep] defaults', { office: ofc, hardware: hw });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Insert base step (no yearly fields here). Include city/city_id if provided.
      let insertSql: string;
      let insertParams: any[];
      if (city_id != null) {
        insertSql = `INSERT INTO steps (deliverable_id, profile_id, country_id, city_id, nombre, unit) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
        insertParams = [deliverableId, profile_id, country_id, city_id, nombre, unit];
      } else if (city != null) {
        insertSql = `INSERT INTO steps (deliverable_id, profile_id, country_id, city, nombre, unit) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
        insertParams = [deliverableId, profile_id, country_id, city, nombre, unit];
      } else {
        insertSql = `INSERT INTO steps (deliverable_id, profile_id, country_id, nombre, unit) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        insertParams = [deliverableId, profile_id, country_id, nombre, unit];
      }
      const stepRes = await client.query(insertSql, insertParams);
      const step = stepRes.rows[0];
      console.log('[stepsController#createStep] inserted base step', { stepId: step.id });

      // Resolve country config for calculations and mng from project_countries
      let resolvedMng: number | null = null;
      let cfg: { working_days: number; activity_rate: number; hours_per_day: number; social_contribution_rate: number } | null = null;
      if (projectId && country_id) {
        const sql = `SELECT mng, working_days, activity_rate, hours_per_day, social_contribution_rate
                     FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`;
        const params = [projectId, country_id];
        const cfgRes = await client.query(sql, params);
        console.log('[stepsController#createStep] project_countries query', { sql, params, rows: cfgRes.rows });
        if (cfgRes.rows.length > 0) {
          const r = cfgRes.rows[0];
          resolvedMng = r.mng != null ? Number(r.mng) : null;
          cfg = {
            working_days: Number(r.working_days || 0),
            activity_rate: Number(r.activity_rate || 0),
            hours_per_day: Number(r.hours_per_day || 0),
            social_contribution_rate: Number(r.social_contribution_rate || 0),
          };
        }
      }
      console.log('[stepsController#createStep] resolvedMng', resolvedMng);
      if (resolvedMng == null || !cfg) {
        console.error('[stepsController#createStep] ERROR: config not found in project_countries for provided project/country. Aborting step creation.', { projectId, country_id });
        const err: any = new Error('Config not found for (projectId, country_id) in project_countries');
        err.code = 'CFG_NOT_FOUND';
        err.status = 400;
        throw err;
      }

      // Validate annual hours
      const annualHours = cfg.working_days * cfg.activity_rate/100 * cfg.hours_per_day;
      if (!(annualHours > 0)) {
        const err: any = new Error('annual_hours debe ser > 0');
        err.status = 400;
        throw err;
      }

  // We'll compute salary and hourlyRate per-year below

      // Create yearly rows for project span, cloning input values
      if (years.length > 0) {
        console.log('[stepsController#createStep] inserting yearly rows', { count: years.length });
        for (const y of years) {
          // Salary for the exact year
          // Insert yearly data without calculating costs
          await client.query(
            `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (step_id, year) DO UPDATE SET process_time=EXCLUDED.process_time, mng=EXCLUDED.mng, office=EXCLUDED.office, hardware=EXCLUDED.hardware`,
            [step.id, y, process_time ?? null, resolvedMng, ofc, hw]
          );
        }
      } else {
        console.warn('[stepsController#createStep] project has no defined years (start_date/end_date). No yearly rows inserted.');
      }

      // Return step with earliest yearly snapshot for compatibility
      const joined = await client.query(
        `SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
         FROM steps s
         LEFT JOIN LATERAL (
           SELECT year, process_time, mng, office, hardware
           FROM step_yearly_data
           WHERE step_id = s.id
           ORDER BY year ASC
           LIMIT 1
         ) y ON TRUE
         WHERE s.id = $1`,
        [step.id]
      );
      await client.query('COMMIT');
  console.log('[stepsController#createStep] created step with earliest snapshot', { stepId: step.id });
      return res.status(201).json(mapStep(joined.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[stepsController#createStep] error, transaction rolled back', e);
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error creating step', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nombre de step duplicado en este deliverable' });
    }
    if (err.code === 'MNG_NOT_FOUND' || err.status === 400) {
      return res.status(400).json({
        error: 'Falta configuración de %Mng para el país del proyecto',
        detail: 'No existe registro en project_countries con mng para el par (projectId, country_id). Agrega el país al proyecto y/o define %Mng en Ajustes Avanzados.',
      });
    }
    res.status(500).json({ error: 'Error al crear step' });
  }
};

export const updateStep = async (req: Request, res: Response) => {
  const { stepId, deliverableId } = req.params;
  const { profile_id, country_id, city_id, city, nombre, unit } = req.body;
  try {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Build update SQL conditionally to include city/city_id when provided
      let updateSql: string;
      let values: any[];
      if (city_id != null) {
        updateSql = `UPDATE steps SET profile_id=$1, country_id=$2, city_id=$3, nombre=$4, unit=$5, updated_at=NOW() WHERE id=$6 AND deliverable_id=$7 RETURNING *`;
        values = [profile_id, country_id, city_id, nombre, unit, stepId, deliverableId];
      } else if (city != null) {
        updateSql = `UPDATE steps SET profile_id=$1, country_id=$2, city=$3, nombre=$4, unit=$5, updated_at=NOW() WHERE id=$6 AND deliverable_id=$7 RETURNING *`;
        values = [profile_id, country_id, city, nombre, unit, stepId, deliverableId];
      } else {
        updateSql = `UPDATE steps SET profile_id=$1, country_id=$2, nombre=$3, unit=$4, updated_at=NOW() WHERE id=$5 AND deliverable_id=$6 RETURNING *`;
        values = [profile_id, country_id, nombre, unit, stepId, deliverableId];
      }
      const result = await client.query(updateSql, values);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Step no encontrado' });
      }

      // Load project_id and updated step context
      const stepCtx = await client.query(
        `SELECT s.id, s.profile_id, s.country_id, s.unit,
                wp.project_id
           FROM steps s
           JOIN deliverables d ON d.id = s.deliverable_id
           JOIN workpackages wp ON wp.id = d.workpackage_id
          WHERE s.id = $1
          LIMIT 1`,
        [Number(stepId)]
      );
      const step = stepCtx.rows[0];

      // Country config for annual hours and SCR
      const cfgRes = await client.query(
        `SELECT working_days, activity_rate, hours_per_day, social_contribution_rate
           FROM project_countries WHERE project_id=$1 AND country_id=$2 LIMIT 1`,
        [step.project_id, step.country_id]
      );
      if (cfgRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Config país no encontrada' });
      }
      const cfg = cfgRes.rows[0];
      // Align with createStep: activity_rate is a percent
      const annualHours = Number(cfg.working_days || 0) * (Number(cfg.activity_rate || 0) / 100) * Number(cfg.hours_per_day || 0);
      if (!(annualHours > 0)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'annual_hours debe ser > 0' });
      }
      const scr = Number(cfg.social_contribution_rate || 0);

      // Iterate yearly rows and recompute salaries_cost with year-specific salary
      const yearly = await client.query(`SELECT year, process_time FROM step_yearly_data WHERE step_id=$1 ORDER BY year ASC`, [Number(stepId)]);
      const unitStr = String(step.unit || '').toLowerCase();
      const hpd = Number(cfg.hours_per_day || 0);
      for (const r of yearly.rows) {
        const pt = Number(r.process_time || 0);
        const processHours = unitStr === 'days' ? pt * hpd : pt;
        const salResY = await client.query(
          `SELECT pps.salary
             FROM project_profile_salaries pps
             JOIN project_profiles pp ON pp.id = pps.project_profile_id
            WHERE pp.project_id=$1 AND pp.profile_id=$2 AND pps.country_id=$3 AND pps.year=$4
            LIMIT 1`,
          [step.project_id, step.profile_id, step.country_id, Number(r.year)]
        );
        if (salResY.rows.length === 0 || salResY.rows[0].salary == null) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Salary no encontrado para el año ${Number(r.year)}` });
        }
        const salary = Number(salResY.rows[0].salary);
        const hourlyRate = (salary * (1 + (scr / 100))) / annualHours;
        const salariesCost = processHours * hourlyRate;
        
        // Calculate management cost
        const { managementCost } = await calcStepManagementCost({ 
          stepId: Number(stepId),
          year: Number(r.year),
          db: client 
        });

        // Log JSON context
        try {
          const logPayload = {
            tag: 'step_costs_calc',
            mode: 'update',
            step_id: Number(stepId),
            project_id: Number(step.project_id) || null,
            profile_id: Number(step.profile_id) || null,
            country_id: Number(step.country_id) || null,
            year: Number(r.year),
            salary_considered: Number(salary),
            working_days: Number(cfg.working_days || 0),
            hours_per_day: Number(hpd),
            activity_rate: Number(cfg.activity_rate || 0),
            social_contribution_rate: Number(scr),
            process_time_unit: String(step.unit || ''),
            process_time: pt,
            annualHours: Number(annualHours),
            hourlySalaries: Number(hourlyRate),
            managementCost: Number(managementCost),
          };
          console.log(JSON.stringify(logPayload));
        } catch {}
        
        // Update both costs
        await client.query(
          `UPDATE step_yearly_data SET salaries_cost=$1, management_costs=$2 WHERE step_id=$3 AND year=$4`,
          [salariesCost, managementCost, Number(stepId), Number(r.year)]
        );
      }

      // Attach earliest yearly snapshot for compatibility
      const joined = await client.query(
        `SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
         FROM steps s
         LEFT JOIN LATERAL (
           SELECT year, process_time, mng, office, hardware
           FROM step_yearly_data
           WHERE step_id = s.id
           ORDER BY year ASC
           LIMIT 1
         ) y ON TRUE
         WHERE s.id = $1`,
        [Number(stepId)]
      );
      await client.query('COMMIT');
      res.json(mapStep(joined.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    console.error('Error updating step', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nombre de step duplicado en este deliverable' });
    }
    res.status(500).json({ error: 'Error al actualizar step' });
  }
};

export const deleteStep = async (req: Request, res: Response) => {
  const { stepId, deliverableId } = req.params;
  try {
    const del = 'DELETE FROM steps WHERE id=$1 AND deliverable_id=$2 RETURNING id';
    const result = await db.query(del, [stepId, deliverableId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting step', err);
    res.status(500).json({ error: 'Error al eliminar step' });
  }
};

// Annual data endpoints
export const getAnnualData = async (req: Request, res: Response) => {
  const { stepId } = req.params;
  try {
    const r = await db.query(
      'SELECT id, step_id, year, process_time, mng, office, hardware FROM step_yearly_data WHERE step_id=$1 ORDER BY year ASC',
      [stepId]
    );
    res.json(r.rows.map((row: any) => ({
      id: row.id,
      step_id: row.step_id,
      year: Number(row.year),
      process_time: row.process_time != null ? Number(row.process_time) : null,
      mng: row.mng != null ? Number(row.mng) : null,
      office: row.office != null ? !!row.office : null,
      hardware: row.hardware != null ? !!row.hardware : null,
    })));
  } catch (e) {
    console.error('Error get annual data', e);
    res.status(500).json({ error: 'Error al obtener datos anuales' });
  }
};

export const upsertAnnualData = async (req: Request, res: Response) => {
  const { stepId, year } = req.params as any;
  const { process_time, mng, office, hardware } = req.body as any;
  try {
    console.log('[stepsController#upsertAnnualData] params', { stepId, year });
    console.log('[stepsController#upsertAnnualData] body', { process_time, mng, office, hardware });
    const q = `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (step_id, year)
               DO UPDATE SET
                 process_time = COALESCE(EXCLUDED.process_time, step_yearly_data.process_time),
                 mng = COALESCE(EXCLUDED.mng, step_yearly_data.mng),
                 office = COALESCE(EXCLUDED.office, step_yearly_data.office),
                 hardware = COALESCE(EXCLUDED.hardware, step_yearly_data.hardware)
               RETURNING *`;
    const r = await db.query(q, [stepId, Number(year), process_time ?? null, mng ?? null, office ?? null, hardware ?? null]);
    const row = r.rows[0];
    res.json({ id: row.id, step_id: row.step_id, year: Number(row.year), process_time: row.process_time, mng: row.mng, office: row.office, hardware: row.hardware });
  } catch (e) {
    console.error('Error upsert annual data', e);
    res.status(500).json({ error: 'Error al guardar datos anuales' });
  }
};

export const deleteAnnualData = async (req: Request, res: Response) => {
  const { stepId, year } = req.params as any;
  try {
    const r = await db.query('DELETE FROM step_yearly_data WHERE step_id=$1 AND year=$2 RETURNING id', [stepId, Number(year)]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Registro anual no encontrado' });
    res.json({ success: true });
  } catch (e) {
    console.error('Error delete annual data', e);
    res.status(500).json({ error: 'Error al eliminar dato anual' });
  }
};

// POST /projects/:projectId/steps/recalc-costs
export const recalcProjectStepsCosts = async (req: Request, res: Response) => {
  const { projectId } = req.params as any;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  
  try {
    console.log('[stepsController#recalcProjectStepsCosts] starting recalc for project', projectId);
    
    // Calculate costs for all steps in project
    const results = await batchCalculateProjectCosts({ 
      projectId: Number(projectId), 
      db
    });

    res.json({
      project_id: Number(projectId),
      costs: results
    });
  } catch (e: any) {
    const status = e?.status || 500;
    const message = e?.message || 'Error recalculating project costs';
    console.error('[stepsController#recalcProjectStepsCosts] error:', e);
    res.status(status).json({ error: message });
  }
};

// POST /steps/:stepId/recalc-salaries
export const recalcSalaries = async (req: Request, res: Response) => {
  const { stepId } = req.params as any;
  try {
    // Load step context
    const stepRes = await db.query(
      `SELECT s.id, s.profile_id, s.country_id, s.unit,
              wp.project_id
         FROM steps s
         JOIN deliverables d ON d.id = s.deliverable_id
         JOIN workpackages wp ON wp.id = d.workpackage_id
        WHERE s.id = $1
        LIMIT 1`,
      [Number(stepId)]
    );
    if (stepRes.rows.length === 0) return res.status(404).json({ error: 'Step no encontrado' });
    const step = stepRes.rows[0];
    // Country config
    const cfgRes = await db.query(
      `SELECT working_days, activity_rate, hours_per_day, social_contribution_rate
         FROM project_countries WHERE project_id=$1 AND country_id=$2 LIMIT 1`,
      [step.project_id, step.country_id]
    );
    if (cfgRes.rows.length === 0) return res.status(400).json({ error: 'Config país no encontrada' });
    const cfg = cfgRes.rows[0];
    const annualHours = Number(cfg.working_days || 0) * Number(cfg.activity_rate || 0) * Number(cfg.hours_per_day || 0);
    if (!(annualHours > 0)) return res.status(400).json({ error: 'annual_hours debe ser > 0' });
    const scr = Number(cfg.social_contribution_rate || 0);
    // All yearly rows
    const yearly = await db.query(`SELECT year, process_time FROM step_yearly_data WHERE step_id=$1 ORDER BY year ASC`, [Number(stepId)]);
    const unit = String(step.unit || '').toLowerCase();
    const hpd = Number(cfg.hours_per_day || 0);
    const breakdown: Array<{ year: number; process_hours: number; salaries_cost: number }> = [];
    // Upsert per year
    for (const r of yearly.rows) {
      const pt = Number(r.process_time || 0);
      const processHours = unit === 'days' ? pt * hpd : pt;
      // Salary for this exact year
      const salResY = await db.query(
        `SELECT pps.salary
           FROM project_profile_salaries pps
           JOIN project_profiles pp ON pp.id = pps.project_profile_id
          WHERE pp.project_id=$1 AND pp.profile_id=$2 AND pps.country_id=$3 AND pps.year=$4
          LIMIT 1`,
        [step.project_id, step.profile_id, step.country_id, Number(r.year)]
      );
      if (salResY.rows.length === 0 || salResY.rows[0].salary == null) return res.status(400).json({ error: `Salary no encontrado para el año ${Number(r.year)}` });
      const salary = Number(salResY.rows[0].salary);
      const hourlyRate = (salary * (1 + (scr / 100))) / annualHours;
      const salariesCost = processHours * hourlyRate;
      // Log calculation context as JSON
      try {
        const logPayload = {
          tag: 'step_salaries_calc',
          mode: 'recalc',
          step_id: Number(stepId),
          project_id: Number(step.project_id) || null,
          profile_id: Number(step.profile_id) || null,
          country_id: Number(step.country_id) || null,
          year: Number(r.year),
          salary_considered: Number(salary),
          working_days: Number(cfg.working_days || 0),
          hours_per_day: Number(hpd),
          activity_rate: Number(cfg.activity_rate || 0),
          social_contribution_rate: Number(scr),
          process_time_unit: String(step.unit || ''),
          process_time: pt,
          annualHours: Number(annualHours),
          hourlySalaries: Number(hourlyRate),
        };
        console.log(JSON.stringify(logPayload));
      } catch {}
      await db.query(
        `UPDATE step_yearly_data SET salaries_cost=$1 WHERE step_id=$2 AND year=$3`,
        [salariesCost, Number(stepId), Number(r.year)]
      );
      breakdown.push({ year: Number(r.year), process_hours: processHours, salaries_cost: Number(Number(salariesCost).toFixed(2)) });
    }

    res.json({
      step_id: Number(stepId),
      annual_hours: Number(annualHours),
      years: breakdown,
    });
  } catch (e: any) {
    const status = e?.status || 500;
    res.status(status).json({ error: e?.message || 'Error recalculando salarios', code: e?.code });
  }
};
