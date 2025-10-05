import { Request, Response } from 'express';
import Pool from '../../db';
import { calcAnnualHours } from '../../services/steps/costs';

// Simple in-process cooldown map to avoid immediate repeated recomputes for same project/year.
// Key: `${projectId}:${year}` -> timestamp (ms)
const RECOMPUTE_COOLDOWN_SECONDS = Number(process.env.RECOMPUTE_COOLDOWN_SECONDS || '5');
const lastRecomputeMap: Map<string, number> = new Map();

const VALID_CONTEXT = ['it', 'subcontract', 'travel', 'purchases'];

const normalizeRow = (r: any) => ({
  id: r.id,
  project_id: r.project_id,
  context: r.context,
  type: r.type,
  concept: r.concept,
  quantity: Number(r.quantity),
  unit_cost: Number(r.unit_cost),
  // assignation removed from DB
  year: r.year,
  reinvoiced: r.reinvoiced,
  created_at: r.created_at,
  updated_at: r.updated_at
});

const parseStepIds = (val: unknown): number[] | undefined => {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    const nums = val.map(Number).filter((n) => Number.isInteger(n));
    const uniq = Array.from(new Set(nums));
    return uniq;
  }
  return undefined;
};

const validateStepsBelongToProject = async (
  client: any,
  stepIds: number[],
  projectId: number
) => {
  if (!stepIds.length) return true;
  const q = `
    SELECT COUNT(*)::int AS cnt
    FROM steps s
    JOIN deliverables d ON s.deliverable_id = d.id
    JOIN workpackages w ON d.workpackage_id = w.id
    WHERE s.id = ANY($1::int[]) AND w.project_id = $2
  `;
  const { rows } = await client.query(q, [stepIds, projectId]);
  return rows[0]?.cnt === stepIds.length;
};

// GET /projects/:projectId/non-operational-costs?context=it|subcontract|travel
export const getNonOperationalCosts = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { context } = req.query;
  try {
    let query = 'SELECT * FROM project_non_operational_costs WHERE project_id=$1';
    const params: any[] = [projectId];
    if (context && VALID_CONTEXT.includes(String(context))) {
      query += ' AND context=$2';
      params.push(String(context));
    }
    query += ' ORDER BY id DESC';

    const { rows } = await Pool.query(query, params);
    res.json(rows.map(normalizeRow));
  } catch (err) {
    console.error('Error fetching non operational costs:', err);
    res.status(500).json({ error: 'Error fetching costs' });
  }
};

// GET /projects/:projectId/non-operational-costs/:id
export const getNonOperationalCostById = async (req: Request, res: Response) => {
  const { projectId, id } = req.params;
  try {
    const { rows } = await Pool.query(
      'SELECT * FROM project_non_operational_costs WHERE id=$1 AND project_id=$2',
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Coste no encontrado' });
    res.json(normalizeRow(rows[0]));
  } catch (err) {
    console.error('Error fetching non operational cost by id:', err);
    res.status(500).json({ error: 'Error fetching cost' });
  }
};

// POST /projects/:projectId/non-operational-costs
export const createNonOperationalCost = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    context,
    type,
    concept,
    quantity = 1,
    unit_cost = 0,
    year = null,
    reinvoiced = false,
    step_ids
  } = req.body as any;

  if (!VALID_CONTEXT.includes(context)) {
    return res.status(400).json({ error: 'Context inválido' });
  }
  if (!type || !concept) {
    return res.status(400).json({ error: 'type y concept requeridos' });
  }

  try {
    const client = await Pool.connect();
    try {
      await client.query('BEGIN');

      const q = `
        INSERT INTO project_non_operational_costs
        (project_id, context, type, concept, quantity, unit_cost, year, reinvoiced)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *;
      `;
      const values = [
        projectId,
        context,
        type,
        concept,
        quantity,
        unit_cost,
        year,
        reinvoiced
      ];
      const result = await client.query(q, values);
      const created = normalizeRow(result.rows[0]);

      // If client provided step_ids, always validate and insert associations
      const stepIds = parseStepIds(step_ids) || [];
      if (stepIds.length) {
        console.debug('[nonOperationalCosts] creating associations for cost', created.id, 'stepIds=', stepIds);
        const ok = await validateStepsBelongToProject(client, stepIds, Number(projectId));
        if (!ok) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Algunos steps no pertenecen al proyecto' });
        }
        // Insert associations
        await client.query(
          `INSERT INTO step_non_operational_costs (step_id, cost_id)
           SELECT unnest($1::int[]), $2`,
          [stepIds, created.id]
        );
        console.debug('[nonOperationalCosts] associations inserted for cost', created.id);
        (created as any).step_ids = stepIds;
      } else {
        (created as any).step_ids = [];
      }

      await client.query('COMMIT');
      res.status(201).json(created);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      (client as any)?.release?.();
    }
  } catch (err) {
    console.error('Error creando non operational cost:', err);
    res.status(500).json({ error: 'Error creando coste' });
  }
};

