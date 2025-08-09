// Obtener salarios oficiales de un perfil por país
import { Request, Response } from 'express';
import Pool from '../../db';

export const getOfficialProfileSalaries = async (req: Request, res: Response) => {
  const { profile_id } = req.params;
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id es requerido' });
  }
  try {
    const result = await Pool.query(
      `SELECT country_id, salary FROM officialprofile_salaries WHERE profile_id = $1`,
      [profile_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener salarios oficiales del perfil', details: err });
  }
};
// deleteProjectProfile.ts
export const deleteProjectProfile = async (req: Request, res: Response) => {
  const { project_id, profile_id } = req.body;

  if (!project_id || !profile_id) {
    return res.status(400).json({ error: 'project_id y profile_id son requeridos' });
  }

  try {
    const result = await Pool.query(
      `DELETE FROM project_profiles 
       WHERE project_id = $1 AND profile_id = $2
       RETURNING *`,
      [project_id, profile_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Relación project_profile no encontrada' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al eliminar relación project_profile:', err);
    res.status(500).json({ error: 'Error al eliminar relación project_profile', details: err });
  }
};


// Crear relación project_profile
export const addProjectProfile = async (req: Request, res: Response) => {
  const { project_id, profile_id, salaries } = req.body;
  if (!project_id || !profile_id) {
    return res.status(400).json({ error: 'project_id y profile_id son requeridos' });
  }

  const client = await Pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ Verificar si ya existe por profile_id
    const existsById = await client.query(
      'SELECT 1 FROM project_profiles WHERE project_id=$1 AND profile_id=$2 LIMIT 1',
      [project_id, profile_id]
    );
    if (existsById.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This profile is already existing in this project' });
    }

    // ✅ Verificar duplicado por nombre (independiente del profile_id) — evita duplicados con mismo nombre
    const dupName = await client.query(
      `SELECT 1
         FROM project_profiles pp
         JOIN profiles p ON p.id = pp.profile_id
        WHERE pp.project_id = $1
          AND LOWER(p.name) = LOWER( (SELECT name FROM profiles WHERE id = $2) )
        LIMIT 1`,
      [project_id, profile_id]
    );
    if (dupName.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This profile is already existing in this project' });
    }

    // Insert relación
    const inserted = await client.query(
      'INSERT INTO project_profiles (project_id, profile_id) VALUES ($1,$2) RETURNING id',
      [project_id, profile_id]
    );
    const projectProfileId = inserted.rows[0].id;

    // Salarios opcionales
    if (salaries && typeof salaries === 'object') {
      for (const [countryId, salary] of Object.entries(salaries)) {
        const val = Number(salary);
        if (!isNaN(val) && val > 0) {
          await client.query(
            `INSERT INTO project_profile_salaries (project_profile_id, country_id, salary)
             VALUES ($1,$2,$3)
             ON CONFLICT (project_profile_id, country_id)
             DO UPDATE SET salary = EXCLUDED.salary`,
            [projectProfileId, countryId, val]
          );
        }
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ id: projectProfileId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error addProjectProfile:', err);
    return res.status(500).json({ error: 'Error creando relación project_profile' });
  } finally {
    client.release();
  }
};

// Obtener perfiles de un proyecto
export const getProjectProfiles = async (req: Request, res: Response) => {
  const { project_id } = req.params;
  try {
    const result = await Pool.query(
      `SELECT p.*, pp.id as project_profile_id 
       FROM profiles p
       INNER JOIN project_profiles pp ON pp.profile_id = p.id
       WHERE pp.project_id = $1`,
      [project_id]
    );
    
    console.log('Project Profiles:', result.rows);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener perfiles del proyecto:', err);
    res.status(500).json({ error: 'Error al obtener perfiles del proyecto', details: err });
  }
};
