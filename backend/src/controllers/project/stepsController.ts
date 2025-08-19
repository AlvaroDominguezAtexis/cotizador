import { Request, Response } from 'express';
import db from '../../db';

const DEBUG = process.env.DEBUG_STEPS === 'true';

const mapStep = (row: any) => ({
  id: row.id,
  deliverable_id: row.deliverable_id,
  profile_id: row.profile_id,
  country_id: row.country_id,
  nombre: row.nombre,
  unit: row.unit,
  // Compat fields from earliest yearly row (may be undefined if none)
  process_time: row.process_time != null ? Number(row.process_time) : undefined,
  mng: row.mng != null ? Number(row.mng) : undefined,
  office: row.office != null ? !!row.office : undefined,
  hardware: row.hardware != null ? !!row.hardware : undefined,
  year: row.year != null ? Number(row.year) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const getSteps = async (req: Request, res: Response) => {
  const { deliverableId } = req.params;
  try {
    const q = `
      SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
      FROM steps s
      LEFT JOIN LATERAL (
        SELECT year, process_time, mng, office, hardware
        FROM step_yearly_data y
        WHERE y.step_id = s.id
        ORDER BY year ASC
        LIMIT 1
      ) y ON TRUE
      WHERE s.deliverable_id = $1
      ORDER BY s.id ASC
    `;
    const result = await db.query(q, [deliverableId]);
    res.json(result.rows.map(mapStep));
  } catch (err) {
    console.error('Error fetching steps', err);
    res.status(500).json({ error: 'Error al obtener steps' });
  }
};

export const createStep = async (req: Request, res: Response) => {
  const { projectId, workPackageId, deliverableId } = req.params as any;
  const { profile_id, country_id, nombre, process_time, unit, office, hardware } = req.body as any;
  try {
    if (DEBUG) console.log('[stepsController#createStep] params', { projectId, workPackageId, deliverableId });
    if (DEBUG) console.log('[stepsController#createStep] body', { profile_id, country_id, nombre, process_time, unit, office, hardware });
    // Determine project years
    let years: number[] = [];
    if (projectId) {
      const pr = await db.query(`SELECT start_date, end_date FROM projects WHERE id = $1`, [projectId]);
      if (pr.rows.length > 0) {
        const sd = pr.rows[0].start_date ? new Date(pr.rows[0].start_date) : null;
        const ed = pr.rows[0].end_date ? new Date(pr.rows[0].end_date) : null;
        if (sd && ed) {
          const sy = sd.getFullYear();
          const ey = ed.getFullYear();
          for (let y = sy; y <= ey; y++) years.push(y);
        }
      }
    }
    if (DEBUG) console.log('[stepsController#createStep] computed years', years);
  // Default office and hardware to true (Yes) when creating a step
  const hw = hardware != null ? !!hardware : true;
  const ofc = office != null ? !!office : true;
  if (DEBUG) console.log('[stepsController#createStep] defaults', { office: ofc, hardware: hw });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Insert base step (no yearly fields here)
      const insertStep = `INSERT INTO steps (deliverable_id, profile_id, country_id, nombre, unit)
                          VALUES ($1,$2,$3,$4,$5) RETURNING *`;
      const stepRes = await client.query(insertStep, [deliverableId, profile_id, country_id, nombre, unit]);
      const step = stepRes.rows[0];
      if (DEBUG) console.log('[stepsController#createStep] inserted base step', { stepId: step.id });

      // Resolve mng from project_countries for the project and country (ignore body mng entirely)
      let resolvedMng: number | null = null;
      if (projectId && country_id) {
        const sql = `SELECT mng FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`;
        const params = [projectId, country_id];
        const mngRes = await client.query(sql, params);
        if (DEBUG) console.log('[stepsController#createStep] project_countries query', { sql, params, rows: mngRes.rows });
        resolvedMng = mngRes.rows.length > 0 && mngRes.rows[0].mng != null ? Number(mngRes.rows[0].mng) : null;
      }
      if (DEBUG) console.log('[stepsController#createStep] resolvedMng', resolvedMng);
      if (resolvedMng == null) {
        if (DEBUG) console.error('[stepsController#createStep] ERROR: mng not found in project_countries for provided project/country. Aborting step creation.', { projectId, country_id });
        const err: any = new Error('mng not found for (projectId, country_id) in project_countries');
        err.code = 'MNG_NOT_FOUND';
        err.status = 400;
        throw err;
      }

      // Create yearly rows for project span, cloning input values
      if (years.length > 0) {
        if (DEBUG) console.log('[stepsController#createStep] inserting yearly rows', { count: years.length });
        for (const y of years) {
          await client.query(
            `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (step_id, year) DO UPDATE SET process_time=EXCLUDED.process_time, mng=EXCLUDED.mng, office=EXCLUDED.office, hardware=EXCLUDED.hardware`,
            [step.id, y, process_time ?? null, resolvedMng, ofc, hw]
          );
        }
      } else {
        if (DEBUG) console.warn('[stepsController#createStep] project has no defined years (start_date/end_date). No yearly rows inserted.');
      }

      // Return step with earliest yearly snapshot for compatibility
      const joined = await client.query(
        `SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
         FROM steps s
         LEFT JOIN LATERAL (
           SELECT year, process_time, mng, office, hardware
           FROM step_yearly_data
           WHERE step_id = s.id
           ORDER BY year ASC
           LIMIT 1
         ) y ON TRUE
         WHERE s.id = $1`,
        [step.id]
      );
      await client.query('COMMIT');
  if (DEBUG) console.log('[stepsController#createStep] created step with earliest snapshot', { stepId: step.id });
      return res.status(201).json(mapStep(joined.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
  if (DEBUG) console.error('[stepsController#createStep] error, transaction rolled back', e);
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error creating step', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nombre de step duplicado en este deliverable' });
    }
    if (err.code === 'MNG_NOT_FOUND' || err.status === 400) {
      return res.status(400).json({
        error: 'Falta configuración de %Mng para el país del proyecto',
        detail: 'No existe registro en project_countries con mng para el par (projectId, country_id). Agrega el país al proyecto y/o define %Mng en Ajustes Avanzados.',
      });
    }
    res.status(500).json({ error: 'Error al crear step' });
  }
};

export const updateStep = async (req: Request, res: Response) => {
  const { stepId, deliverableId } = req.params;
  const { profile_id, country_id, nombre, unit } = req.body;
  try {
    const update = `UPDATE steps
                    SET profile_id=$1, country_id=$2, nombre=$3, unit=$4, updated_at=NOW()
                    WHERE id=$5 AND deliverable_id=$6
                    RETURNING *`;
    const values = [profile_id, country_id, nombre, unit, stepId, deliverableId];
    const result = await db.query(update, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step no encontrado' });
    // Attach earliest yearly snapshot for compatibility
    const joined = await db.query(
      `SELECT s.*, y.year, y.process_time, y.mng, y.office, y.hardware
       FROM steps s
       LEFT JOIN LATERAL (
         SELECT year, process_time, mng, office, hardware
         FROM step_yearly_data
         WHERE step_id = s.id
         ORDER BY year ASC
         LIMIT 1
       ) y ON TRUE
       WHERE s.id = $1`,
      [result.rows[0].id]
    );
    res.json(mapStep(joined.rows[0]));
  } catch (err: any) {
    console.error('Error updating step', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nombre de step duplicado en este deliverable' });
    }
    res.status(500).json({ error: 'Error al actualizar step' });
  }
};

export const deleteStep = async (req: Request, res: Response) => {
  const { stepId, deliverableId } = req.params;
  try {
    const del = 'DELETE FROM steps WHERE id=$1 AND deliverable_id=$2 RETURNING id';
    const result = await db.query(del, [stepId, deliverableId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting step', err);
    res.status(500).json({ error: 'Error al eliminar step' });
  }
};

// Annual data endpoints
export const getAnnualData = async (req: Request, res: Response) => {
  const { stepId } = req.params;
  try {
    const r = await db.query(
      'SELECT id, step_id, year, process_time, mng, office, hardware FROM step_yearly_data WHERE step_id=$1 ORDER BY year ASC',
      [stepId]
    );
    res.json(r.rows.map((row: any) => ({
      id: row.id,
      step_id: row.step_id,
      year: Number(row.year),
      process_time: row.process_time != null ? Number(row.process_time) : null,
      mng: row.mng != null ? Number(row.mng) : null,
      office: row.office != null ? !!row.office : null,
      hardware: row.hardware != null ? !!row.hardware : null,
    })));
  } catch (e) {
    console.error('Error get annual data', e);
    res.status(500).json({ error: 'Error al obtener datos anuales' });
  }
};

export const upsertAnnualData = async (req: Request, res: Response) => {
  const { stepId, year } = req.params as any;
  const { process_time, mng, office, hardware } = req.body as any;
  try {
    if (DEBUG) console.log('[stepsController#upsertAnnualData] params', { stepId, year });
    if (DEBUG) console.log('[stepsController#upsertAnnualData] body', { process_time, mng, office, hardware });
    const q = `INSERT INTO step_yearly_data (step_id, year, process_time, mng, office, hardware)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (step_id, year)
               DO UPDATE SET
                 process_time = COALESCE(EXCLUDED.process_time, step_yearly_data.process_time),
                 mng = COALESCE(EXCLUDED.mng, step_yearly_data.mng),
                 office = COALESCE(EXCLUDED.office, step_yearly_data.office),
                 hardware = COALESCE(EXCLUDED.hardware, step_yearly_data.hardware)
               RETURNING *`;
    const r = await db.query(q, [stepId, Number(year), process_time ?? null, mng ?? null, office ?? null, hardware ?? null]);
    const row = r.rows[0];
    res.json({ id: row.id, step_id: row.step_id, year: Number(row.year), process_time: row.process_time, mng: row.mng, office: row.office, hardware: row.hardware });
  } catch (e) {
    console.error('Error upsert annual data', e);
    res.status(500).json({ error: 'Error al guardar datos anuales' });
  }
};

export const deleteAnnualData = async (req: Request, res: Response) => {
  const { stepId, year } = req.params as any;
  try {
    const r = await db.query('DELETE FROM step_yearly_data WHERE step_id=$1 AND year=$2 RETURNING id', [stepId, Number(year)]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Registro anual no encontrado' });
    res.json({ success: true });
  } catch (e) {
    console.error('Error delete annual data', e);
    res.status(500).json({ error: 'Error al eliminar dato anual' });
  }
};
