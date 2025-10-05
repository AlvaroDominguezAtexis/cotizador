import { Request, Response } from 'express';
import Pool from '../../db';
import { recalcDeliverablesYearlyForProject, calcProjectTotalWorkingTime, calcDeliverableMargins, calcProjectMargins, calcBulkMargins } from '../../services/deliverables/marginsYearly';

// GET /projects/:projectId/operational-revenue
export const getProjectOperationalRevenue = async (req: Request, res: Response) => {
  const projectId = (req.params as any).projectId || (req.params as any).id;
  try {
    const q = `SELECT COALESCE(SUM(dyq.operational_to),0)::numeric AS operational_revenue FROM deliverable_yearly_quantities dyq JOIN deliverables d ON d.id = dyq.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE wp.project_id = $1`;
    const r = await Pool.query<{ operational_revenue: string }>(q, [projectId]);
    const val = r.rows[0] ? Number(r.rows[0].operational_revenue || 0) : 0;
    res.json({ projectId: Number(projectId), operationalRevenue: val });
  } catch (err:any) {
    res.status(500).json({ error: err?.message || 'Error fetching operational revenue' });
  }
};

interface DeliverableRow {
  id: number;
  workpackage_id: number;
  codigo: string;
  nombre: string;
  margin_goal: string; // previously dm
  created_at: Date;
  updated_at: Date;
}

interface YearQuantityRow { deliverable_id: number; year_number: number; quantity: number; }

const normalizeDate = (d: any) => {
  if (!d) return null; const str = d instanceof Date ? d.toISOString() : d.toString(); return str.includes('T') ? str.split('T')[0] : str;
};

const attachYearly = (rows: DeliverableRow[], yearRows: YearQuantityRow[], yearCount?: number) => {
  const byDeliverable: Record<number, YearQuantityRow[]> = {};
  yearRows.forEach(r => { (byDeliverable[r.deliverable_id] = byDeliverable[r.deliverable_id] || []).push(r); });
  return rows.map(r => {
    const list = (byDeliverable[r.id] || []).sort((a,b)=>a.year_number-b.year_number);
    const maxYear = yearCount || (list.length ? list[list.length-1].year_number : 0);
    const yearlyQuantities: number[] = Array.from({ length: maxYear }, (_,i)=> {
      const found = list.find(x=>x.year_number === i+1); return found ? found.quantity : 0; });
    return {
      id: r.id,
      workpackage_id: r.workpackage_id,
      codigo: r.codigo,
      nombre: r.nombre,
      margin_goal: r.margin_goal,
      yearlyQuantities,
      created_at: normalizeDate(r.created_at),
      updated_at: normalizeDate(r.updated_at)
    };
  });
};

// GET /projects/:projectId/workpackages/:workPackageId/deliverables
export const getDeliverables = async (req: Request, res: Response) => {
  const { workPackageId } = req.params;
  const { yearCount } = req.query;
  try {
    const dRes = await Pool.query<DeliverableRow>('SELECT * FROM deliverables WHERE workpackage_id=$1 ORDER BY created_at DESC', [workPackageId]);
    if (dRes.rows.length === 0) return res.json([]);
    const ids = dRes.rows.map(r=>r.id);
    const yRes = await Pool.query<YearQuantityRow>(`SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1)`, [ids]);
    const parsed = attachYearly(dRes.rows, yRes.rows, yearCount ? Number(yearCount) : undefined);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener deliverables' });
  }
};

// POST create deliverable with yearlyQuantities array (relative year index starting at 1)
export const createDeliverable = async (req: Request, res: Response) => {
  const { workPackageId } = req.params;
  try {
    const { codigo, nombre, margin_goal, yearlyQuantities } = req.body;
    if (!codigo || !nombre || margin_goal === undefined) return res.status(400).json({ error: 'codigo, nombre y margin_goal son obligatorios' });
    await Pool.query('BEGIN');
    const dRes = await Pool.query<DeliverableRow>(`INSERT INTO deliverables (workpackage_id, codigo, nombre, margin_goal) VALUES ($1,$2,$3,$4) RETURNING *`, [workPackageId, codigo, nombre, margin_goal]);
    const deliverable = dRes.rows[0];
    if (Array.isArray(yearlyQuantities)) {
      for (let i=0;i<yearlyQuantities.length;i++) {
        const qty = Number(yearlyQuantities[i]);
        if (!isNaN(qty)) {
          await Pool.query(`INSERT INTO deliverable_yearly_quantities (deliverable_id, year_number, quantity) VALUES ($1,$2,$3)`, [deliverable.id, i+1, qty]);
        }
      }
    }
    await Pool.query('COMMIT');
  res.status(201).json({ ...deliverable, yearlyQuantities: yearlyQuantities || [] });
  } catch (err:any) {
    await Pool.query('ROLLBACK');
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Código duplicado para este workpackage' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear deliverable' });
  }
};

