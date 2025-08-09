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
  
  const client = await Pool.connect(); // Iniciar transacción
  
  try {
    await client.query('BEGIN');
    
    // Crear relación project_profile
    const projectProfileResult = await client.query(
      `INSERT INTO project_profiles (project_id, profile_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id, profile_id) DO NOTHING
       RETURNING id`,
      [project_id, profile_id]
    );
    
    const projectProfileId = projectProfileResult.rows[0]?.id;
    
    if (!projectProfileId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se pudo crear la relación project_profile' });
    }
    
    // Guardar salarios si se proporcionan
    if (salaries && Object.keys(salaries).length > 0) {
      const salaryPromises = Object.entries(salaries).map(([country_id, salary]) => 
        client.query(
          `INSERT INTO project_profile_salaries (project_profile_id, country_id, salary)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_profile_id, country_id) 
           DO UPDATE SET salary = EXCLUDED.salary`,
          [projectProfileId, country_id, salary]
        )
      );
      
      await Promise.all(salaryPromises);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({ id: projectProfileId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear relación project_profile:', err);
    res.status(500).json({ error: 'Error al crear relación project_profile', details: err });
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
