import { Request, Response } from 'express';
import db from '../../db';

// GET /projects/:projectId/countries-management-salary
export const getProjectCountriesManagementSalary = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const user = (req as any).user;
  
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  if (!user) return res.status(401).json({ error: 'Usuario no autenticado' });
  
  try {
    // Verify project ownership
    const projectCheck = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND created_by = $2',
      [projectId, user.id]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos' });
    }
    
    const q = `
      SELECT pc.country_id, c.name AS country_name, pc.management_yearly_salary
      FROM project_countries pc
      JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
      ORDER BY c.name ASC
    `;
    const { rows } = await db.query(q, [projectId]);
    res.json(rows);
  } catch (e) {
    console.error('getProjectCountriesManagementSalary error', e);
    res.status(500).json({ error: 'Error al obtener salarios de Project Manager por país' });
  }
};

// PUT /projects/:projectId/countries-management-salary
export const updateProjectCountriesManagementSalary = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const updates = req.body as Array<{ country_id: string; management_yearly_salary: number | null }>;
  const user = (req as any).user;
  
  if (!projectId) return res.status(400).json({ error: 'projectId requerido' });
  if (!user) return res.status(401).json({ error: 'Usuario no autenticado' });
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Body debe ser un array' });
  
  try {
    // Verify project ownership
    const projectCheck = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND created_by = $2',
      [projectId, user.id]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos' });
    }
    
    await db.query('BEGIN');
    
    for (const update of updates) {
      const q = `
        UPDATE project_countries
        SET management_yearly_salary = $1
        WHERE project_id = $2 AND country_id = $3
      `;
      await db.query(q, [update.management_yearly_salary, projectId, update.country_id]);
    }
    
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('updateProjectCountriesManagementSalary error', e);
    res.status(500).json({ error: 'Error al actualizar salarios de Project Manager' });
  }
};
