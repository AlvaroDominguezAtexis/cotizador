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

  // Build deliverables array with yearlyQuantities for the cost calculation helper
  const byDel: Record<number, number[]> = {};
  for (const q of qtyRes.rows) {
    const id = q.deliverable_id;
    byDel[id] = byDel[id] || [];
    byDel[id][q.year_number - 1] = Number(q.quantity || 0);
  }
  const deliverablesForCalc: { id: number; yearlyQuantities?: number[] }[] = deliverableIds.map(id => ({ id, yearlyQuantities: byDel[id] || [] }));

  // compute costs (per deliverable per ordinal year) using the new helper
  const costRows = await calcDeliverablesCosts(deliverablesForCalc, projectStartYear ? String(projectStartYear) : undefined, db);

  const rows: YearlyCalcRow[] = [];
  const mg = Number(margin_goal);
  const mgFrac = mg / 100;

  // index costRows by deliverableId and year_number for quick lookup
  const costIndex: Record<string, { opRecurrentSum: number; opNonRecurrentSum: number; nopSum: number }> = {};
  for (const cr of costRows) {
    costIndex[`${cr.deliverableId}_${cr.year_number}`] = { opRecurrentSum: cr.opRecurrentSum, opNonRecurrentSum: cr.opNonRecurrentSum, nopSum: cr.nopSum };
  }

  for (const q of qtyRes.rows) {
    const deliverableId = q.deliverable_id;
    const year = q.year_number;
    const quantity = Number(q.quantity || 0);
    const key = `${deliverableId}_${year}`;
    const costs = costIndex[key] || { opRecurrentSum: 0, opNonRecurrentSum: 0, nopSum: 0 };
    const opRecurrentSum = Number(costs.opRecurrentSum || 0);
    const opNonRecurrentSum = Number(costs.opNonRecurrentSum || 0);
    const nopSum = Number(costs.nopSum || 0);
    const opCostYear = opRecurrentSum * Number(quantity) + opNonRecurrentSum;
    const nopCostYear = nopSum * Number(quantity);

    // Debug logs
    console.log('[recalcDeliverablesYearlyForProject] startRow', { deliverableId, year, quantity, opRecurrentSum, opNonRecurrentSum, nopSum, opCostYear, nopCostYear });

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

export interface DeliverableCostRow {
  deliverableId: number;
  year_number: number;
  calendarYear: number;
  opRecurrentSum: number;
  opNonRecurrentSum: number;
  nopSum: number;
}

// Calculate costs (recurrent op, non-recurrent op, non-operational) for an array of deliverables.
// Each deliverable has { id, yearlyQuantities?: number[] } where index 0 -> year_number 1.
export async function calcDeliverablesCosts(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<DeliverableCostRow[]> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return [];
  const projectStartYear = projectStartDate ? new Date(projectStartDate).getFullYear() : new Date().getFullYear();

  const tuples: number[] = [];
  const valuesParts: string[] = [];
  let paramIdx = 1;
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const calendarYear = projectStartYear + i;
      valuesParts.push(`($${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::int)`); // id, calendarYear, year_number
      tuples.push(id, calendarYear, i + 1);
    }
  }
  if (valuesParts.length === 0) return [];

  const valuesSql = valuesParts.join(',');
  const q = `
    WITH dy(did, year, year_number) AS (VALUES ${valuesSql})
    SELECT dy.did AS deliverable_id, dy.year_number::int AS year_number, dy.year::int AS calendar_year,
      COALESCE(SUM(
        COALESCE(syd.salaries_cost,0) + COALESCE(syd.management_costs,0) + COALESCE(syd.it_recurrent_costs,0) + COALESCE(syd.premises_costs,0)
      ),0)::numeric AS op_recurrent_sum,
      COALESCE(SUM(
        COALESCE(syd.it_costs,0) + COALESCE(syd.travel_costs,0) + COALESCE(syd.subco_costs,0) + COALESCE(syd.purchases_costs,0)
      ),0)::numeric AS op_non_recurrent_sum,
      0::numeric AS nop_sum
    FROM steps s
    JOIN dy ON dy.did = s.deliverable_id
    JOIN step_yearly_data syd ON syd.step_id = s.id AND syd.year = dy.year
    GROUP BY dy.did, dy.year_number, dy.year
  `;

  const r = await db.query<{ deliverable_id: number; year_number: number; calendar_year: number; op_recurrent_sum: string; op_non_recurrent_sum: string; nop_sum: string }>(q, tuples);
  const resRows = r.rows || [];

  // Build map for quick lookup
  const byKey: Record<string, DeliverableCostRow> = {};
  for (const rr of resRows) {
    const did = Number(rr.deliverable_id);
    const yrn = Number(rr.year_number);
    byKey[`${did}_${yrn}`] = {
      deliverableId: did,
      year_number: yrn,
      calendarYear: Number(rr.calendar_year),
      opRecurrentSum: Number(rr.op_recurrent_sum || 0),
      opNonRecurrentSum: Number(rr.op_non_recurrent_sum || 0),
      nopSum: Number(rr.nop_sum || 0),
    };
  }

  const out: DeliverableCostRow[] = [];
  // ensure we return an entry for every deliverable-year requested (zeros when missing)
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      const existing = byKey[`${id}_${year_number}`];
      if (existing) out.push(existing);
      else out.push({ deliverableId: id, year_number, calendarYear: projectStartYear + (year_number - 1), opRecurrentSum: 0, opNonRecurrentSum: 0, nopSum: 0 });
    }
  }

  return out;
}

