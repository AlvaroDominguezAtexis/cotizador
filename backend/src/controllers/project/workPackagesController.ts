import { Request, Response } from 'express';
import Pool from '../../db';

// Normaliza timestamps a YYYY-MM-DD
const normalize = (wp: any) => {
  const toDateOnly = (d: any) => {
    if (!d) return null; const str = d instanceof Date ? d.toISOString() : d.toString(); return str.includes('T') ? str.split('T')[0] : str;
  };
  return { ...wp, created_at: toDateOnly(wp.created_at), updated_at: toDateOnly(wp.updated_at) };
};

// GET /projects/:projectId/workpackages
export const getWorkPackages = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const result = await Pool.query('SELECT * FROM workpackages WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    res.json(result.rows.map(normalize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener workpackages' });
  }
};

// POST /projects/:projectId/workpackages
export const createWorkPackage = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const { codigo, nombre } = req.body;
    if (!codigo || !nombre) {
      return res.status(400).json({ error: 'codigo y nombre son obligatorios' });
    }
    const result = await Pool.query(
      `INSERT INTO workpackages (project_id, codigo, nombre) VALUES ($1,$2,$3) RETURNING *`,
      [projectId, codigo, nombre]
    );
    res.status(201).json(normalize(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear workpackage' });
  }
};

// PUT /projects/:projectId/workpackages/:id
export const updateWorkPackage = async (req: Request, res: Response) => {
  const { projectId, id } = req.params;
  try {
    const { codigo, nombre } = req.body;
    const result = await Pool.query(
      `UPDATE workpackages SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre), updated_at = NOW() WHERE id = $3 AND project_id = $4 RETURNING *`,
      [codigo, nombre, id, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Workpackage no encontrado' });
    res.json(normalize(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar workpackage' });
  }
};

// DELETE /projects/:projectId/workpackages/:id
export const deleteWorkPackage = async (req: Request, res: Response) => {
  const { projectId, id } = req.params;
  try {
    const result = await Pool.query('DELETE FROM workpackages WHERE id=$1 AND project_id=$2 RETURNING id', [id, projectId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Workpackage no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar workpackage' });
  }
};