// PUT update deliverable and its yearly quantities (upsert style)
export const updateDeliverable = async (req: Request, res: Response) => {
  const { workPackageId, id } = req.params;
  try {
    const { codigo, nombre, margin_goal, yearlyQuantities } = req.body;
    await Pool.query('BEGIN');
    const dRes = await Pool.query<DeliverableRow>(`UPDATE deliverables SET codigo = COALESCE($1,codigo), nombre = COALESCE($2,nombre), margin_goal = COALESCE($3,margin_goal), updated_at=NOW() WHERE id=$4 AND workpackage_id=$5 RETURNING *`, [codigo, nombre, margin_goal, id, workPackageId]);
    if (dRes.rows.length === 0) {
      await Pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Deliverable no encontrado' });
    }
    if (Array.isArray(yearlyQuantities)) {
      for (let i=0;i<yearlyQuantities.length;i++) {
        const qty = Number(yearlyQuantities[i]);
        if (!isNaN(qty)) {
          await Pool.query(`INSERT INTO deliverable_yearly_quantities (deliverable_id, year_number, quantity) VALUES ($1,$2,$3)
            ON CONFLICT (deliverable_id, year_number) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`, [id, i+1, qty]);
        }
      }
    }
    await Pool.query('COMMIT');
    res.json({ ...dRes.rows[0], yearlyQuantities: yearlyQuantities || [] });
  } catch (err:any) {
    await Pool.query('ROLLBACK');
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Código duplicado para este workpackage' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar deliverable' });
  }
};

// DELETE deliverable
export const deleteDeliverable = async (req: Request, res: Response) => {
  const { workPackageId, id } = req.params;
  try {
    const dRes = await Pool.query('DELETE FROM deliverables WHERE id=$1 AND workpackage_id=$2 RETURNING id', [id, workPackageId]);
    if (dRes.rows.length === 0) return res.status(404).json({ error: 'Deliverable no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar deliverable' });
  }
};

// POST /projects/:projectId/recalc-margins-yearly
export const recalcProjectDeliverablesMarginsYearly = async (req: Request, res: Response) => {
  const projectId = (req.params as any).projectId || (req.params as any).id;
  console.log('\n🔄 [recalcProjectDeliverablesMarginsYearly] Starting recalculation for project:', projectId);
  
  try {
    const rows = await recalcDeliverablesYearlyForProject(Number(projectId), Pool as any);
    
    console.log('📊 [recalcProjectDeliverablesMarginsYearly] Calculated rows received:', {
      count: rows.length,
      sampleRow: rows.length > 0 ? rows[0] : 'No data'
    });
    
    await Pool.query('BEGIN');
    let count = 0;
    for (const r of rows) {
      // update existing row
      console.log(`💾 [recalcProjectDeliverablesMarginsYearly] Processing deliverable ${r.deliverableId} year ${r.year}:`, {
        TO: r.operationalTo,
        DM: r.dmRealPct + '%',
        GMBS: r.gmbsRealPct + '%'
      });
      
      const upd = await Pool.query(`UPDATE deliverable_yearly_quantities SET operational_to = $3, dm_real = $4, gmbs_real = $5 WHERE deliverable_id = $1 AND year_number = $2 RETURNING deliverable_id`, [r.deliverableId, r.year, r.operationalTo, r.dmRealPct, r.gmbsRealPct]);
      
      if (upd && upd.rows.length > 0) {
        console.log(`✅ [recalcProjectDeliverablesMarginsYearly] Updated deliverable ${r.deliverableId} year ${r.year}`);
        count++;
      } else {
        console.log(`➕ [recalcProjectDeliverablesMarginsYearly] Inserted new record for deliverable ${r.deliverableId} year ${r.year}`);
        await Pool.query(`INSERT INTO deliverable_yearly_quantities (deliverable_id, year_number, quantity, operational_to, dm_real, gmbs_real) VALUES ($1,$2,$3,$4,$5,$6)`, [r.deliverableId, r.year, r.quantity || 0, r.operationalTo, r.dmRealPct, r.gmbsRealPct]);
        count++;
      }
    }
    await Pool.query('COMMIT');
    
    console.log(`✅ [recalcProjectDeliverablesMarginsYearly] COMPLETED: Updated ${count} records for project ${projectId}`);
    res.json({ projectId: Number(projectId), count, rows });
  } catch (err:any) {
    await Pool.query('ROLLBACK');
    res.status(500).json({ error: err?.message || 'Error recalculando márgenes yearly' });
  }
};

