import { Request, Response } from 'express';
import Pool from '../../db';

const VALID_CONTEXT = ['it', 'subcontract', 'travel'];
const VALID_ASSIGNATION = ['project', 'per use'];

const normalizeRow = (r: any) => ({
  id: r.id,
  project_id: r.project_id,
  context: r.context,
  type: r.type,
  concept: r.concept,
  quantity: Number(r.quantity),
  unit_cost: Number(r.unit_cost),
  assignation: r.assignation,
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
    const result = await Pool.query(query, params);
    res.json(result.rows.map(normalizeRow));
  } catch (err) {
    console.error('Error listando non operational costs:', err);
    res.status(500).json({ error: 'Error obteniendo costes' });
  }
};

// GET /projects/:projectId/non-operational-costs/:id
export const getNonOperationalCostById = async (req: Request, res: Response) => {
  const { projectId, id } = req.params as any;
  try {
    const { rows } = await Pool.query(
      'SELECT * FROM project_non_operational_costs WHERE id=$1 AND project_id=$2',
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Coste no encontrado' });
    const row = normalizeRow(rows[0]);
    if (row.assignation === 'per use') {
      const { rows: sRows } = await Pool.query(
        'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1 ORDER BY step_id ASC',
        [id]
      );
      (row as any).step_ids = sRows.map((r) => r.step_id);
    }
    res.json(row);
  } catch (err) {
    console.error('Error obteniendo coste:', err);
    res.status(500).json({ error: 'Error obteniendo coste' });
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
    assignation,
    year = null,
    reinvoiced = false,
    step_ids
  } = req.body;

  if (!VALID_CONTEXT.includes(context)) {
    return res.status(400).json({ error: 'Context inválido' });
  }
  if (!VALID_ASSIGNATION.includes(assignation)) {
    return res.status(400).json({ error: 'Assignation inválida' });
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
        (project_id, context, type, concept, quantity, unit_cost, assignation, year, reinvoiced)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *;
      `;
      const values = [
        projectId,
        context,
        type,
        concept,
        quantity,
        unit_cost,
        assignation,
        year,
        reinvoiced
      ];
      const result = await client.query(q, values);
      const created = normalizeRow(result.rows[0]);

      const stepIds = parseStepIds(step_ids) || [];
      if (created.assignation === 'per use' && stepIds.length) {
        const ok = await validateStepsBelongToProject(client, stepIds, Number(projectId));
        if (!ok) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Algunos steps no pertenecen al proyecto' });
        }
        await client.query(
          `INSERT INTO step_non_operational_costs (step_id, cost_id)
           SELECT unnest($1::int[]), $2`,
          [stepIds, created.id]
        );
        (created as any).step_ids = stepIds;
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
    assignation,
    year,
    reinvoiced,
    step_ids
  } = req.body;

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
      if (assignation) {
        if (!VALID_ASSIGNATION.includes(assignation)) return res.status(400).json({ error: 'Assignation inválida' });
        add('assignation', assignation);
      }
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

      // Determine target assignation for associations handling
      const targetAssignation = assignation || current.assignation;
      const hasStepIds = step_ids !== undefined;
      const stepIds = parseStepIds(step_ids) || [];

      if (targetAssignation === 'per use' && hasStepIds) {
        // Replace associations only when payload provides step_ids
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
        }
      } else if (targetAssignation !== 'per use') {
        // Ensure no leftover associations
        await client.query('DELETE FROM step_non_operational_costs WHERE cost_id=$1', [id]);
      }

      // Always include current step_ids in response when per use
      if (targetAssignation === 'per use') {
        const { rows: sRows } = await client.query(
          'SELECT step_id FROM step_non_operational_costs WHERE cost_id=$1 ORDER BY step_id ASC',
          [id]
        );
        (updated as any).step_ids = sRows.map((r) => r.step_id);
      }

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
    const result = await Pool.query(
      'DELETE FROM project_non_operational_costs WHERE id=$1 AND project_id=$2 RETURNING id',
      [id, projectId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Coste no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando coste:', err);
    res.status(500).json({ error: 'Error eliminando coste' });
  }
};