import { Request, Response } from 'express';
import pool from '../../db'; // Tu conexión a PostgreSQL

export const createProjectProfileSalary = async (req: Request, res: Response) => {
  const { project_profile_id, country_id, salary } = req.body;

  if (!project_profile_id || !country_id || salary == null) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO project_profile_salaries (project_profile_id, country_id, salary)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_profile_id, country_id)
      DO UPDATE SET salary = EXCLUDED.salary
      RETURNING *;
      `,
      [project_profile_id, country_id, salary]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando salario:', error);
    res.status(500).json({ error: 'Error creando salario' });
  }
};

export const getProjectProfileSalaries = async (req: Request, res: Response) => {
  const { project_profile_id } = req.query;
  
  console.log('Received project_profile_id:', project_profile_id);
  
  if (!project_profile_id) {
    return res.status(400).json({ error: 'project_profile_id es requerido' });
  }
  
  try {
    const result = await pool.query(
      'SELECT id, country_id, salary FROM project_profile_salaries WHERE project_profile_id = $1',
      [project_profile_id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener salarios:', err);
    res.status(500).json({ error: 'Error al obtener salarios', details: err });
  }
};

export const updateProjectProfileSalary = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { project_profile_id, country_id, salary } = req.body;

  console.log('🔹 PUT /project-profile-salaries/:id', id, req.body);

  if (!id) return res.status(400).json({ error: 'ID requerido' });
  if (salary === undefined) return res.status(400).json({ error: 'Salary requerido' });

  try {
    const result = await pool.query(
      `UPDATE project_profile_salaries 
       SET salary = $1
       WHERE id = $2
       RETURNING *`,
      [salary, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Salario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error al actualizar salario:', err);
    res.status(500).json({ error: 'Error al actualizar salario', details: err });
  }
};
