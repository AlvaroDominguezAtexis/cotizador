import { Request, Response } from 'express';
import Pool from '../../db';
import db from '../../db';

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
    res.status(500).json({ error: 'Error al eliminar workpackage' });
  }
};

// POST /projects/:projectId/workpackages/time-and-material
export const createTimeAndMaterialWorkPackage = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Se requieren perfiles para crear Time & Material' });
  }

  const client = await Pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener años del proyecto
    const projectQuery = await client.query(
      'SELECT start_date, end_date FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectQuery.rows.length === 0) {
      throw new Error('Proyecto no encontrado');
    }

    const { start_date, end_date } = projectQuery.rows[0];
    const startYear = new Date(start_date).getFullYear();
    const endYear = new Date(end_date).getFullYear();
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // 2. Generar nombre dinámico del workpackage basado en los perfiles y países
    let workpackageName = 'Time & Material';
    
    if (rows.length > 0) {
      try {
        // Obtener todas las combinaciones únicas de perfil-ciudad
        const uniqueCombinations = new Map();
        
        for (const row of rows) {
          if (row?.profileId && row?.cityId) {
            const key = `${row.profileId}-${row.cityId}`;
            if (!uniqueCombinations.has(key)) {
              uniqueCombinations.set(key, { profileId: row.profileId, cityId: row.cityId });
            }
          }
        }

        if (uniqueCombinations.size > 0) {
          // Si hay una sola combinación, usar formato "Perfil - Ciudad"
          if (uniqueCombinations.size === 1) {
            const combination = Array.from(uniqueCombinations.values())[0];
            
            // Obtener nombre del perfil
            const profileResult = await client.query(
              'SELECT name FROM profiles WHERE id = $1',
              [combination.profileId]
            );
            
            // Obtener nombre de la ciudad
            const cityResult = await client.query(
              'SELECT name FROM cities WHERE id = $1',
              [combination.cityId]
            );
            
            if (profileResult.rows.length > 0 && cityResult.rows.length > 0) {
              const profileName = profileResult.rows[0].name;
              const cityName = cityResult.rows[0].name;
              workpackageName = `${profileName} - ${cityName}`;
            }
          } else {
            // Si hay múltiples combinaciones, usar nombre genérico con indicador
            workpackageName = `Time & Material (${uniqueCombinations.size} perfiles)`;
          }
        }
      } catch (nameError) {

        // Mantener el nombre por defecto si hay error
      }
    }

    // Crear workpackage con nombre dinámico
    const wpResult = await client.query(
      `INSERT INTO workpackages (project_id, codigo, nombre) VALUES ($1, $2, $3) RETURNING *`,
      [projectId, 'TM-001', workpackageName]
    );
    const workpackage = wpResult.rows[0];

    // 3. Crear deliverable "profiles"
    const deliverableResult = await client.query(
      `INSERT INTO deliverables (workpackage_id, codigo, nombre, margin_goal) VALUES ($1, $2, $3, $4) RETURNING *`,
      [workpackage.id, 'PROFILES-001', 'profiles', rows[0]?.marginGoal || 0]
    );
    const deliverable = deliverableResult.rows[0];

    // 4. Crear steps para cada perfil
    const createdSteps = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Crear step base (intentar con city_id primero, luego sin ciudad si falla)
      let stepResult;
      try {
        stepResult = await client.query(
          `INSERT INTO steps (deliverable_id, profile_id, country_id, city_id, nombre, unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [deliverable.id, row.profileId, row.countryId, row.cityId, row.stepName, 'Days']
        );
      } catch (cityError: any) {
        if (cityError.code === '42703') { // Column does not exist
          stepResult = await client.query(
            `INSERT INTO steps (deliverable_id, profile_id, country_id, nombre, unit) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [deliverable.id, row.profileId, row.countryId, row.stepName, 'Days']
          );
        } else {
          throw cityError;
        }
      }
      const step = stepResult.rows[0];
      createdSteps.push(step);

      // 4.1. Obtener valores por defecto del país (similar a steps normales)
      let defaultMng = 0;
      let defaultOffice = true; // Por defecto Yes
      let defaultHardware = true; // Por defecto Yes
      
      try {
        const countryDefaultsResult = await client.query(
          `SELECT mng FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
          [projectId, row.countryId]
        );
        
        if (countryDefaultsResult.rows.length > 0) {
          const countryData = countryDefaultsResult.rows[0];
          defaultMng = countryData.mng != null ? Number(countryData.mng) : 0;

        } else {

        }
      } catch (defaultsError) {

        // Continuar con valores por defecto globales
      }

      // 5. Crear datos anuales para cada año del proyecto (siempre crear uno por año)
      for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
        const year = years[yearIndex];
        const processTime = row.processTimePerYear?.[yearIndex] || row.processTime || 0;
        // Usar valores por defecto del país si no se especificaron valores personalizados
        const mng = row.mngPerYear?.[yearIndex] !== undefined ? row.mngPerYear[yearIndex] : defaultMng;
        const office = row.officePerYear?.[yearIndex] !== undefined 
          ? (row.officePerYear[yearIndex] === 'Yes') 
          : defaultOffice;
        const hardware = row.hardwarePerYear?.[yearIndex] !== undefined 
          ? (row.hardwarePerYear[yearIndex] === 'Yes') 
          : defaultHardware;

        await client.query(
          `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (step_id, year) DO UPDATE SET
             process_time = EXCLUDED.process_time,
             mng = EXCLUDED.mng,
             office = EXCLUDED.office,
             hardware = EXCLUDED.hardware`,
          [step.id, year, processTime, mng, office, hardware]
        );
      }

      // 6. Crear cantidades anuales del deliverable si están disponibles
      if (row.yearlyQuantities && Array.isArray(row.yearlyQuantities)) {
        for (let yearIndex = 0; yearIndex < row.yearlyQuantities.length; yearIndex++) {
          const quantity = row.yearlyQuantities[yearIndex] || 0;
          // Guardar todos los valores, incluso 0
          await client.query(
            `INSERT INTO deliverable_yearly_quantities (deliverable_id, year_number, quantity) 
             VALUES ($1, $2, $3)
             ON CONFLICT (deliverable_id, year_number) DO UPDATE SET
               quantity = EXCLUDED.quantity`,
            [deliverable.id, yearIndex + 1, quantity]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      workpackage: normalize(workpackage),
      deliverable: {
        id: deliverable.id,
        code: deliverable.codigo,
        name: deliverable.nombre,
        dm: deliverable.margin_goal,
        yearlyQuantities: []
      },
      steps: createdSteps.map((step, index) => ({
        id: step.id,
        name: step.nombre,
        profileId: step.profile_id,
        countryId: step.country_id,
        cityId: rows[index]?.cityId, // Agregar cityId desde los datos de entrada
        units: step.unit
      }))
    });

  } catch (err: any) {
    await client.query('ROLLBACK');

    
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un workpackage o deliverable con ese código' });
    }
    
    res.status(500).json({ 
      error: 'Error al crear workpackage Time & Material',
      details: err.message
    });
  } finally {
    client.release();
  }
};

// GET /projects/:projectId/workpackages/time-and-material
export const getTimeAndMaterialWorkPackage = async (req: Request, res: Response) => {
  const { projectId } = req.params;



  try {
    // Nueva lógica: Obtener TODOS los steps de Time & Material del proyecto,
    // Identificar workpackages Time & Material por código TM-001 (método más confiable)
    const allStepsResult = await Pool.query(`
      SELECT 
        s.id, s.nombre, s.profile_id, s.country_id, s.city_id, s.unit,
        s.deliverable_id,
        d.workpackage_id, d.codigo as deliverable_codigo, d.nombre as deliverable_nombre, d.margin_goal,
        w.id as workpackage_id, w.codigo as workpackage_codigo, w.nombre as workpackage_nombre, 
        w.created_at, w.updated_at,
        syd.year, syd.process_time, syd.mng, syd.office, syd.hardware
      FROM steps s
      JOIN deliverables d ON s.deliverable_id = d.id
      JOIN workpackages w ON d.workpackage_id = w.id
      LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
      WHERE w.project_id = $1 
        AND w.codigo = 'TM-001'
        AND d.nombre = 'profiles'
      ORDER BY w.created_at DESC, s.id, syd.year
    `, [projectId]);



    if (allStepsResult.rows.length === 0) {
      // No hay steps, buscar el workpackage más reciente que sea Time & Material por código
      const wpResult = await Pool.query(`
        SELECT * FROM workpackages 
        WHERE project_id = $1 AND codigo = 'TM-001'
        ORDER BY created_at DESC LIMIT 1
      `, [projectId]);



      if (wpResult.rows.length === 0) {

        return res.json({
          workpackage: null,
          deliverable: null,
          steps: []
        });
      }

      const workpackage = wpResult.rows[0];


      // Buscar el deliverable "profiles" asociado
      const deliverableResult = await Pool.query(`
        SELECT * FROM deliverables 
        WHERE workpackage_id = $1 AND nombre = 'profiles'
        LIMIT 1
      `, [workpackage.id]);



      return res.json({
        workpackage: normalize(workpackage),
        deliverable: deliverableResult.rows[0] ? {
          id: deliverableResult.rows[0].id,
          code: deliverableResult.rows[0].codigo,
          name: deliverableResult.rows[0].nombre,
          marginGoal: deliverableResult.rows[0].margin_goal,
          yearlyQuantities: []
        } : null,
        steps: []
      });
    }

    // Usar el primer step para determinar el workpackage y deliverable "principal"
    // (todos deberían tener la misma estructura, pero pueden estar distribuidos)
    const firstRow = allStepsResult.rows[0];
    const workpackage = {
      id: firstRow.workpackage_id,
      codigo: firstRow.workpackage_codigo,
      nombre: firstRow.workpackage_nombre,
      created_at: firstRow.created_at,
      updated_at: firstRow.updated_at
    };

    const deliverable = {
      id: firstRow.deliverable_id,
      codigo: firstRow.deliverable_codigo,
      nombre: firstRow.deliverable_nombre,
      margin_goal: firstRow.margin_goal
    };



    // Agrupar steps y sus datos anuales (pueden venir de múltiples workpackages)
    const stepsMap = new Map();
    
    for (const row of allStepsResult.rows) {
      if (!stepsMap.has(row.id)) {
        stepsMap.set(row.id, {
          id: row.id,
          name: row.nombre,
          profileId: row.profile_id,
          countryId: row.country_id,
          cityId: row.city_id,
          units: row.unit,
          deliverable_id: row.deliverable_id,
          workpackage_id: row.workpackage_id, // Mantener la referencia al workpackage real de cada step
          yearlyData: []
        });
      }

      if (row.year) {
        stepsMap.get(row.id).yearlyData.push({
          year: row.year,
          processTime: row.process_time || 0,
          mng: row.mng || 0,
          office: row.office || false,
          hardware: row.hardware || false
        });
      }
    }

    // Obtener cantidades anuales del deliverable principal
    const quantitiesResult = await Pool.query(`
      SELECT year_number, quantity
      FROM deliverable_yearly_quantities
      WHERE deliverable_id = $1
      ORDER BY year_number
    `, [deliverable.id]);

    const yearlyQuantities = quantitiesResult.rows.reduce((acc, row) => {
      acc[row.year_number - 1] = row.quantity;
      return acc;
    }, [] as number[]);

    const steps = Array.from(stepsMap.values());
    


    res.json({
      workpackage: normalize(workpackage),
      deliverable: {
        id: deliverable.id,
        code: deliverable.codigo,
        name: deliverable.nombre,
        marginGoal: deliverable.margin_goal,
        yearlyQuantities
      },
      steps: steps
    });

  } catch (err: any) {

    res.status(500).json({ 
      error: 'Error al obtener workpackage Time & Material',
      details: err.message
    });
  }
};

// PUT /projects/:projectId/workpackages/:workpackageId/steps/:stepId/time-and-material
export const updateTimeAndMaterialStep = async (req: Request, res: Response) => {
  const { projectId, workpackageId, stepId } = req.params;
  const { profileId, countryId, cityId, processTime, marginGoal, yearlyQuantities, processTimePerYear, mngPerYear, officePerYear, hardwarePerYear } = req.body;

  const client = await Pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que el step pertenece al proyecto correcto
    const stepCheck = await client.query(`
      SELECT s.id, s.deliverable_id, d.workpackage_id, w.project_id 
      FROM steps s
      JOIN deliverables d ON s.deliverable_id = d.id
      JOIN workpackages w ON d.workpackage_id = w.id
      WHERE s.id = $1 AND w.id = $2 AND w.project_id = $3
    `, [stepId, workpackageId, projectId]);

    if (stepCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Step no encontrado o no pertenece al proyecto' });
    }

    const step = stepCheck.rows[0];

    // 2. Obtener años del proyecto
    const projectQuery = await client.query(
      'SELECT start_date, end_date FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectQuery.rows.length === 0) {
      throw new Error('Proyecto no encontrado');
    }

    const { start_date, end_date } = projectQuery.rows[0];
    const startYear = new Date(start_date).getFullYear();
    const endYear = new Date(end_date).getFullYear();
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // 3. Actualizar el step básico
    let updateStepQuery;
    let stepValues;
    if (cityId != null) {
      updateStepQuery = `UPDATE steps SET profile_id=$1, country_id=$2, city_id=$3, updated_at=NOW() WHERE id=$4 RETURNING *`;
      stepValues = [profileId, countryId, cityId, stepId];
    } else {
      updateStepQuery = `UPDATE steps SET profile_id=$1, country_id=$2, updated_at=NOW() WHERE id=$3 RETURNING *`;
      stepValues = [profileId, countryId, stepId];
    }

    const stepResult = await client.query(updateStepQuery, stepValues);
    const updatedStep = stepResult.rows[0];

    // 3.1. Obtener valores por defecto del país (similar a steps normales y creación de Time & Material)
    let defaultMng = 0;
    let defaultOffice = true; // Por defecto Yes
    let defaultHardware = true; // Por defecto Yes
    
    try {
      const countryDefaultsResult = await client.query(
        `SELECT mng FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
        [projectId, countryId]
      );
      
      if (countryDefaultsResult.rows.length > 0) {
        const countryData = countryDefaultsResult.rows[0];
        defaultMng = countryData.mng != null ? Number(countryData.mng) : 0;

      } else {

      }
    } catch (defaultsError) {

      // Continuar con valores por defecto globales
    }

    // 4. Actualizar datos anuales del step
    for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
      const year = years[yearIndex];
      const processTimeYear = processTimePerYear?.[yearIndex] || processTime || 0;
      // Usar valores por defecto del país si no se especificaron valores personalizados
      const mng = mngPerYear?.[yearIndex] !== undefined ? mngPerYear[yearIndex] : defaultMng;
      const office = officePerYear?.[yearIndex] !== undefined 
        ? (officePerYear[yearIndex] === 'Yes') 
        : defaultOffice;
      const hardware = hardwarePerYear?.[yearIndex] !== undefined 
        ? (hardwarePerYear[yearIndex] === 'Yes') 
        : defaultHardware;

      await client.query(
        `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (step_id, year) DO UPDATE SET
           process_time = EXCLUDED.process_time,
           mng = EXCLUDED.mng,
           office = EXCLUDED.office,
           hardware = EXCLUDED.hardware`,
        [stepId, year, processTimeYear, mng, office, hardware]
      );
    }

    // 5. Actualizar margin goal del deliverable si se proporciona
    if (marginGoal != null) {
      await client.query(
        `UPDATE deliverables SET margin_goal = $1 WHERE id = $2`,
        [marginGoal, step.deliverable_id]
      );
    }

    // 6. Actualizar cantidades anuales del deliverable si se proporcionan
    if (yearlyQuantities && Array.isArray(yearlyQuantities)) {
      // Primero, limpiar cantidades existentes para este deliverable
      await client.query(
        `DELETE FROM deliverable_yearly_quantities WHERE deliverable_id = $1`,
        [step.deliverable_id]
      );

      // Luego, insertar las nuevas cantidades (incluyendo valores 0)
      for (let yearIndex = 0; yearIndex < yearlyQuantities.length; yearIndex++) {
        const quantity = yearlyQuantities[yearIndex] || 0;
        // Guardar todos los valores, incluso 0
        await client.query(
          `INSERT INTO deliverable_yearly_quantities (deliverable_id, year_number, quantity) 
           VALUES ($1, $2, $3)`,
          [step.deliverable_id, yearIndex + 1, quantity]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      step: {
        id: updatedStep.id,
        name: updatedStep.nombre,
        profileId: updatedStep.profile_id,
        countryId: updatedStep.country_id,
        cityId: updatedStep.city_id,
        units: updatedStep.unit
      },
      message: 'Perfil Time & Material actualizado correctamente'
    });

  } catch (err: any) {
    await client.query('ROLLBACK');

    res.status(500).json({ 
      error: 'Error al actualizar perfil Time & Material',
      details: err.message
    });
  } finally {
    client.release();
  }
};

