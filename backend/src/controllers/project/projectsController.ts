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

// 🔹 Obtener todos los proyectos
export const getProjects = async (req: Request, res: Response) => {
  try {
    const result = await Pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    const normalized = result.rows.map(normalizeProjectDates);
    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
};

// 🔹 Obtener un proyecto por ID
export const getProjectById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await Pool.query('SELECT * FROM projects WHERE id = $1', [id]);
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
  try {
    const {
      title,
      crm_code,
      client,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      scope,
      additional_countries,
      iqp,
      segmentation,
      description
    } = req.body;

    const query = `
      INSERT INTO projects
      (title, crm_code, client, activity, start_date, end_date,
       business_manager, business_unit, ops_domain, scope,
       additional_countries, iqp, segmentation, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *;
    `;

    const values = [
      title || null,
      crm_code || null,
      client || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
      ops_domain || null,
      scope || null,
      additional_countries || null,
      iqp || null,
      segmentation || null,
      description || null,
    ];

    const result = await Pool.query(query, values);
    res.status(201).json(normalizeProjectDates(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
};

// 🔹 Actualizar un proyecto
export const updateProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const {
      title,
      crm_code,
      client,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      scope,
      additional_countries,
      iqp,
      segmentation,
      description
    } = req.body;

    const query = `
      UPDATE projects
      SET title=$1, crm_code=$2, client=$3, activity=$4,
          start_date=$5, end_date=$6,
          business_manager=$7, business_unit=$8, ops_domain=$9,
          scope=$10, additional_countries=$11,
          iqp=$12, segmentation=$13, description=$14,
          updated_at=NOW()
      WHERE id=$15
      RETURNING *;
    `;

    const values = [
      title || null,
      crm_code || null,
      client || null,
      activity || null,
      start_date || null,
      end_date || null,
      business_manager || null,
      business_unit || null,
      ops_domain || null,
      scope || null,
      additional_countries || null,
      iqp || null,
      segmentation || null,
      description || null,
      id,
    ];

    const result = await Pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(normalizeProjectDates(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
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
