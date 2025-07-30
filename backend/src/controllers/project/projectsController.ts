
import { Request, Response } from 'express';
import Pool from '../../db';
import { Project } from '../../../src/types/Project/Projects';

// Eliminar un proyecto
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await Pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json({ message: 'Proyecto eliminado', project: result.rows[0] });
  } catch (err) {
    console.error('❌ Error en deleteProject:', err);
    res.status(500).json({ error: 'Error al eliminar el proyecto' });
  }
};

// Obtener todos los proyectos
export const getProjects = async (req: Request, res: Response) => {
  try {
    const result = await Pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    console.log('DEBUG getProjects result.rows:', JSON.stringify(result.rows, null, 2));
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
};

// Crear un proyecto
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
      country,
      scope,
      additional_countries,
      iqp,
      segmentation,
      description,
    } = req.body;

    // Only title is required
    const requiredFields = ['title'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltantes', 
        missingFields 
      });
    }

    const query = `
      INSERT INTO projects
      (title, crm_code, client, activity, start_date, end_date, business_manager, business_unit,
       ops_domain, country, scope, additional_countries, iqp, segmentation, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *;
    `;

    const values = [
      title,
      crm_code,
      client,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      country,
      scope,
      JSON.stringify(additional_countries),
      iqp,
      segmentation,
      description,
    ];

    const result = await Pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('❌ Error en createProject:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};
export const updateProject = async (req: Request, res: Response) => {
  try {
    // Detailed logging of incoming request
    console.log('Update Project Request:', {
      params: req.params,
      body: JSON.stringify(req.body, null, 2)
    });

    const { id } = req.params;
    
    // Additional ID validation
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ 
        error: 'ID de proyecto inválido',
        details: `Received ID: ${id}`
      });
    }

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
      country,
      scope,
      additional_countries,
      iqp,
      segmentation,
      description,
    } = req.body;

    // Validate required fields
    const requiredFields = ['title'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltantes', 
        missingFields 
      });
    }

    const query = `
      UPDATE projects SET
        title = $1,
        crm_code = $2,
        client = $3,
        activity = $4,
        start_date = $5,
        end_date = $6,
        business_manager = $7,
        business_unit = $8,
        ops_domain = $9,
        country = $10,
        scope = $11,
        additional_countries = $12,
        iqp = $13,
        segmentation = $14,
        description = $15,
        updated_at = NOW()
      WHERE id = $16
      RETURNING *;
    `;

    // Ensure additional_countries is always a JSON string
    const processedAdditionalCountries = 
      additional_countries 
        ? (typeof additional_countries === 'string' 
            ? additional_countries 
            : JSON.stringify(additional_countries))
        : JSON.stringify([]);

    const values = [
      title,
      crm_code,
      client,
      activity,
      start_date,
      end_date,
      business_manager,
      business_unit,
      ops_domain,
      country,
      scope,
      processedAdditionalCountries,
      iqp,
      segmentation,
      description,
      projectId,
    ];

    // Log processed values for debugging
    console.log('Processed Update Values:', values.map((v, i) => `$${i+1}: ${JSON.stringify(v)}`));

    const result = await Pool.query(query, values);
    
    if (result.rows.length === 0) {
      console.log(`No project found with id: ${projectId}`);
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    // Comprehensive error logging
    console.error('Full update error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
      detail: err.detail
    });

    // More detailed error response
    res.status(500).json({ 
      error: 'Error al actualizar el proyecto',
      details: err.message,
      code: err.code
    });
  }
};
