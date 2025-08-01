// DELETE /project-profiles
export const deleteProjectProfile = async (req: Request, res: Response) => {
  const { project_id, profile_id } = req.body;
  if (!project_id || !profile_id) {
    return res.status(400).json({ error: 'project_id y profile_id son requeridos' });
  }
  try {
    await Pool.query(
      'DELETE FROM project_profiles WHERE project_id = $1 AND profile_id = $2',
      [project_id, profile_id]
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar relación project_profile', details: err });
  }
};
import { Request, Response } from 'express';
import Pool from '../../db';

// Crear relación project_profile
export const addProjectProfile = async (req: Request, res: Response) => {
  const { project_id, profile_id } = req.body;
  if (!project_id || !profile_id) {
    return res.status(400).json({ error: 'project_id y profile_id son requeridos' });
  }
  try {
    const result = await Pool.query(
      `INSERT INTO project_profiles (project_id, profile_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id, profile_id) DO NOTHING
       RETURNING *`,
      [project_id, profile_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear relación project_profile', details: err });
  }
};

// Obtener perfiles de un proyecto
export const getProjectProfiles = async (req: Request, res: Response) => {
  const { project_id } = req.params;
  try {
    const result = await Pool.query(
      `SELECT p.* FROM profiles p
       INNER JOIN project_profiles pp ON pp.profile_id = p.id
       WHERE pp.project_id = $1`,
      [project_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfiles del proyecto', details: err });
  }
};