// PUT /projects/:projectId/non-operational-costs/:id
export const updateNonOperationalCost = async (req: Request, res: Response) => {
  const { projectId, id } = req.params;
  const {
    context,
    type,
    concept,
    quantity,
    unit_cost,
    year,
    reinvoiced,
    step_ids
  } = req.body as any;

  try {
    const client = await Pool.connect();
    try {
      await client.query('BEGIN');

      // Lock current row
      const { rows: curRows } = await client.query(
        'SELECT * FROM project_non_operational_costs WHERE id=$1 AND project_id=$2 FOR UPDATE',
        [id, projectId]
      );
      if (!curRows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Coste no encontrado' });
      }
      const current = normalizeRow(curRows[0]);

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      const add = (col: string, val: any) => {
        fields.push(`${col}=$${idx++}`);
        values.push(val);
      };

      if (context) {
        if (!VALID_CONTEXT.includes(context)) return res.status(400).json({ error: 'Context inválido' });
        add('context', context);
      }
      if (type !== undefined) add('type', type);
      if (concept !== undefined) add('concept', concept);
      if (quantity !== undefined) add('quantity', quantity);
      if (unit_cost !== undefined) add('unit_cost', unit_cost);
      // assignation removed: nothing to add
      if (year !== undefined) add('year', year);
      if (reinvoiced !== undefined) add('reinvoiced', reinvoiced);

      let updated = current;
      if (fields.length) {
        add('updated_at', new Date());
        const query = `
          UPDATE project_non_operational_costs
          SET ${fields.join(', ')}
          WHERE id=$${idx} AND project_id=$${idx + 1}
          RETURNING *;
        `;
        values.push(id, projectId);
        const result = await client.query(query, values);
        updated = normalizeRow(result.rows[0]);
      }

      // Associations handling: if client provided step_ids payload, replace associations accordingly
      const hasStepIds = step_ids !== undefined;
      const stepIds = parseStepIds(step_ids) || [];

      if (hasStepIds) {
        console.debug('[nonOperationalCosts] replacing associations for cost', id, 'stepIds=', stepIds);
        // Replace associations with provided list (could be empty)
        await client.query('DELETE FROM step_non_operational_costs WHERE cost_id=$1', [id]);
        if (stepIds.length) {
          const ok = await validateStepsBelongToProject(client, stepIds, Number(projectId));
          if (!ok) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Algunos steps no pertenecen al proyecto' });
          }
          await client.query(
            `INSERT INTO step_non_operational_costs (step_id, cost_id)
             SELECT unnest($1::int[]), $2`,
            [stepIds, id]
          );
          console.debug('[nonOperationalCosts] associations replaced for cost', id);
        }
      }

      // Always include current step_ids in response (may be empty array)
      const { rows: sRows } = await client.query(
        'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1 ORDER BY step_id ASC',
        [id]
      );
      (updated as any).step_ids = sRows.map((r: any) => r.step_id);

      await client.query('COMMIT');
      res.json(updated);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      (client as any)?.release?.();
    }
  } catch (err) {
    console.error('Error actualizando coste:', err);
    res.status(500).json({ error: 'Error actualizando coste' });
  }
};