// DELETE /projects/:projectId/workpackages/:workpackageId/steps/:stepId
export const deleteStep = async (req: Request, res: Response) => {
  const { projectId, workpackageId, stepId } = req.params;
  

  
  const client = await Pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Buscar el step y obtener el workpackage asociado
    const stepCheck = await client.query(`
      SELECT s.id, s.deliverable_id, d.workpackage_id, w.project_id, w.nombre as workpackage_name
      FROM steps s
      JOIN deliverables d ON s.deliverable_id = d.id
      JOIN workpackages w ON d.workpackage_id = w.id
      WHERE s.id = $1 AND w.project_id = $2
    `, [stepId, projectId]);

    if (stepCheck.rows.length === 0) {

      return res.status(404).json({ error: 'Step no encontrado o no pertenece al proyecto' });
    }

    const step = stepCheck.rows[0];
    const realWorkpackageId = step.workpackage_id;
    


    // 2. Eliminar el workpackage completo - CASCADE se encargará del resto
    // Esto eliminará automáticamente:
    // - deliverables (ON DELETE CASCADE)
    // - deliverable_yearly_quantities (ON DELETE CASCADE) 
    // - steps (ON DELETE CASCADE)
    // - step_yearly_data (ON DELETE CASCADE)
    const deleteResult = await client.query(
      'DELETE FROM workpackages WHERE id = $1 AND project_id = $2',
      [realWorkpackageId, projectId]
    );

    if (deleteResult.rowCount === 0) {
      throw new Error('No se pudo eliminar el workpackage');
    }

    await client.query('COMMIT');



    res.json({ 
      success: true,
      message: 'Perfil Time & Material eliminado correctamente',
      deletedStep: parseInt(stepId),
      deletedDeliverable: step.deliverable_id,
      deletedWorkpackage: realWorkpackageId
    });

  } catch (err: any) {
    await client.query('ROLLBACK');

    res.status(500).json({ 
      error: 'Error al eliminar perfil Time & Material',
      details: err.message
    });
  } finally {
    client.release();
  }
};
