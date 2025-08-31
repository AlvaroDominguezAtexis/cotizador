import type { QueryResult } from 'pg';

export interface DB { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }>; }

export interface YearlyCalcRow {
  deliverableId: number;
  year: number;
  quantity: number;
  operationalTo: number;
  dmRealPct: number;   // already *100
  gmbsRealPct: number; // already *100
  opCostYear: number;
  nopCostYear: number;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function recalcDeliverablesYearlyForProject(projectId: number, db: DB): Promise<YearlyCalcRow[]> {
  // 1) get project margin info
  const pRes = await db.query<{ margin_type: string; margin_goal: number }>(`SELECT margin_type, margin_goal FROM projects WHERE id=$1`, [projectId]);
  if (!pRes.rows || pRes.rows.length === 0) throw new Error('Project not found');
  const { margin_type, margin_goal } = pRes.rows[0];
  if (margin_type == null || margin_goal == null) throw new Error('Project margin_type or margin_goal undefined');

  // 2) get deliverable ids for project (deliverables -> workpackages -> projects)
  const dRes = await db.query<{ id: number }>(`SELECT d.id FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1`, [projectId]);
  const deliverableIds = dRes.rows.map(r => r.id);
  if (deliverableIds.length === 0) return [];

  // 3) compute base costs per deliverable (op_base, nop_base)
  const costsSql = `SELECT s.deliverable_id,
    SUM(COALESCE(syd.salaries_cost,0) + COALESCE(syd.management_costs,0) + COALESCE(syd.it_costs,0) +
        COALESCE(syd.it_recurrent_costs,0) + COALESCE(syd.travel_costs,0) + COALESCE(syd.subco_costs,0) +
        COALESCE(syd.purchases_costs,0) + COALESCE(syd.premises_costs,0)) AS op_base,
    SUM(COALESCE(syd.non_productive_costs_of_productive_staff,0) + COALESCE(syd.it_production_support,0) +
        COALESCE(syd.operational_quality_costs,0) + COALESCE(syd.operations_management_costs,0) +
        COALESCE(syd.lean_management_costs,0)) AS nop_base
    FROM steps s
    JOIN step_yearly_data syd ON syd.step_id = s.id
    WHERE s.deliverable_id = ANY($1::int[])
    GROUP BY s.deliverable_id`;

  const baseCostsRes = await db.query<{ deliverable_id: number; op_base: number; nop_base: number }>(costsSql, [deliverableIds]);
  const baseByDeliverable: Record<number, { op_base: number; nop_base: number }> = {};
  baseCostsRes.rows.forEach(r => { baseByDeliverable[r.deliverable_id] = { op_base: Number(r.op_base || 0), nop_base: Number(r.nop_base || 0) }; });

  // 4) get all yearly quantities for these deliverables
  const qtyRes = await db.query<{ deliverable_id: number; year_number: number; quantity: number }>(`SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) ORDER BY deliverable_id, year_number`, [deliverableIds]);

  const rows: YearlyCalcRow[] = [];
  const mg = Number(margin_goal);
  const mgFrac = mg / 100;

  for (const q of qtyRes.rows) {
    const deliverableId = q.deliverable_id;
    const year = q.year_number;
    const quantity = Number(q.quantity || 0);
    const base = baseByDeliverable[deliverableId] || { op_base: 0, nop_base: 0 };
    const opCostYear = Number(base.op_base) * Number(quantity);
    const nopCostYear = Number(base.nop_base) * Number(quantity);

    let operationalTo = 0;
    let dmRealPct = 0;
    let gmbsRealPct = 0;

    if (String(margin_type).toUpperCase() === 'DM') {
      dmRealPct = mg; // already percent
      const denom = 1 - mgFrac;
      if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
      operationalTo = opCostYear / denom;
      gmbsRealPct = (1 - ((opCostYear + nopCostYear) / operationalTo)) * 100;
    } else if (String(margin_type).toUpperCase() === 'GMBS') {
      gmbsRealPct = mg;
      const denom = 1 - (mgFrac);
      if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
      operationalTo = (opCostYear + nopCostYear) / denom;
      dmRealPct = (1 - (opCostYear / operationalTo)) * 100;
    } else {
      throw new Error('Unknown margin_type');
    }

    // rounding
    dmRealPct = round2(dmRealPct);
    gmbsRealPct = round2(gmbsRealPct);
    operationalTo = round2(operationalTo);

    rows.push({ deliverableId, year, quantity, operationalTo, dmRealPct, gmbsRealPct, opCostYear: round2(opCostYear), nopCostYear: round2(nopCostYear) });
  }

  return rows;
}