// GET /projects/:projectId/hourly-price
export const getProjectHourlyPrice = async (req: Request, res: Response) => {
  const projectId = (req.params as any).projectId || (req.params as any).id;
  try {
    // operational revenue (sum operational_to)
    const opQ = `SELECT COALESCE(SUM(dyq.operational_to),0)::numeric AS operational_revenue FROM deliverable_yearly_quantities dyq JOIN deliverables d ON d.id = dyq.deliverable_id JOIN workpackages wp ON wp.id = d.workpackage_id WHERE wp.project_id = $1`;
    const opR = await Pool.query<{ operational_revenue: string }>(opQ, [projectId]);
    const operationalTotal = Number(opR.rows[0]?.operational_revenue || 0);

    // Fetch project start_date to map ordinal years to calendar years
    const pRes = await Pool.query<{ start_date?: string }>(`SELECT start_date FROM projects WHERE id=$1`, [projectId]);
    const projectStartDate = pRes.rows[0]?.start_date;

    // Fetch all deliverables for this project and their yearly quantities
    const dRes = await Pool.query<DeliverableRow>(`SELECT d.* FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1 ORDER BY d.created_at DESC`, [projectId]);
    const deliverables: { id: number; yearlyQuantities?: number[] }[] = [];
    if (dRes.rows.length > 0) {
      const ids = dRes.rows.map(r => r.id);
      const yRes = await Pool.query<YearQuantityRow>(`SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1)`, [ids]);
      // group by deliverable
      const byDel: Record<number, YearQuantityRow[]> = {};
      yRes.rows.forEach(r => { (byDel[r.deliverable_id] = byDel[r.deliverable_id] || []).push(r); });
      for (const d of dRes.rows) {
        const list = (byDel[d.id] || []).sort((a,b)=>a.year_number-b.year_number);
        const yearlyQuantities: number[] = list.map(x => Number(x.quantity || 0));
        deliverables.push({ id: d.id, yearlyQuantities });
      }
    }

    const totalProcessTime = await calcProjectTotalWorkingTime(deliverables, projectStartDate, Pool as any);


    const hourlyPrice = totalProcessTime > 0 ? Number((operationalTotal / totalProcessTime).toFixed(2)) : 0;
    res.json({ projectId: Number(projectId), hourlyPrice });
  } catch (err:any) {
    console.error('[getProjectHourlyPrice] error', err);
    res.status(500).json({ error: err?.message || 'Error fetching hourly price' });
  }
};