// Calculate operational DM for a set of deliverables.
// - deliverables: array of { id, yearlyQuantities?: number[] }
// - projectStartDate: optional project start date to map ordinal years
// Returns totals and the computed operational DM: (1 - (operationalCosts / TO)) * 100
export async function calcOperationalDMForDeliverables(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<{ totalOpRecurrent: number; totalOpNonRecurrent: number; totalNop: number; totalOperationalCosts: number; totalTO: number; projectDM: number }> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalOperationalCosts: 0, totalTO: 0, projectDM: 0 };
  }

  // use the existing helper to get per-deliverable-year cost sums
  const costRows = await calcDeliverablesCosts(deliverables, projectStartDate, db);

  // build a map of quantities by deliverable-year from the input deliverables array
  const qtyMap: Record<string, number> = {};
  for (const d of deliverables) {
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      qtyMap[`${d.id}_${year_number}`] = Number(yq[i] || 0);
    }
  }

  let totalOpRecurrent = 0;
  let totalOpNonRecurrent = 0;
  let totalNop = 0;
  let totalOperationalCosts = 0;

  for (const cr of costRows) {
    const key = `${cr.deliverableId}_${cr.year_number}`;
    const qty = Number(qtyMap[key] || 0);
    const opRecurrentContribution = Number(cr.opRecurrentSum || 0) * qty;
    const opNonRecurrentContribution = Number(cr.opNonRecurrentSum || 0);
    const nopContribution = Number(cr.nopSum || 0) * qty;

    totalOpRecurrent += opRecurrentContribution;
    totalOpNonRecurrent += opNonRecurrentContribution;
    totalNop += nopContribution;
    totalOperationalCosts += opRecurrentContribution + opNonRecurrentContribution; // operational costs include both
  }

  // compute TO as sum of deliverable_yearly_quantities.operational_to for the deliverables provided
  const ids = deliverables.map(d => d.id);
  const q = `SELECT COALESCE(SUM(operational_to),0)::numeric AS total_to FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[])`;
  const r = await db.query<{ total_to: string }>(q, [ids]);
  const totalTO = Number(r.rows[0]?.total_to || 0);

  let projectDM = 0;
  if (totalTO > 0) {
    projectDM = Number(((1 - (totalOperationalCosts / totalTO)) * 100).toFixed(2));
  }

  return { totalOpRecurrent: round2(totalOpRecurrent), totalOpNonRecurrent: round2(totalOpNonRecurrent), totalNop: round2(totalNop), totalOperationalCosts: round2(totalOperationalCosts), totalTO: round2(totalTO), projectDM };
}

