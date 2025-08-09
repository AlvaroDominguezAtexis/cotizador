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
    reinvoiced = false
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
    const result = await Pool.query(q, values);
    res.status(201).json(normalizeRow(result.rows[0]));
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
    reinvoiced
  } = req.body;

  try {
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

    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });

    add('updated_at', new Date());

    const query = `
      UPDATE project_non_operational_costs
      SET ${fields.join(', ')}
      WHERE id=$${idx} AND project_id=$${idx + 1}
      RETURNING *;
    `;
    values.push(id, projectId);

    const result = await Pool.query(query, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Coste no encontrado' });
    res.json(normalizeRow(result.rows[0]));
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