// GET /projects/:projectId/deliverables-costs
export const getProjectDeliverablesCosts = async (req: Request, res: Response) => {
  const projectId = (req.params as any).projectId || (req.params as any).id;
  try {
    // fetch project start_date
    const pRes = await Pool.query<{ start_date?: string }>('SELECT start_date FROM projects WHERE id=$1', [projectId]);
    const projectStartDate = pRes.rows[0]?.start_date;

    // fetch deliverables and yearly quantities
    const dRes = await Pool.query<DeliverableRow>('SELECT d.* FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1 ORDER BY d.created_at DESC', [projectId]);
    const ids = dRes.rows.map(r => r.id);
    const yRes = ids.length ? await Pool.query<YearQuantityRow>('SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1)', [ids]) : { rows: [] } as any;

    const byDel: Record<number, number[]> = {};
    for (const q of (yRes.rows || [])) {
      byDel[q.deliverable_id] = byDel[q.deliverable_id] || [];
      byDel[q.deliverable_id][q.year_number - 1] = Number(q.quantity || 0);
    }

    const deliverablesForCalc = dRes.rows.map(d => ({ id: d.id, yearlyQuantities: byDel[d.id] || [] }));

    // TODO: Implement new cost calculation using calcBulkMargins
    // For now, return basic response
    const currentYear = new Date().getFullYear();
    
    try {
      const projectMargins = await calcProjectMargins(Number(projectId), currentYear, Pool as any);
      res.json({ 
        projectId: Number(projectId), 
        operationalRevenue: projectMargins.TO,
        totalDmCosts: projectMargins.total_dm_costs,
        totalGmbsCosts: projectMargins.total_gmbs_costs,
        projectDM: projectMargins.DM,
        projectGMBS: projectMargins.GMBS
      });
    } catch (marginError) {
      res.json({ projectId: Number(projectId), operationalRevenue: 0, projectDM: 0, projectGMBS: 0 });
    }
  } catch (err:any) {
    res.status(500).json({ error: err?.message || 'Error fetching deliverable costs' });
  }
};

