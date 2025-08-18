import { Request, Response } from 'express';
import Pool from '../../db';

// 🔹 Normaliza fechas a YYYY-MM-DD (sin zona horaria)
const normalizeProjectDates = (project: any) => {
  const toDateOnly = (d: any) => {
    if (!d) return null;
    // Convertimos cualquier formato a string y cortamos antes de la T si existe
    const str = d instanceof Date ? d.toISOString() : d.toString();
    return str.includes('T') ? str.split('T')[0] : str;
  };

  return {
    ...project,
    start_date: toDateOnly(project.start_date),
    end_date: toDateOnly(project.end_date),
    created_at: toDateOnly(project.created_at),
    updated_at: toDateOnly(project.updated_at),
  };
};

// 🔹 Obtener todos los proyectos (incluye países asociados desde project_countries)
export const getProjects = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT p.*,
             COALESCE(pc.countries, '[]') AS countries
      FROM projects p
      LEFT JOIN (
        SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
        FROM project_countries
        GROUP BY project_id
      ) pc ON pc.project_id = p.id
      ORDER BY p.created_at DESC;
    `;
    const result = await Pool.query(query);
    const normalized = result.rows.map(r => normalizeProjectDates(r));
    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
};

// 🔹 Obtener un proyecto por ID (con países asociados)
export const getProjectById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT p.*,
             COALESCE(pc.countries, '[]') AS countries
      FROM projects p
      LEFT JOIN (
        SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
        FROM project_countries
        WHERE project_id = $1
        GROUP BY project_id
      ) pc ON pc.project_id = p.id
      WHERE p.id = $1;
    `;
    const result = await Pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json(normalizeProjectDates(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
};

// 🔹 Crear un proyecto
export const createProject = async (req: Request, res: Response) => {
  const client = await Pool.connect();
  try {
    await client.query('BEGIN');
    const {
      title,
      crm_code,
      client: clientName,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      scope,
      countries, // array de country_id
      iqp,
      segmentation,
      description
    } = req.body;

    const insertProjectQuery = `
      INSERT INTO projects
      (title, crm_code, client, activity, start_date, end_date,
       business_manager, business_unit, ops_domain, scope,
       iqp, segmentation, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *;
    `;

    const projectValues = [
      title || null,
      crm_code || null,
      clientName || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
      ops_domain || null,
      scope || null,
      iqp || null,
      segmentation || null,
      description || null,
    ];

    const projectResult = await client.query(insertProjectQuery, projectValues);
    const newProject = projectResult.rows[0];

    // Insertar países (si vienen) con CPI por defecto tomado de countries.cpi_by_default
    if (Array.isArray(countries) && countries.length > 0) {
      // Inserta mediante SELECT para tomar el cpi_by_default de cada país
      const insertCountriesQuery = `
        INSERT INTO project_countries (project_id, country_id, cpi)
        SELECT $1 AS project_id, c.id AS country_id, c.cpi_by_default AS cpi
        FROM countries c
        WHERE c.id = ANY($2::int[])
        ON CONFLICT (project_id, country_id) DO NOTHING;
      `;
      await client.query(insertCountriesQuery, [newProject.id, countries]);
    }

    await client.query('COMMIT');

    // Recuperar proyecto con países agregados
    const fullProject = await client.query(
      `SELECT p.*,
              COALESCE(pc.countries, '[]') AS countries
       FROM projects p
       LEFT JOIN (
         SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
         FROM project_countries WHERE project_id = $1 GROUP BY project_id
       ) pc ON pc.project_id = p.id
       WHERE p.id=$1`, [newProject.id]
    );

    res.status(201).json(normalizeProjectDates(fullProject.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear proyecto' });
  } finally {
    client.release();
  }
};

// 🔹 Actualizar un proyecto
export const updateProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const clientConn = await Pool.connect();
  try {
    await clientConn.query('BEGIN');
    const {
      title,
      crm_code,
      client: clientName,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      scope,
      countries, // array de country_id
      iqp,
      segmentation,
      description
    } = req.body;

    const updateQuery = `
      UPDATE projects
      SET title=$1, crm_code=$2, client=$3, activity=$4,
          start_date=$5, end_date=$6,
          business_manager=$7, business_unit=$8, ops_domain=$9,
          scope=$10,
          iqp=$11, segmentation=$12, description=$13,
          updated_at=NOW()
      WHERE id=$14
      RETURNING *;
    `;

    const updateValues = [
      title || null,
      crm_code || null,
      clientName || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
      ops_domain || null,
      scope || null,
      iqp || null,
      segmentation || null,
      description || null,
      id,
    ];

    const result = await clientConn.query(updateQuery, updateValues);
    if (result.rows.length === 0) {
      await clientConn.query('ROLLBACK');
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Actualizar países asociados preservando CPI existente
    const existingRes = await clientConn.query(
      'SELECT country_id, cpi FROM project_countries WHERE project_id = $1',
      [id]
    );
    const existingMap = new Map<number, number | null>();
    for (const row of existingRes.rows) existingMap.set(Number(row.country_id), row.cpi == null ? null : Number(row.cpi));

    const newCountries: number[] = Array.isArray(countries) ? countries.map((c: any) => Number(c)) : [];
    const newSet = new Set(newCountries);
    const oldSet = new Set(Array.from(existingMap.keys()));

    // Delete countries removed
    const toDelete: number[] = Array.from(oldSet).filter((cid) => !newSet.has(cid));
    if (toDelete.length > 0) {
      await clientConn.query(
        `DELETE FROM project_countries WHERE project_id = $1 AND country_id = ANY($2::int[])`,
        [id, toDelete]
      );
    }

    // Insertar países nuevos con CPI por defecto tomado de countries.cpi_by_default
    const toInsert: number[] = newCountries.filter((cid) => !oldSet.has(cid));
    if (toInsert.length > 0) {
      const insertCountriesQuery = `
        INSERT INTO project_countries (project_id, country_id, cpi)
        SELECT $1 AS project_id, c.id AS country_id, c.cpi_by_default AS cpi
        FROM countries c
        WHERE c.id = ANY($2::int[])
        ON CONFLICT (project_id, country_id) DO NOTHING;
      `;
      await clientConn.query(insertCountriesQuery, [id, toInsert]);
    }

    await clientConn.query('COMMIT');

    const fullProject = await clientConn.query(
      `SELECT p.*,
              COALESCE(pc.countries, '[]') AS countries
       FROM projects p
       LEFT JOIN (
         SELECT project_id, json_agg(country_id ORDER BY country_id) AS countries
         FROM project_countries WHERE project_id = $1 GROUP BY project_id
       ) pc ON pc.project_id = p.id
       WHERE p.id=$1`, [id]
    );

    res.json(normalizeProjectDates(fullProject.rows[0]));
  } catch (err) {
    await clientConn.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  } finally {
    clientConn.release();
  }
};

// 🔹 Eliminar un proyecto
export const deleteProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await Pool.query('DELETE FROM projects WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proyecto' });
  }
};
