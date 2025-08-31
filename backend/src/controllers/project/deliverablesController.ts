import { Request, Response } from 'express';
import Pool from '../../db';

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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar deliverable' });
  }
};