// GET /projects/:projectId/deliverables-costs-breakdown
export const getProjectDeliverablesCostsBreakdown = async (req: Request, res: Response) => {
  const projectId = (req.params as any).projectId || (req.params as any).id;
  try {
    // fetch project start_date
    const pRes = await Pool.query<{ start_date?: string }>('SELECT start_date FROM projects WHERE id=$1', [projectId]);
    const projectStartDate = pRes.rows[0]?.start_date;

    // fetch workpackages for project
    const wpRes = await Pool.query('SELECT * FROM workpackages WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    const workPackages = wpRes.rows || [];

    // fetch deliverables and yearly quantities for the project (include workpackage_id)
    const dRes = await Pool.query<DeliverableRow>('SELECT d.* FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1 ORDER BY d.created_at DESC', [projectId]);
    const ids = dRes.rows.map(r => r.id);
    const yRes = ids.length ? await Pool.query<YearQuantityRow>('SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1)', [ids]) : { rows: [] } as any;

    const byDel: Record<number, number[]> = {};
    for (const q of (yRes.rows || [])) {
      byDel[q.deliverable_id] = byDel[q.deliverable_id] || [];
      byDel[q.deliverable_id][q.year_number - 1] = Number(q.quantity || 0);
    }

    const deliverablesForCalc = dRes.rows.map(d => ({ id: d.id, workpackage_id: d.workpackage_id, nombre: d.nombre, yearlyQuantities: byDel[d.id] || [] }));

    // TODO: Implement new breakdown calculation using calcBulkMargins
    // For now, create empty cost rows structure
    const costRows: any[] = [];

    // build quantity map for quick access
    const qtyMap: Record<string, number> = {};
    for (const d of deliverablesForCalc) {
      const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
      for (let i = 0; i < yq.length; i++) {
        qtyMap[`${d.id}_${i+1}`] = Number(yq[i] || 0);
      }
    }

    // aggregate per-deliverable totals from costRows and quantities
    const perDeliverableTotals: Record<number, { totalOpRecurrent: number; totalOpNonRecurrent: number; totalNop: number; totalCosts: number; totalQty: number }> = {};
    for (const cr of costRows) {
      const did = Number((cr as any).deliverableId ?? (cr as any).deliverable_id);
      const year_number = Number((cr as any).year_number ?? (cr as any).yearNumber ?? 0);
      const qty = Number(qtyMap[`${did}_${year_number}`] || 0);
      const opRecurrentContribution = Number((cr as any).opRecurrentSum ?? (cr as any).op_recurrent_sum ?? 0) * qty;
      const opNonRecurrentContribution = Number((cr as any).opNonRecurrentSum ?? (cr as any).op_non_recurrent_sum ?? 0);
      const nopContribution = Number((cr as any).nopSum ?? (cr as any).nop_sum ?? 0) * qty;
      const entry = perDeliverableTotals[did] || { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalCosts: 0, totalQty: 0 };
      entry.totalOpRecurrent += opRecurrentContribution;
      entry.totalOpNonRecurrent += opNonRecurrentContribution;
      entry.totalNop += nopContribution;
      entry.totalCosts += opRecurrentContribution + opNonRecurrentContribution + nopContribution;
      entry.totalQty += qty;
      perDeliverableTotals[did] = entry;
    }

    // compute per-deliverable total TO and work_time in a single query
    // Build VALUES for (deliverable_id, calendar_year, year_number, qty)
    const tuples: number[] = [];
    const valuesParts: string[] = [];
    let paramIdx = 1;
    const projectStartYear = projectStartDate ? new Date(projectStartDate).getFullYear() : new Date().getFullYear();
    for (const d of deliverablesForCalc) {
      const id = Number(d.id);
      const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
      for (let i = 0; i < yq.length; i++) {
        const qty = Number(yq[i] || 0);
        const calendarYear = projectStartYear + i;
        valuesParts.push(`($${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::numeric)`);
        tuples.push(id, calendarYear, i+1, qty);
      }
    }

    let workTimeRows: Array<{ deliverable_id: number; total_work_time: string }> = [];
    let toRows: Array<{ deliverable_id: number; total_to: string }> = [];
    if (valuesParts.length > 0) {
      const valuesSql = valuesParts.join(',');
      const qWork = `
        WITH dy(did, year, year_number, qty) AS (VALUES ${valuesSql})
        SELECT dy.did AS deliverable_id, COALESCE(SUM(
          CASE WHEN LOWER(COALESCE(s.unit,'')) = 'days' THEN COALESCE(syd.process_time,0) * COALESCE(pc.hours_per_day,0) * COALESCE(dy.qty,0)
               ELSE COALESCE(syd.process_time,0) * COALESCE(dy.qty,0) END
        ),0)::numeric AS total_work_time
        FROM steps s
        JOIN dy ON dy.did = s.deliverable_id
        JOIN step_yearly_data syd ON syd.step_id = s.id AND syd.year = dy.year
        LEFT JOIN deliverables d ON d.id = s.deliverable_id
        LEFT JOIN workpackages wp ON wp.id = d.workpackage_id
        LEFT JOIN project_countries pc ON pc.project_id = wp.project_id AND pc.country_id = s.country_id
        GROUP BY dy.did
      `;
      const rWork = await Pool.query<{ deliverable_id: number; total_work_time: string }>(qWork, tuples);
      workTimeRows = rWork.rows || [];

      // fetch per-deliverable total TO
      const qTO = `SELECT deliverable_id, COALESCE(SUM(operational_to),0)::numeric AS total_to FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) GROUP BY deliverable_id`;
      const rTO = await Pool.query<{ deliverable_id: number; total_to: string }>(qTO, [ids]);
      toRows = rTO.rows || [];
    }

    const workTimeMap: Record<number, number> = {};
    for (const w of workTimeRows) workTimeMap[Number(w.deliverable_id)] = Number(w.total_work_time || 0);
    const toMap: Record<number, number> = {};
    for (const t of toRows) toMap[Number(t.deliverable_id)] = Number(t.total_to || 0);

    // Build response grouped by workpackage
    const wpMap: Record<number, any> = {};
    for (const wp of workPackages) {
      wpMap[Number(wp.id)] = { id: wp.id, nombre: wp.nombre || wp.name || wp.codigo || `WP ${wp.id}`, deliverables: [], totals: { totalCosts: 0, totalTO: 0, totalWorkTime: 0 } };
    }

    for (const d of deliverablesForCalc) {
      const did = Number(d.id);
      const wpId = Number((d as any).workpackage_id);
      const totals = perDeliverableTotals[did] || { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalCosts: 0, totalQty: 0 };
      const totalTO = toMap[did] || 0;
      const totalWorkTime = workTimeMap[did] || 0;
      const hourlyCost = totalWorkTime > 0 ? Number((totals.totalCosts / totalWorkTime).toFixed(2)) : 0;
      const hourlyPrice = totalWorkTime > 0 ? Number((totalTO / totalWorkTime).toFixed(2)) : 0;
      const dm = totalTO > 0 ? Number(((1 - ( (totals.totalOpRecurrent + totals.totalOpNonRecurrent) / totalTO)) * 100).toFixed(2)) : 0;
      const gmbs = totalTO > 0 ? Number(((1 - ( (totals.totalOpRecurrent + totals.totalNop + totals.totalOpNonRecurrent) / totalTO)) * 100).toFixed(2)) : 0;

      const deliverableEntry = {
        id: did,
        nombre: (d as any).nombre || `Deliverable ${did}`,
        workpackage_id: wpId,
        totalCosts: totals.totalCosts,
        totalTO,
        totalWorkTime,
        hourlyCost,
        hourlyPrice,
        dm,
        gmbs,
      };

      if (!wpMap[wpId]) {
        wpMap[wpId] = { id: wpId, nombre: `WP ${wpId}`, deliverables: [], totals: { totalCosts: 0, totalTO: 0, totalWorkTime: 0 } };
      }
      wpMap[wpId].deliverables.push(deliverableEntry);
      wpMap[wpId].totals.totalCosts += deliverableEntry.totalCosts;
      wpMap[wpId].totals.totalTO += deliverableEntry.totalTO;
      wpMap[wpId].totals.totalWorkTime += deliverableEntry.totalWorkTime;
    }

    const wpList = Object.values(wpMap).map((w:any) => {
      const totalWorkTime = w.totals.totalWorkTime || 0;
      
      // Calcular Unit Price = Operational TO / Total Quantity del workpackage
      const totalQuantity = w.deliverables.reduce((sum: number, d: any) => {
        const deliverable = deliverablesForCalc.find(del => del.id === d.id);
        const yearlyQuantities = deliverable?.yearlyQuantities || [];
        const deliverableTotalQty = yearlyQuantities.reduce((s: number, q: number) => s + (q || 0), 0);
        return sum + deliverableTotalQty;
      }, 0);
      
      const unitPrice = totalQuantity > 0 ? Number((w.totals.totalTO / totalQuantity).toFixed(2)) : 0;
      
      return {
        id: w.id,
        nombre: w.nombre,
        deliverables: w.deliverables,
        totals: {
          totalCosts: Number((w.totals.totalCosts || 0)),
          totalTO: Number((w.totals.totalTO || 0)),
          totalWorkTime,
          totalQuantity,
          unitPrice,
          hourlyCost: totalWorkTime > 0 ? Number((w.totals.totalCosts / totalWorkTime).toFixed(2)) : 0,
          hourlyPrice: totalWorkTime > 0 ? Number((w.totals.totalTO / totalWorkTime).toFixed(2)) : 0,
          dm: w.totals.totalTO > 0 ? Number(((1 - ((w.totals.totalCosts) / w.totals.totalTO)) * 100).toFixed(2)) : 0,
          gmbs: w.totals.totalTO > 0 ? Number(((1 - ((w.totals.totalCosts + (w.totals.totalNop||0)) / w.totals.totalTO)) * 100).toFixed(2)) : 0,
        }
      };
    });

    res.json({ projectId: Number(projectId), workPackages: wpList });
  } catch (err:any) {
    res.status(500).json({ error: err?.message || 'Error fetching deliverable costs breakdown' });
  }
};

// DIAGNOSTIC endpoint to check data availability
export const diagnoseBulkMarginData = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { year } = req.query;
  
  try {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    
    // 1. Check if project exists and has margin configuration
    const projectRes = await Pool.query(`SELECT id, margin_type, margin_goal, start_date FROM projects WHERE id = $1`, [projectId]);
    
    // 2. Check deliverables
    const deliverablesRes = await Pool.query(`
      SELECT d.id, d.codigo, d.nombre
      FROM deliverables d 
      JOIN workpackages wp ON d.workpackage_id = wp.id 
      WHERE wp.project_id = $1
    `, [projectId]);
    
    // 3. Check steps
    const stepsRes = await Pool.query(`
      SELECT s.id, s.deliverable_id, s.nombre
      FROM steps s
      JOIN deliverables d ON s.deliverable_id = d.id
      JOIN workpackages wp ON d.workpackage_id = wp.id
      WHERE wp.project_id = $1
    `, [projectId]);
    
    // 4. Check step_yearly_data
    const stepYearlyRes = await Pool.query(`
      SELECT syd.step_id, syd.year, syd.salaries_costs, syd.management_costs, syd.npt_costs, syd.it_costs, syd.premises_costs
      FROM step_yearly_data syd
      JOIN steps s ON syd.step_id = s.id
      JOIN deliverables d ON s.deliverable_id = d.id
      JOIN workpackages wp ON d.workpackage_id = wp.id
      WHERE wp.project_id = $1 AND syd.year = $2
      LIMIT 5
    `, [projectId, currentYear]);
    
    // 5. Check project_countries
    const countriesRes = await Pool.query(`
      SELECT pc.country_id, pc.activity_rate
      FROM project_countries pc
      WHERE pc.project_id = $1
    `, [projectId]);
    
    // 6. Check deliverable_yearly_quantities
    const quantitiesRes = await Pool.query(`
      SELECT dyq.deliverable_id, dyq.year_number, dyq.quantity, dyq.operational_to, dyq.dm_real, dyq.gmbs_real
      FROM deliverable_yearly_quantities dyq
      JOIN deliverables d ON dyq.deliverable_id = d.id
      JOIN workpackages wp ON d.workpackage_id = wp.id
      WHERE wp.project_id = $1
    `, [projectId]);
    
    res.json({
      projectId: Number(projectId),
      year: currentYear,
      diagnosis: {
        project: projectRes.rows[0] || null,
        deliverables: deliverablesRes.rows,
        stepsCount: stepsRes.rows.length,
        stepYearlyDataSample: stepYearlyRes.rows,
        projectCountries: countriesRes.rows,
        deliverableQuantities: quantitiesRes.rows
      },
      message: 'Diagnosis completed'
    });
    
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error diagnosing bulk margin data' });
  }
};

