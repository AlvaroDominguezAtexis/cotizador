import { Request, Response } from 'express';
import Pool from '../../db';
import { calcAnnualHours } from '../../services/steps/costs';

const VALID_CONTEXT = ['it', 'subcontract', 'travel'];

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

  try {
    const client = await Pool.connect();
    try {
      console.info('[recomputeItCosts] start', { projectId, year });
      await client.query('BEGIN');

      // 1) Reset IT costs for project & year
      await client.query(
        `UPDATE step_yearly_data syd
         SET it_costs = 0
         FROM steps s
         JOIN deliverables d ON d.id = s.deliverable_id
         JOIN workpackages wp ON wp.id = d.workpackage_id
         WHERE syd.step_id = s.id
           AND wp.project_id = $1
           AND syd.year = $2`,
        [projectId, year]
      );
      console.debug('[recomputeItCosts] reset it_costs to 0 for project/year', { projectId, year });
      // Try to reset it_recurrent_costs as well if column exists (non-fatal if missing)
      try {
        await client.query(
          `UPDATE step_yearly_data syd
           SET it_recurrent_costs = 0
           FROM steps s
           JOIN deliverables d ON d.id = s.deliverable_id
           JOIN workpackages wp ON wp.id = d.workpackage_id
           WHERE syd.step_id = s.id
             AND wp.project_id = $1
             AND syd.year = $2`,
          [projectId, year]
        );
        console.debug('[recomputeItCosts] reset it_recurrent_costs to 0 for project/year', { projectId, year });
      } catch (err) {
        console.warn('[recomputeItCosts] could not reset it_recurrent_costs (maybe column missing):', String(err));
      }

      // Try to reset travel_costs as well (non-fatal if missing)
      try {
        await client.query(
          `UPDATE step_yearly_data syd
           SET travel_costs = 0
           FROM steps s
           JOIN deliverables d ON d.id = s.deliverable_id
           JOIN workpackages wp ON wp.id = d.workpackage_id
           WHERE syd.step_id = s.id
             AND wp.project_id = $1
             AND syd.year = $2`,
          [projectId, year]
        );
        console.debug('[recomputeItCosts] reset travel_costs to 0 for project/year', { projectId, year });
      } catch (err) {
        console.warn('[recomputeItCosts] could not reset travel_costs (maybe column missing):', String(err));
      }

      // Try to reset subco_costs as well (non-fatal if missing)
      try {
        await client.query(
          `UPDATE step_yearly_data syd
           SET subco_costs = 0
           FROM steps s
           JOIN deliverables d ON d.id = s.deliverable_id
           JOIN workpackages wp ON wp.id = d.workpackage_id
           WHERE syd.step_id = s.id
             AND wp.project_id = $1
             AND syd.year = $2`,
          [projectId, year]
        );
        console.debug('[recomputeItCosts] reset subco_costs to 0 for project/year', { projectId, year });
      } catch (err) {
        console.warn('[recomputeItCosts] could not reset subco_costs (maybe column missing):', String(err));
      }

      // 2) Fetch IT costs (not reinvoiced) for project & year
      // Include costs with year=NULL (apply to all years) or matching the requested year
      const { rows: itCosts } = await client.query(
        `SELECT id, quantity, unit_cost, type, year, reinvoiced, context FROM project_non_operational_costs
         WHERE project_id=$1 AND context='it' AND (reinvoiced IS NULL OR reinvoiced = false) AND (year IS NULL OR year=$2)`,
        [projectId, year]
      );

      console.debug('[recomputeItCosts] itCosts count', itCosts.length);
      console.debug('[recomputeItCosts] itCosts rows', itCosts.map((c: any) => ({ id: c.id, type: c.type, year: c.year, quantity: c.quantity, unit_cost: c.unit_cost, reinvoiced: c.reinvoiced })));
      if (!itCosts.length) {
        // Diagnostic: list all IT costs for project without filters to see why none matched
        try {
          const { rows: allIt } = await client.query(
            `SELECT id, quantity, unit_cost, type, year, reinvoiced FROM project_non_operational_costs WHERE project_id=$1 AND context='it' ORDER BY id DESC`,
            [projectId]
          );
          console.debug('[recomputeItCosts] ALL project_non_operational_costs (context=it) for project', projectId, allIt.map((c: any) => ({ id: c.id, year: c.year, reinvoiced: c.reinvoiced, quantity: c.quantity, unit_cost: c.unit_cost, type: c.type })));
        } catch (err) {
          console.warn('[recomputeItCosts] failed to fetch ALL project_non_operational_costs for diagnostics:', String(err));
        }
      }
      for (const cost of itCosts) {
        const amount = Number(cost.quantity || 0) * Number(cost.unit_cost || 0);
        console.debug('[recomputeItCosts] processing cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, amount });
        if (!amount) {
          console.debug('[recomputeItCosts] skipping zero amount cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, year: cost.year });
          continue;
        }

        // 3) associated steps
        const { rows: assoc } = await client.query(
          'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1',
          [cost.id]
        );
        let stepIds = assoc.map((r: any) => r.step_id);

        // 3bis) fallback: all project steps with syd for the year
        if (!stepIds.length) {
          const { rows: allRows } = await client.query(
            `SELECT syd.step_id
               FROM step_yearly_data syd
               JOIN steps s ON s.id = syd.step_id
               JOIN deliverables d ON d.id = s.deliverable_id
               JOIN workpackages wp ON wp.id = d.workpackage_id
               WHERE wp.project_id = $1
                 AND syd.year = $2`,
            [projectId, year]
          );
          stepIds = allRows.map((r: any) => r.step_id);
          console.debug('[recomputeItCosts] fallback to all project steps for year', { costId: cost.id, chosenSteps: stepIds.length });
          if (!stepIds.length) {
            console.warn('[recomputeItCosts] no candidate steps for cost', cost.id, 'project', projectId, 'year', year);
            continue;
          }
        }

        // 4) Load syd rows for those steps and compute weights
        // include step country_id to allow per-country annualHours/npt calculations
        const { rows: sydRows } = await client.query(
          `SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.salaries_cost, syd.management_costs, s.country_id
           FROM step_yearly_data syd
           JOIN steps s ON s.id = syd.step_id
           WHERE syd.step_id = ANY($1::int[]) AND syd.year = $2`,
          [stepIds, year]
        );

        if (!sydRows.length) {
          console.warn('[recomputeItCosts] no step_yearly_data for provided steps/year for cost', cost.id);
          continue;
        }
        // If cost.type is 'License Per Use' use different allocation formula
        if (String(cost.type) === 'License Per Use') {
          // gather unique country_ids to fetch npt_rate mappings
          const countryIds = Array.from(new Set(sydRows.map((r: any) => Number(r.country_id)).filter((n: number) => !isNaN(n))));
          const nptMap: Record<number, number> = {};
          if (countryIds.length) {
            const pcRes = await client.query(
              `SELECT country_id, npt_rate FROM project_countries WHERE project_id=$1 AND country_id = ANY($2::int[])`,
              [projectId, countryIds]
            );
            for (const row of pcRes.rows) nptMap[Number(row.country_id)] = Number(row.npt_rate || 0);
          }

          for (const r of sydRows) {
            try {
              const countryId = Number(r.country_id);
              const annualHours = await calcAnnualHours({ projectId: Number(projectId), countryId, db: client });
              if (!(annualHours > 0)) {
                console.warn('[recomputeItCosts] invalid annualHours for country', countryId, 'skipping syd', r.syd_id);
                continue;
              }
              const npt = Number(nptMap[countryId] || 0);
              const denom = 1 - (npt / 100);
              if (!(denom > 0)) {
                console.warn('[recomputeItCosts] invalid npt_rate leading to denom<=0 for country', countryId, 'skipping syd', r.syd_id);
                continue;
              }
              const process_time = Number(r.process_time || 0);
              const shareRaw = (amount / annualHours) * (process_time / denom);
              // Round to 2 decimals to avoid DB integer truncation or very small values
              const share = Math.round(shareRaw * 100) / 100;
              try {
                await client.query(
                  `UPDATE step_yearly_data SET it_recurrent_costs = COALESCE(it_recurrent_costs,0) + $1 WHERE id = $2`,
                  [share, r.syd_id]
                );
                console.debug('[recomputeItCosts] applied license-per-use share to it_recurrent_costs', { costId: cost.id, syd_id: r.syd_id, share });
              } catch (err) {
                // Fallback: if column doesn't exist, write to it_costs so values persist
                console.warn('[recomputeItCosts] failed to write it_recurrent_costs, falling back to it_costs:', String(err));
                try {
                  await client.query(`UPDATE step_yearly_data SET it_costs = COALESCE(it_costs,0) + $1 WHERE id = $2`, [share, r.syd_id]);
                  console.debug('[recomputeItCosts] applied license-per-use share to it_costs (fallback)', { costId: cost.id, syd_id: r.syd_id, share });
                } catch (err2) {
                  console.error('[recomputeItCosts] fallback write to it_costs also failed for syd', r.syd_id, String(err2));
                }
              }
            } catch (err) {
              console.warn('[recomputeItCosts] error computing license-per-use for syd', r.syd_id, err);
            }
          }
        } else {
          // Compute per-step weight: prefer salaries+management; if zero fallback to process_time; if still zero use 1
          let weights = sydRows.map((r: any) => {
            const pt = Number(r.process_time || 0);
            const salMgmt = Number(r.salaries_cost || 0) + Number(r.management_costs || 0);
            const w = salMgmt > 0 ? salMgmt : (pt > 0 ? pt : 1);
            return {
              syd_id: r.syd_id,
              step_id: r.step_id,
              pt,
              salMgmt,
              w
            };
          });

          let sumW = weights.reduce((acc, x) => acc + x.w, 0);

          // If sumW is zero (all weights zero) normalize to equal weights to avoid NaN shares
          if (!(sumW > 0)) {
            console.warn('[recomputeItCosts] sumW is zero or invalid for it_costs allocation, falling back to equal weights', { costId: cost.id, weights });
            weights = weights.map((w) => ({ ...w, w: 1 }));
            sumW = weights.length;
          }

          console.debug('[recomputeItCosts] computed weights', { costId: cost.id, sumW, weights: weights.map(w => ({ syd_id: w.syd_id, step_id: w.step_id, w: w.w, salMgmt: w.salMgmt, pt: w.pt })) });

          for (const w of weights) {
            const share = amount * (w.w / sumW);
            await client.query(
              `UPDATE step_yearly_data SET it_costs = COALESCE(it_costs,0) + $1 WHERE id = $2`,
              [share, w.syd_id]
            );
            console.debug('[recomputeItCosts] applied share', { costId: cost.id, syd_id: w.syd_id, share });
          }
        }
      }

      // 5) IT premium for hardware=true
      const premiumQ = `
        WITH syd_target AS (
          SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.hardware
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
          SELECT st.step_id, st.country_id, pc.it_cost, pc.npt_rate
          FROM step_country st
          JOIN project_countries pc
            ON pc.project_id = $3 AND pc.country_id = st.country_id
        )
        SELECT st.syd_id, st.step_id, st.process_time, st.hardware, p.it_cost, p.npt_rate
        FROM syd_target st
        LEFT JOIN params p ON p.step_id = st.step_id
      `;

      const { rows: premiumRows } = await client.query(premiumQ, [projectId, year, projectId]);
      console.debug('[recomputeItCosts] premiumRows count', premiumRows.length);
      for (const r of premiumRows) {
        if (!r.hardware) continue;
        const itCost = Number(r.it_cost || 0);
        const npt = Number(r.npt_rate || 0);
        if (!itCost || npt >= 100) {
          console.warn('[recomputeItCosts] skipping IT premium for syd', r.syd_id, 'project', projectId, 'country missing or npt>=100');
          continue;
        }
        const premium = Number(r.process_time || 0) * itCost / (1 - (npt / 100));
        try {
          await client.query(`UPDATE step_yearly_data SET it_recurrent_costs = COALESCE(it_recurrent_costs,0) + $1 WHERE id = $2`, [premium, r.syd_id]);
          console.debug('[recomputeItCosts] applied IT premium to it_recurrent_costs', { syd_id: r.syd_id, premium, itCost, npt });
        } catch (err) {
          // Fallback to legacy column it_costs if it_recurrent_costs missing
          console.warn('[recomputeItCosts] failed to write IT premium to it_recurrent_costs, falling back to it_costs:', String(err));
          try {
            await client.query(`UPDATE step_yearly_data SET it_costs = COALESCE(it_costs,0) + $1 WHERE id = $2`, [premium, r.syd_id]);
            console.debug('[recomputeItCosts] applied IT premium to it_costs (fallback)', { syd_id: r.syd_id, premium, itCost, npt });
          } catch (err2) {
            console.error('[recomputeItCosts] fallback write for IT premium also failed for syd', r.syd_id, String(err2));
          }
        }
      }

      // --- Travel costs: allocate non-reinvoiced travel costs to travel_costs by weights ---
      const { rows: travelCosts } = await client.query(
        `SELECT id, quantity, unit_cost, type, year, reinvoiced FROM project_non_operational_costs
         WHERE project_id=$1 AND context='travel' AND (reinvoiced IS NULL OR reinvoiced = false) AND (year IS NULL OR year=$2)`,
        [projectId, year]
      );
      console.debug('[recomputeItCosts] travelCosts count', travelCosts.length);
      console.debug('[recomputeItCosts] travelCosts rows', travelCosts.map((c: any) => ({ id: c.id, type: c.type, year: c.year, quantity: c.quantity, unit_cost: c.unit_cost, reinvoiced: c.reinvoiced })));

      for (const cost of travelCosts) {
        const amount = Number(cost.quantity || 0) * Number(cost.unit_cost || 0);
        console.debug('[recomputeItCosts] processing travel cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, amount });
        if (!amount) {
          console.debug('[recomputeItCosts] skipping zero amount travel cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, year: cost.year });
          continue;
        }

        // associated steps
        const { rows: assocT } = await client.query(
          'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1',
          [cost.id]
        );
        let stepIdsT = assocT.map((r: any) => r.step_id);

        // fallback: all project steps with syd for the year
        if (!stepIdsT.length) {
          const { rows: allRows } = await client.query(
            `SELECT syd.step_id
               FROM step_yearly_data syd
               JOIN steps s ON s.id = syd.step_id
               JOIN deliverables d ON d.id = s.deliverable_id
               JOIN workpackages wp ON wp.id = d.workpackage_id
               WHERE wp.project_id = $1
                 AND syd.year = $2`,
            [projectId, year]
          );
          stepIdsT = allRows.map((r: any) => r.step_id);
          console.debug('[recomputeItCosts] fallback to all project steps for travel cost', { costId: cost.id, chosenSteps: stepIdsT.length });
          if (!stepIdsT.length) {
            console.warn('[recomputeItCosts] no candidate steps for travel cost', cost.id, 'project', projectId, 'year', year);
            continue;
          }
        }

        const { rows: sydRowsT } = await client.query(
          `SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.salaries_cost, syd.management_costs
           FROM step_yearly_data syd
           JOIN steps s ON s.id = syd.step_id
           WHERE syd.step_id = ANY($1::int[]) AND syd.year = $2`,
          [stepIdsT, year]
        );

        if (!sydRowsT.length) {
          console.warn('[recomputeItCosts] no step_yearly_data for provided steps/year for travel cost', cost.id);
          continue;
        }

        // Compute weights exactly like it_costs allocation
        let weightsT = sydRowsT.map((r: any) => {
          const pt = Number(r.process_time || 0);
          const salMgmt = Number(r.salaries_cost || 0) + Number(r.management_costs || 0);
          const w = salMgmt > 0 ? salMgmt : (pt > 0 ? pt : 1);
          return {
            syd_id: r.syd_id,
            step_id: r.step_id,
            pt,
            salMgmt,
            w
          };
        });

        let sumWT = weightsT.reduce((acc, x) => acc + x.w, 0);
        if (!(sumWT > 0)) {
          console.warn('[recomputeItCosts] sumWT is zero or invalid for travel allocation, using equal weights', { costId: cost.id });
          weightsT = weightsT.map(w => ({ ...w, w: 1 }));
          sumWT = weightsT.length;
        }
        console.debug('[recomputeItCosts] computed travel weights', { costId: cost.id, sumW: sumWT, weights: weightsT.map(w => ({ syd_id: w.syd_id, step_id: w.step_id, w: w.w, salMgmt: w.salMgmt, pt: w.pt })) });

        for (const w of weightsT) {
          const share = amount * (w.w / sumWT);
          await client.query(
            `UPDATE step_yearly_data SET travel_costs = COALESCE(travel_costs,0) + $1 WHERE id = $2`,
            [share, w.syd_id]
          );
          console.debug('[recomputeItCosts] applied travel share', { costId: cost.id, syd_id: w.syd_id, share });
        }
      }

      // --- Subcontract costs: allocate all non-reinvoiced subcontract costs to subco_costs by weights ---
      const { rows: subcoCosts } = await client.query(
        `SELECT id, quantity, unit_cost, type, year, reinvoiced FROM project_non_operational_costs
         WHERE project_id=$1 AND context='subcontract' AND (reinvoiced IS NULL OR reinvoiced = false) AND (year IS NULL OR year=$2)`,
        [projectId, year]
      );
      console.debug('[recomputeItCosts] subcoCosts count', subcoCosts.length);
      console.debug('[recomputeItCosts] subcoCosts rows', subcoCosts.map((c: any) => ({ id: c.id, type: c.type, year: c.year, quantity: c.quantity, unit_cost: c.unit_cost, reinvoiced: c.reinvoiced })));

      for (const cost of subcoCosts) {
        const amount = Number(cost.quantity || 0) * Number(cost.unit_cost || 0);
        console.debug('[recomputeItCosts] processing subcontract cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, amount });
        if (!amount) {
          console.debug('[recomputeItCosts] skipping zero amount subcontract cost', { costId: cost.id, quantity: cost.quantity, unit_cost: cost.unit_cost, year: cost.year });
          continue;
        }

        // associated steps
        const { rows: assocS } = await client.query(
          'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1',
          [cost.id]
        );
        let stepIdsS = assocS.map((r: any) => r.step_id);

        // fallback: all project steps with syd for the year
        if (!stepIdsS.length) {
          const { rows: allRows } = await client.query(
            `SELECT syd.step_id
               FROM step_yearly_data syd
               JOIN steps s ON s.id = syd.step_id
               JOIN deliverables d ON d.id = s.deliverable_id
               JOIN workpackages wp ON wp.id = d.workpackage_id
               WHERE wp.project_id = $1
                 AND syd.year = $2`,
            [projectId, year]
          );
          stepIdsS = allRows.map((r: any) => r.step_id);
          console.debug('[recomputeItCosts] fallback to all project steps for subcontract cost', { costId: cost.id, chosenSteps: stepIdsS.length });
          if (!stepIdsS.length) {
            console.warn('[recomputeItCosts] no candidate steps for subcontract cost', cost.id, 'project', projectId, 'year', year);
            continue;
          }
        }

        const { rows: sydRowsS } = await client.query(
          `SELECT syd.id AS syd_id, syd.step_id, syd.process_time, syd.salaries_cost, syd.management_costs
           FROM step_yearly_data syd
           JOIN steps s ON s.id = syd.step_id
           WHERE syd.step_id = ANY($1::int[]) AND syd.year = $2`,
          [stepIdsS, year]
        );

        if (!sydRowsS.length) {
          console.warn('[recomputeItCosts] no step_yearly_data for provided steps/year for subcontract cost', cost.id);
          continue;
        }

        // Compute weights exactly like it_costs allocation
        let weightsS = sydRowsS.map((r: any) => {
          const pt = Number(r.process_time || 0);
          const salMgmt = Number(r.salaries_cost || 0) + Number(r.management_costs || 0);
          const w = salMgmt > 0 ? salMgmt : (pt > 0 ? pt : 1);
          return {
            syd_id: r.syd_id,
            step_id: r.step_id,
            pt,
            salMgmt,
            w
          };
        });

        let sumWS = weightsS.reduce((acc, x) => acc + x.w, 0);
        if (!(sumWS > 0)) {
          console.warn('[recomputeItCosts] sumWS is zero or invalid for subcontract allocation, using equal weights', { costId: cost.id });
          weightsS = weightsS.map(w => ({ ...w, w: 1 }));
          sumWS = weightsS.length;
        }
        console.debug('[recomputeItCosts] computed subcontract weights', { costId: cost.id, sumW: sumWS, weights: weightsS.map(w => ({ syd_id: w.syd_id, step_id: w.step_id, w: w.w, salMgmt: w.salMgmt, pt: w.pt })) });

        for (const w of weightsS) {
          const share = amount * (w.w / sumWS);
          await client.query(
            `UPDATE step_yearly_data SET subco_costs = COALESCE(subco_costs,0) + $1 WHERE id = $2`,
            [share, w.syd_id]
          );
          console.debug('[recomputeItCosts] applied subcontract share', { costId: cost.id, syd_id: w.syd_id, share });
        }
      }

      await client.query('COMMIT');
      console.info('[recomputeItCosts] finished successfully', { projectId, year });
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      (client as any)?.release?.();
    }
  } catch (err) {
    console.error('Error recomputing IT costs:', err);
    res.status(500).json({ error: 'Error recomputando IT costs' });
  }
};