// Calculate GMBS for a set of deliverables.
// GMBS = (1 - (opCost + nopCost) / TO) * 100
export async function calcGMBSForDeliverables(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<{ totalOpRecurrent: number; totalOpNonRecurrent: number; totalNop: number; totalOperationalCosts: number; totalTO: number; projectGMBS: number }> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalOperationalCosts: 0, totalTO: 0, projectGMBS: 0 };
  }

  // reuse cost calculation helper
  const costRows = await calcDeliverablesCosts(deliverables, projectStartDate, db);

  const qtyMap: Record<string, number> = {};
  for (const d of deliverables) {
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      qtyMap[`${d.id}_${year_number}`] = Number(yq[i] || 0);
    }
  }

  let totalOpRecurrent = 0;
  let totalOpNonRecurrent = 0;
  let totalNop = 0;
  let totalOperationalCosts = 0;

  for (const cr of costRows) {
    const key = `${cr.deliverableId}_${cr.year_number}`;
    const qty = Number(qtyMap[key] || 0);
    const opRecurrentContribution = Number(cr.opRecurrentSum || 0) * qty;
    const opNonRecurrentContribution = Number(cr.opNonRecurrentSum || 0);
    const nopContribution = Number(cr.nopSum || 0) * qty;

    totalOpRecurrent += opRecurrentContribution;
    totalOpNonRecurrent += opNonRecurrentContribution;
    totalNop += nopContribution;
    totalOperationalCosts += opRecurrentContribution + opNonRecurrentContribution;
  }

  const ids = deliverables.map(d => d.id);
  const q = `SELECT COALESCE(SUM(operational_to),0)::numeric AS total_to FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[])`;
  const r = await db.query<{ total_to: string }>(q, [ids]);
  const totalTO = Number(r.rows[0]?.total_to || 0);

  let projectGMBS = 0;
  if (totalTO > 0) {
    projectGMBS = Number(((1 - ((totalOperationalCosts + totalNop) / totalTO)) * 100).toFixed(2));
  }

  return { totalOpRecurrent: round2(totalOpRecurrent), totalOpNonRecurrent: round2(totalOpNonRecurrent), totalNop: round2(totalNop), totalOperationalCosts: round2(totalOperationalCosts), totalTO: round2(totalTO), projectGMBS };
}

// Compute total working time for a project: SUM(step_yearly_data.process_time * deliverable_yearly_quantities.quantity)
// Compute total working time from an array of deliverables. Each deliverable should
// be an object { id: number, yearlyQuantities?: number[] } where yearlyQuantities
// is an array indexed by ordinal year (index 0 -> year_number 1) with the quantity.
// projectStartDate is optional; if provided it is used to map ordinal year -> calendar year,
// otherwise current year is used as baseline.
export async function calcProjectTotalWorkingTime(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<number> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return 0;

  const projectStartYear = projectStartDate ? new Date(projectStartDate).getFullYear() : new Date().getFullYear();

  // Build a VALUES list of (deliverable_id, calendar_year, quantity) from the deliverables' yearlyQuantities
  const tuples: Array<number> = []; // will hold params in order
  const valuesParts: string[] = [];
  let paramIdx = 1;
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const qty = Number(yq[i] || 0);
      const calendarYear = projectStartYear + i; // year_number = i+1 -> calendarYear = startYear + (year_number-1)
    // cast to ensure Postgres infers the correct types (int for ids/years, numeric for quantities)
    valuesParts.push(`($${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::numeric)`);
      tuples.push(id, calendarYear, qty);
    }
  }

  if (valuesParts.length === 0) return 0;

  const valuesSql = valuesParts.join(',');

  const q = `
    WITH dy(did, year, qty) AS (VALUES ${valuesSql})
    SELECT COALESCE(SUM(syd.process_time * dy.qty),0)::numeric AS total_work_time
    FROM steps s
    JOIN step_yearly_data syd ON syd.step_id = s.id
    JOIN dy ON dy.did = s.deliverable_id AND syd.year = dy.year
  `;

  const r = await db.query<{ total_work_time: string }>(q, tuples);
  const val = r.rows[0] ? Number(r.rows[0].total_work_time || 0) : 0;
  console.log('[calcProjectTotalWorkingTime] deliverableCount', deliverables.length, { totalWorkTime: val });
  return val;
}