// TEST endpoint for new margin calculations
export const testBulkMarginCalculation = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { year } = req.query;
  
  try {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    
    // Test project-level calculation
    const projectMargins = await calcProjectMargins(Number(projectId), currentYear, Pool as any);
    
    // Test deliverable-level calculations
    const dRes = await Pool.query<{ id: number }>(`
      SELECT d.id 
      FROM deliverables d 
      JOIN workpackages wp ON d.workpackage_id = wp.id 
      WHERE wp.project_id = $1
    `, [projectId]);
    
    const deliverableResults = [];
    for (const d of dRes.rows) {
      try {
        const deliverableMargins = await calcDeliverableMargins(d.id, currentYear, Pool as any);
        deliverableResults.push({
          deliverableId: d.id,
          margins: deliverableMargins
        });
      } catch (e: any) {
        deliverableResults.push({
          deliverableId: d.id,
          error: e?.message || 'Unknown error'
        });
      }
    }
    
    res.json({
      projectId: Number(projectId),
      year: currentYear,
      projectMargins,
      deliverableResults,
      message: 'Test completed successfully'
    });
    
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error testing bulk margin calculation' });
  }
};

// PUT /deliverables/:deliverableId/customer-unit-price
export const updateDeliverableCustomerUnitPrice = async (req: Request, res: Response) => {
  try {
    const { deliverableId } = req.params;
    const { customer_unit_price } = req.body;
    
    if (!deliverableId || isNaN(parseInt(deliverableId))) {
      return res.status(400).json({ error: 'Invalid deliverable ID' });
    }
    
    // Permitir null para limpiar el precio manual
    const priceValue = customer_unit_price === null || customer_unit_price === undefined ? null : parseFloat(customer_unit_price);
    
    if (priceValue !== null && (isNaN(priceValue) || priceValue < 0)) {
      return res.status(400).json({ error: 'Invalid customer unit price' });
    }
    
    console.log(`[UpdateCustomerUnitPrice] Updating deliverable ${deliverableId} customer unit price to ${priceValue}`);
    
    const updateQuery = `
      UPDATE deliverables 
      SET customer_unit_price = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, codigo, nombre, customer_unit_price;
    `;
    
    const result = await Pool.query(updateQuery, [priceValue, deliverableId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    
    console.log(`[UpdateCustomerUnitPrice] Successfully updated deliverable ${deliverableId}`);
    
    res.json({
      success: true,
      deliverable: {
        id: result.rows[0].id,
        codigo: result.rows[0].codigo,
        nombre: result.rows[0].nombre,
        customer_unit_price: result.rows[0].customer_unit_price
      }
    });
  } catch (error: any) {
    console.error('[UpdateCustomerUnitPrice] Error updating customer unit price:', error);
    res.status(500).json({ error: error?.message || 'Error updating customer unit price' });
  }
};
