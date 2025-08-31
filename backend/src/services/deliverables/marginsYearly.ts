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
  const pRes = await db.query<{ margin_type: string; margin_goal: number; start_date?: string }>(`SELECT margin_type, margin_goal, start_date FROM projects WHERE id=$1`, [projectId]);
  if (!pRes.rows || pRes.rows.length === 0) throw new Error('Project not found');
  const { margin_type, margin_goal } = pRes.rows[0];
  if (margin_type == null || margin_goal == null) throw new Error('Project margin_type or margin_goal undefined');

  // 2) get deliverable ids for project (deliverables -> workpackages -> projects)
  const dRes = await db.query<{ id: number }>(`SELECT d.id FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1`, [projectId]);
  const deliverableIds = dRes.rows.map(r => r.id);
  if (deliverableIds.length === 0) return [];

  // We'll compute per-year sums by querying step_yearly_data filtered by the project's calendar year
  // Fetch project start year to map ordinal year -> calendar year
  const startDateRaw: any = pRes.rows[0]?.start_date;
  const projectStartYear = startDateRaw ? new Date(startDateRaw).getFullYear() : undefined;
  if (!projectStartYear) {
    // If no start_date, we will assume current year as baseline
    console.warn('[recalcDeliverablesYearlyForProject] project has no start_date; using current year as baseline');
  }

  // 4) get all yearly quantities for these deliverables
  const qtyRes = await db.query<{ deliverable_id: number; year_number: number; quantity: number }>(`SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) ORDER BY deliverable_id, year_number`, [deliverableIds]);

  const rows: YearlyCalcRow[] = [];
  const mg = Number(margin_goal);
  const mgFrac = mg / 100;

  for (const q of qtyRes.rows) {
    const deliverableId = q.deliverable_id;
    const year = q.year_number;
    const quantity = Number(q.quantity || 0);
    // Determine calendar year for this ordinal year
    const targetYear = (projectStartYear || new Date().getFullYear()) + (year - 1);

    // Sum operational and non-operational costs from step_yearly_data for this deliverable and targetYear
    const sumsRes = await db.query<{
      op_recurrent_sum: string;
      op_non_recurrent_sum: string;
      nop_sum: string;
    }>(
      `SELECT
         COALESCE(SUM(
           COALESCE(syd.salaries_cost,0) + COALESCE(syd.management_costs,0) + COALESCE(syd.it_recurrent_costs,0) + COALESCE(syd.premises_costs,0)
         ),0)::numeric AS op_recurrent_sum,
         COALESCE(SUM(
           COALESCE(syd.it_costs,0) + COALESCE(syd.travel_costs,0) + COALESCE(syd.subco_costs,0) + COALESCE(syd.purchases_costs,0)
         ),0)::numeric AS op_non_recurrent_sum,
         COALESCE(SUM(
           COALESCE(syd.non_productive_costs_of_productive_staff,0) + COALESCE(syd.it_production_support,0) +
           COALESCE(syd.operational_quality_costs,0) + COALESCE(syd.operations_management_costs,0) +
           COALESCE(syd.lean_management_costs,0)
         ),0)::numeric AS nop_sum
       FROM steps s
       JOIN step_yearly_data syd ON syd.step_id = s.id
      WHERE s.deliverable_id = $1 AND syd.year = $2`,
      [deliverableId, targetYear]
    );

    const opRecurrentSum = Number(sumsRes.rows[0]?.op_recurrent_sum || 0);
    const opNonRecurrentSum = Number(sumsRes.rows[0]?.op_non_recurrent_sum || 0);
    const nopSum = Number(sumsRes.rows[0]?.nop_sum || 0);
    const opCostYear = opRecurrentSum * Number(quantity) + opNonRecurrentSum;
    const nopCostYear = nopSum * Number(quantity);

    // Debug logs for monitoring intermediate values
    console.log('[recalcDeliverablesYearlyForProject] startRow', { deliverableId, year, quantity, targetYear, opRecurrentSum, opNonRecurrentSum, nopSum, opCostYear, nopCostYear });

    let operationalTo = 0;
    let dmRealPct = 0;
    let gmbsRealPct = 0;

    if (String(margin_type).toUpperCase() === 'DM') {
      dmRealPct = mg; // already percent
      const denom = 1 - mgFrac;
  console.log('[recalcDeliverablesYearlyForProject] DM preCalc', { mg, mgFrac, denom, opCostYear, nopCostYear });
      if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
      operationalTo = opCostYear / denom;
  gmbsRealPct = (1 - ((opCostYear + nopCostYear) / operationalTo)) * 100;
  console.log('[recalcDeliverablesYearlyForProject] DM postCalc', { operationalTo, dmRealPct, gmbsRealPct });
    } else if (String(margin_type).toUpperCase() === 'GMBS') {
      gmbsRealPct = mg;
      const denom = 1 - (mgFrac);
  console.log('[recalcDeliverablesYearlyForProject] GMBS preCalc', { mg, mgFrac, denom, opCostYear, nopCostYear });
      if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
      operationalTo = (opCostYear + nopCostYear) / denom;
  dmRealPct = (1 - (opCostYear / operationalTo)) * 100;
  console.log('[recalcDeliverablesYearlyForProject] GMBS postCalc', { operationalTo, dmRealPct, gmbsRealPct });
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