// DELETE /projects/:projectId/non-operational-costs/:id
export const deleteNonOperationalCost = async (req: Request, res: Response) => {
  const { projectId, id } = req.params;
  try {
    const client = await Pool.connect();
    try {
      await client.query('BEGIN');
      // Ensure cost belongs to project and delete associations first
      const { rows: check } = await client.query(
        'SELECT id FROM project_non_operational_costs WHERE id=$1 AND project_id=$2 FOR UPDATE',
        [id, projectId]
      );
      if (!check.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Coste no encontrado' });
      }
      await client.query('DELETE FROM step_non_operational_costs WHERE cost_id=$1', [id]);
      await client.query('DELETE FROM project_non_operational_costs WHERE id=$1 AND project_id=$2', [id, projectId]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      (client as any)?.release?.();
    }
  } catch (err) {
    console.error('Error eliminando coste:', err);
    res.status(500).json({ error: 'Error eliminando coste' });
  }
};

// POST /projects/:projectId/it-costs/recompute
export const recomputeItCostsForProjectYear = async (req: Request, res: Response) => {
  const { projectId } = req.params as any;
  const { year } = req.body as { year?: number };
  if (!Number.isInteger(year)) return res.status(400).json({ error: 'year requerido' });

  const key = `${projectId}:${year}`;
  const last = lastRecomputeMap.get(key) || 0;
  const now = Date.now();
  if (last && (now - last) < RECOMPUTE_COOLDOWN_SECONDS * 1000) {
    const remainingCooldown = Math.ceil((RECOMPUTE_COOLDOWN_SECONDS * 1000 - (now - last)) / 1000);
    console.warn('[recomputeItCosts] rejected: cooldown active', { projectId, year, cooldownSeconds: RECOMPUTE_COOLDOWN_SECONDS, remainingSeconds: remainingCooldown });
    return res.status(429).json({ 
      error: 'Recompute solicitado muy pronto. Intente de nuevo más tarde.',
      retryAfterSeconds: remainingCooldown
    });
  }
  
  // Set timestamp immediately to prevent race conditions
  lastRecomputeMap.set(key, now);

  let client: any = null;
  let acquiredLock = false;
  try {
    client = await Pool.connect();
    // Acquire advisory lock for this project/year
    try {
      const lockRes = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [Number(projectId), Number(year)]);
      acquiredLock = !!(lockRes.rows?.[0]?.locked);
    } catch (err) {
      console.warn('[recomputeItCosts] advisory lock attempt failed (non-fatal):', String(err));
      acquiredLock = false;
    }

    if (!acquiredLock) {
      console.warn('[recomputeItCosts] another recompute seems to be running for this project/year', { projectId, year });
      return res.status(409).json({ error: 'Recompute already in progress for this project/year' });
    }

    console.info('[recomputeItCosts] start', { projectId, year });
    await client.query('BEGIN');

    // Reset target columns (best-effort; ignore errors for missing columns)
    // NOTE: We DO NOT reset it_costs anymore because it's now used for IT costs from project_countries
    // await client.query(
    //   `UPDATE step_yearly_data syd
    //    SET it_costs = 0
    //    FROM steps s
    //    JOIN deliverables d ON d.id = s.deliverable_id
    //    JOIN workpackages wp ON wp.id = d.workpackage_id
    //    WHERE syd.step_id = s.id
    //      AND wp.project_id = $1
    //      AND syd.year = $2`,
    //   [projectId, year]
    // );
    console.log('[recomputeItCosts] NOTE: Skipping it_costs reset - now managed by batchCalculateProjectCosts');
    try {
      await client.query(`UPDATE step_yearly_data syd SET it_recurrent_costs = 0 FROM steps s JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE syd.step_id = s.id AND wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
    } catch (err) {
      console.warn('[recomputeItCosts] could not reset it_recurrent_costs (maybe column missing):', String(err));
    }
    try {
      await client.query(`UPDATE step_yearly_data syd SET travel_costs = 0 FROM steps s JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE syd.step_id = s.id AND wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
    } catch (err) {
      console.warn('[recomputeItCosts] could not reset travel_costs (maybe column missing):', String(err));
    }
    try {
      await client.query(`UPDATE step_yearly_data syd SET subco_costs = 0 FROM steps s JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE syd.step_id = s.id AND wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
    } catch (err) {
      console.warn('[recomputeItCosts] could not reset subco_costs (maybe column missing):', String(err));
    }
    try {
      await client.query(`UPDATE step_yearly_data syd SET purchases_costs = 0 FROM steps s JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE syd.step_id = s.id AND wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
    } catch (err) {
      console.warn('[recomputeItCosts] could not reset purchases_costs (maybe column missing):', String(err));
    }

    // --- Process IT costs (non-reinvoiced) ---
    const { rows: itCosts } = await client.query(
      `SELECT id, quantity, unit_cost, type, year, reinvoiced, context FROM project_non_operational_costs
       WHERE project_id=$1 AND context='it' AND (reinvoiced IS NULL OR reinvoiced = false) AND (year IS NULL OR year=$2)`,
      [projectId, year]
    );

    for (const cost of itCosts) {
      const amount = Number(cost.quantity || 0) * Number(cost.unit_cost || 0);
      if (!amount) continue;

      const { rows: assoc } = await client.query('SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1', [cost.id]);
      let stepIds = Array.from(new Set(assoc.map((r: any) => r.step_id)));
      if (!stepIds.length) {
        const { rows: allRows } = await client.query(`SELECT syd.step_id FROM step_yearly_data syd JOIN steps s ON s.id = syd.step_id JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
        stepIds = allRows.map((r: any) => r.step_id);
        if (!stepIds.length) continue;
      }

      const { rows: sydRows } = await client.query(`SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.salaries_cost, syd.management_costs, s.country_id, s.unit AS process_time_unit FROM step_yearly_data syd JOIN steps s ON s.id = syd.step_id WHERE syd.step_id = ANY($1::int[]) AND syd.year = $2`, [stepIds, year]);
      if (!sydRows.length) continue;

      if (String(cost.type) === 'License Per Use') {
        const countryIds = Array.from(new Set(sydRows.map((r: any) => Number(r.country_id)).filter((n: number) => !isNaN(n))));
        const nptMap: Record<number, number> = {};
        const hoursPerDayMap: Record<number, number> = {};
        if (countryIds.length) {
          const pcRes = await client.query(`SELECT country_id, npt_rate, hours_per_day FROM project_countries WHERE project_id=$1 AND country_id = ANY($2::int[])`, [projectId, countryIds]);
          for (const row of pcRes.rows) {
            nptMap[Number(row.country_id)] = Number(row.npt_rate || 0);
            hoursPerDayMap[Number(row.country_id)] = Number(row.hours_per_day || 8);
          }
        }

        for (const r of sydRows) {
          try {
            const countryId = Number(r.country_id);
            const hours_per_day = hoursPerDayMap[countryId] || 8;
            
            // Get country configuration to calculate productive hours correctly
            const pcRes = await client.query(
              `SELECT working_days, hours_per_day, activity_rate 
               FROM project_countries 
               WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
              [projectId, countryId]
            );
            
            if (pcRes.rows.length === 0) continue;
            const { working_days, activity_rate } = pcRes.rows[0];
            const working_days_num = Number(working_days || 0);
            const activity_rate_num = Number(activity_rate || 0);
            const hours_per_day_num = Number(pcRes.rows[0].hours_per_day || 8);
            
            // Calculate productive hours per year (NO NPT adjustment)
            const productiveHoursPerYear = working_days_num * hours_per_day_num * (activity_rate_num / 100);
            
            if (!(productiveHoursPerYear > 0)) continue;
            
            // Convert process_time to hours if needed
            const process_time_raw = Number(r.process_time || 0);
            const process_time_unit = r.process_time_unit?.toLowerCase();
            const process_time_hours = process_time_unit === 'days' ? process_time_raw * hours_per_day_num : process_time_raw;
            
            // Apply the CORRECT License Per Use formula (NO NPT adjustment)
            // Step 1: Calculate hourly cost
            const hourlyCost = amount / productiveHoursPerYear;
            
            // Step 2: Calculate final cost for this step
            const shareRaw = hourlyCost * process_time_hours;
            const share = Math.round(shareRaw * 100) / 100;
            
            console.log(`[recomputeItCosts] License Per Use calculation for step ${r.step_id}:`, {
              totalCost: amount,
              process_time_raw,
              process_time_unit,
              process_time_hours,
              working_days: working_days_num,
              hours_per_day: hours_per_day_num,
              activity_rate: activity_rate_num,
              productiveHoursPerYear,
              hourlyCost,
              formula: `(${amount} / ${productiveHoursPerYear}) × ${process_time_hours} = ${shareRaw}`,
              share
            });
            try {
              await client.query(`UPDATE step_yearly_data SET it_recurrent_costs = COALESCE(it_recurrent_costs,0) + $1 WHERE id = $2`, [share, r.syd_id]);
            } catch (err) {
              console.warn('[recomputeItCosts] it_recurrent_costs column missing, cannot store license-per-use share:', String(err));
              // NOTE: We no longer use it_costs as fallback because it's now used for IT costs from project_countries
              // try {
              //   await client.query(`UPDATE step_yearly_data SET it_costs = COALESCE(it_costs,0) + $1 WHERE id = $2`, [share, r.syd_id]);
              // } catch (err2) {
              //   console.error('[recomputeItCosts] failed to store license-per-use share', String(err2));
              // }
            }
          } catch (err) {
            console.warn('[recomputeItCosts] error computing license-per-use for syd', r.syd_id, err);
          }
        }
      } else {
        let weights = sydRows.map((r: any) => {
          const pt = Number(r.process_time || 0);
          const salMgmt = Number(r.salaries_cost || 0) + Number(r.management_costs || 0);
          const w = salMgmt > 0 ? salMgmt : (pt > 0 ? pt : 1);
          return { syd_id: r.syd_id, step_id: r.step_id, pt, salMgmt, w };
        });
        let sumW = weights.reduce((acc: number, x: any) => acc + x.w, 0);
        if (!(sumW > 0)) { weights = weights.map((w: any) => ({ ...w, w: 1 })); sumW = weights.length; }
        for (const w of weights) {
          const share = amount * (w.w / sumW);
          console.log(`[recomputeItCosts] Adding IT recurrent cost share to step ${w.step_id}:`, { amount, share, syd_id: w.syd_id });
          await client.query(`UPDATE step_yearly_data SET it_recurrent_costs = COALESCE(it_recurrent_costs,0) + $1 WHERE id = $2`, [share, w.syd_id]);
        }
      }
    }

    // IT premium
    const premiumQ = `
      WITH syd_target AS (
        SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.hardware, s.unit AS process_time_unit
        FROM step_yearly_data syd
        JOIN steps s ON s.id = syd.step_id
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages wp ON wp.id = d.workpackage_id
        WHERE wp.project_id = $1
          AND syd.year = $2
      ),
      step_country AS (
        SELECT s.id AS step_id, s.country_id AS country_id
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
      ),
      params AS (
        SELECT st.step_id, st.country_id, pc.it_cost, pc.npt_rate, pc.hours_per_day
        FROM step_country st
        JOIN project_countries pc
          ON pc.project_id = $3 AND pc.country_id = st.country_id
      )
      SELECT st.syd_id, st.step_id, st.process_time, st.hardware, st.process_time_unit, p.it_cost, p.npt_rate, p.hours_per_day
      FROM syd_target st
      LEFT JOIN params p ON p.step_id = st.step_id
    `;
    const { rows: premiumRows } = await client.query(premiumQ, [projectId, year, projectId]);
    for (const r of premiumRows) {
      if (!r.hardware) continue;
      const itCost = Number(r.it_cost || 0);
      const npt = Number(r.npt_rate || 0);
      if (!itCost || npt >= 100) continue;
      
      // Convert process_time to hours if needed
      const process_time_raw = Number(r.process_time || 0);
      const process_time_unit = r.process_time_unit?.toLowerCase();
      const hours_per_day = Number(r.hours_per_day || 8);
      const process_time_hours = process_time_unit === 'days' ? process_time_raw * hours_per_day : process_time_raw;
      
      const premium = process_time_hours * itCost / (1 - (npt / 100));
      console.log(`[recomputeItCosts] Adding IT premium to step ${r.step_id}:`, { 
        process_time_raw, 
        process_time_unit, 
        hours_per_day, 
        process_time_hours, 
        itCost, 
        npt, 
        premium, 
        syd_id: r.syd_id 
      });
      try {
        await client.query(`UPDATE step_yearly_data SET it_recurrent_costs = COALESCE(it_recurrent_costs,0) + $1 WHERE id = $2`, [premium, r.syd_id]);
      } catch (err) {
        console.warn('[recomputeItCosts] it_recurrent_costs column missing for IT premium:', String(err));
        // NOTE: We no longer use it_costs as fallback because it's now used for IT costs from project_countries
        // try { await client.query(`UPDATE step_yearly_data SET it_costs = COALESCE(it_costs,0) + $1 WHERE id = $2`, [premium, r.syd_id]); } catch (err2) { console.error('[recomputeItCosts] failed to store IT premium', String(err2)); }
      }
    }

    // Reusable allocation by context helper
    const allocateByContext = async (ctx: string, targetColumn: string) => {
      const { rows: costs } = await client.query(`SELECT id, quantity, unit_cost, type, year, reinvoiced FROM project_non_operational_costs WHERE project_id=$1 AND context=$2 AND (reinvoiced IS NULL OR reinvoiced = false) AND (year IS NULL OR year=$3)`, [projectId, ctx, year]);
      for (const cost of costs) {
        const amount = Number(cost.quantity || 0) * Number(cost.unit_cost || 0);
        if (!amount) continue;
        const { rows: assoc } = await client.query('SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1', [cost.id]);
        let stepIds = Array.from(new Set(assoc.map((r: any) => r.step_id)));
        if (!stepIds.length) {
          const { rows: allRows } = await client.query(`SELECT syd.step_id FROM step_yearly_data syd JOIN steps s ON s.id = syd.step_id JOIN deliverables d ON d.id = s.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE wp.project_id = $1 AND syd.year = $2`, [projectId, year]);
          stepIds = allRows.map((r: any) => r.step_id);
          if (!stepIds.length) continue;
        }
        const { rows: sydRows } = await client.query(`SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.salaries_cost, syd.management_costs FROM step_yearly_data syd JOIN steps s ON s.id = syd.step_id WHERE syd.step_id = ANY($1::int[]) AND syd.year = $2`, [stepIds, year]);
        if (!sydRows.length) continue;
        let weights = sydRows.map((r: any) => {
          const pt = Number(r.process_time || 0);
          const salMgmt = Number(r.salaries_cost || 0) + Number(r.management_costs || 0);
          const w = salMgmt > 0 ? salMgmt : (pt > 0 ? pt : 1);
          return { syd_id: r.syd_id, step_id: r.step_id, pt, salMgmt, w };
        });
        let sumW = weights.reduce((acc: number, x: any) => acc + x.w, 0);
        if (!(sumW > 0)) { weights = weights.map((w: any) => ({ ...w, w: 1 })); sumW = weights.length; }
        for (const w of weights) {
          const share = amount * (w.w / sumW);
          await client.query(`UPDATE step_yearly_data SET ${targetColumn} = COALESCE(${targetColumn},0) + $1 WHERE id = $2`, [share, w.syd_id]);
        }
      }
    };

    // allocate travel, subcontract, purchases
    await allocateByContext('travel', 'travel_costs');
    await allocateByContext('subcontract', 'subco_costs');
    await allocateByContext('purchases', 'purchases_costs');

    await client.query('COMMIT');
    // Timestamp was already set at the beginning to prevent race conditions
    console.info('[recomputeItCosts] finished successfully', { projectId, year });
    return res.json({ success: true });
  } catch (err) {
    try { if (client) await client.query('ROLLBACK'); } catch (rbErr) { console.error('[recomputeItCosts] rollback failed', String(rbErr)); }
    // Reset the timestamp so the user can retry immediately after an error
    lastRecomputeMap.delete(key);
    console.error('Error recomputing IT costs:', err);
    return res.status(500).json({ error: 'Error recomputando IT costs' });
  } finally {
    if (client) {
      try {
        if (acquiredLock) {
          await client.query('SELECT pg_advisory_unlock($1, $2)', [Number(projectId), Number(year)]);
          console.debug('[recomputeItCosts] advisory lock released', { projectId, year });
        }
      } catch (unlockErr) {
        console.warn('[recomputeItCosts] failed to release advisory lock (non-fatal):', String(unlockErr));
      }
      try { (client as any)?.release?.(); } catch (e) { /* ignore */ }
    }
  }
};