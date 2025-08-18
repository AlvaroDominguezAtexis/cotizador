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

// Cambiar el perfil asociado a un project_profile sin modificar salarios (preserva project_profile_id)
export const switchProjectProfile = async (req: Request, res: Response) => {
  const { project_id, from_profile_id, to_profile_id } = req.body;
  if (!project_id || !from_profile_id || !to_profile_id) {
    return res.status(400).json({ error: 'project_id, from_profile_id y to_profile_id son requeridos' });
  }
  try {
    const result = await Pool.query(
      `UPDATE project_profiles
         SET profile_id = $1
       WHERE project_id = $2 AND profile_id = $3
       RETURNING id, project_id, profile_id`,
      [to_profile_id, project_id, from_profile_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Relación project_profile no encontrada' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      // Unique violation, ya existe project_id + to_profile_id
      return res.status(409).json({ error: 'This profile is already existing in this project' });
    }
    console.error('Error al cambiar project_profile:', err);
    return res.status(500).json({ error: 'Error al cambiar project_profile', details: err });
  }
};

export const deleteProjectProfile = async (req: Request, res: Response) => {
  const { project_id, profile_id, force } = req.body;

  if (!project_id || !profile_id) {
    return res.status(400).json({ error: 'project_id y profile_id son requeridos' });
  }

  const client = await Pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar la fila para obtener el id de project_profile
    const sel = await client.query(
      `SELECT id FROM project_profiles WHERE project_id = $1 AND profile_id = $2 LIMIT 1`,
      [project_id, profile_id]
    );
    if (sel.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Relación project_profile no encontrada' });
    }
    const projectProfileId = sel.rows[0].id as number;

    // Pre-chequeo: verificar si el perfil está referenciado por steps (para aviso y confirmación en UI)
    const stepsRef = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM steps WHERE profile_id = $1`,
      [profile_id]
    );
    const stepsCount = parseInt(stepsRef.rows[0]?.count || '0', 10);
    if (stepsCount > 0 && !force) {
      // Fetch a sample of step names to present in the confirmation
      const namesRes = await client.query<{ nombre: string }>(
        `SELECT nombre FROM steps WHERE profile_id = $1 ORDER BY id ASC LIMIT 20`,
        [profile_id]
      );
      const stepNames = namesRes.rows.map(r => r.nombre).filter(Boolean);
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'There are associated steps to this profile.',
        code: 'PROFILE_IN_USE',
        stepsCount,
        stepNames
      });
    }

    // Borrar salarios dependientes primero (si existen)
    await client.query(
      `DELETE FROM project_profile_salaries WHERE project_profile_id = $1`,
      [projectProfileId]
    );

    // Borrar relación project_profile
    await client.query(
      `DELETE FROM project_profiles WHERE id = $1`,
      [projectProfileId]
    );

  await client.query('COMMIT');
  res.status(200).json({ success: true, stepsDeleted: force ? stepsCount : 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar relación project_profile:', err);
    return res.status(500).json({ error: 'Error al eliminar relación project_profile', details: err });
  } finally {
    client.release();
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
      // Obtener proyecto para calcular años
      const projRes = await client.query(
        'SELECT start_date, end_date FROM projects WHERE id = $1',
        [project_id]
      );
      const { start_date, end_date } = projRes.rows[0] || {};
      const startYear = start_date ? new Date(start_date).getFullYear() : new Date().getFullYear();
      const endYear = end_date ? new Date(end_date).getFullYear() : startYear;
      const years: number[] = [];
      for (let y = startYear; y <= endYear; y++) years.push(y);

      // Traer CPI por país para el proyecto; fallback a countries.cpi_by_default
      const cpiRes = await client.query(
        `SELECT pc.country_id, COALESCE(pc.cpi, c.cpi_by_default, 0) AS cpi
           FROM countries c
           LEFT JOIN project_countries pc ON pc.country_id = c.id AND pc.project_id = $1`,
        [project_id]
      );
      const cpiMap = new Map<number, number>();
      for (const r of cpiRes.rows) cpiMap.set(Number(r.country_id), Number(r.cpi) || 0);

      for (const [countryIdStr, salary] of Object.entries(salaries)) {
        const countryId = Number(countryIdStr);
        const baseSalary = Number(salary);
        if (isNaN(baseSalary) || baseSalary <= 0) continue;
        const cpi = cpiMap.get(countryId) ?? 0;

        let current = baseSalary;
        for (let i = 0; i < years.length; i++) {
          const y = years[i];
          if (i > 0) current = current * (1 + (cpi / 100));
          await client.query(
            `INSERT INTO project_profile_salaries (project_profile_id, country_id, salary, year)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (project_profile_id, country_id, year)
             DO UPDATE SET salary = EXCLUDED.salary`,
            [projectProfileId, countryId, current, y]
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
