import { Request, Response } from 'express';
import db from '../../db';

const mapStep = (row: any) => ({
  id: row.id,
  deliverable_id: row.deliverable_id,
  profile_id: row.profile_id,
  country_id: row.country_id,
  nombre: row.nombre,
  process_time: Number(row.process_time),
  unit: row.unit,
  office: row.office,
  mng: Number(row.mng),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const getSteps = async (req: Request, res: Response) => {
  const { deliverableId } = req.params;
  try {
    const result = await db.query('SELECT * FROM steps WHERE deliverable_id = $1 ORDER BY id ASC', [deliverableId]);
    res.json(result.rows.map(mapStep));
  } catch (err) {
    console.error('Error fetching steps', err);
    res.status(500).json({ error: 'Error al obtener steps' });
  }
};

export const createStep = async (req: Request, res: Response) => {
  const { deliverableId } = req.params;
  const { profile_id, country_id, nombre, process_time, unit, office, mng } = req.body;
  try {
    const insert = `INSERT INTO steps (deliverable_id, profile_id, country_id, nombre, process_time, unit, office, mng)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    const values = [deliverableId, profile_id, country_id, nombre, process_time, unit, office ?? false, mng];
    const result = await db.query(insert, values);
    res.status(201).json(mapStep(result.rows[0]));
  } catch (err: any) {
    console.error('Error creating step', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nombre de step duplicado en este deliverable' });
    }
    res.status(500).json({ error: 'Error al crear step' });
  }
};

export const updateStep = async (req: Request, res: Response) => {
  const { stepId, deliverableId } = req.params;
  const { profile_id, country_id, nombre, process_time, unit, office, mng } = req.body;
  try {
    const update = `UPDATE steps
                    SET profile_id=$1, country_id=$2, nombre=$3, process_time=$4, unit=$5, office=$6, mng=$7, updated_at=NOW()
                    WHERE id=$8 AND deliverable_id=$9
                    RETURNING *`;
    const values = [profile_id, country_id, nombre, process_time, unit, office ?? false, mng, stepId, deliverableId];
    const result = await db.query(update, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step no encontrado' });
    res.json(mapStep(result.rows[0]));
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
