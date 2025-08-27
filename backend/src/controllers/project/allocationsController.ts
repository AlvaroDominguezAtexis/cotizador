import { Request, Response } from 'express';
import db from '../../db';

// GET /projects/:projectId/allocations
export const getProjectAllocations = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const yearParam = (req.query?.year as string) ? Number(req.query.year as string) : undefined;
  if (!projectId) return res.status(400).send('projectId required');
  try {
    console.log('Getting allocations for project:', projectId);
    // Check DB connection
    await db.query('SELECT 1');
    console.log('Database connection successful');
    
  // Join a single salary row per profile-country. If year is provided, filter by it; else pick earliest available year to avoid duplicates.
    const query = `
      SELECT
        s.id as step_id,
        s.nombre as step_name,
        syd.process_time,
        s.country_id,
        c.name as country_name,
        s.profile_id,
        p.name as profile_name,
        pps.year as salary_year,
        d.id as deliverable_id,
        d.nombre as deliverable_name,
        w.id as workpackage_id,
        w.nombre as workpackage_name,
        syd.year as step_year
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      LEFT JOIN step_yearly_data syd ON s.id = syd.step_id AND ($2::int IS NULL OR syd.year = $2)
      LEFT JOIN countries c ON c.id = s.country_id
      LEFT JOIN profiles p ON p.id = s.profile_id
      LEFT JOIN project_profiles pp ON (pp.project_id = w.project_id AND pp.profile_id = s.profile_id)
      LEFT JOIN LATERAL (
        SELECT pps1.*
        FROM project_profile_salaries pps1
        WHERE pps1.project_profile_id = pp.id
          AND pps1.country_id = s.country_id
          AND ($2::int IS NULL OR pps1.year = $2::int)
        ORDER BY pps1.year ASC
        LIMIT 1
      ) pps ON true
      WHERE w.project_id = $1
    `;
    console.log('Executing query with params:', [projectId, yearParam ?? null]);
    const { rows } = await db.query(query, [projectId, yearParam ?? null]);
    console.log('Found allocations:', rows.length);
    const mapped = rows.map((r: any) => ({
      stepId: r.step_id,
      step: r.step_name,
      process_time: Number(r.process_time) || 0,
      year: r.step_year,
      country_id: r.country_id,
      country_name: r.country_name,
      profile_id: r.profile_id,
      profile_name: r.profile_name,
      salary_year: r.salary_year ?? null,
      deliverable_id: r.deliverable_id,
      deliverable: r.deliverable_name,
      workpackage_id: r.workpackage_id,
      workpackage: r.workpackage_name,
    }));
    res.json(mapped);
  } catch (e: any) {
    console.error('getProjectAllocations error', e);
    res.status(500).send('Error fetching allocations');
  }
};

// GET /projects/:projectId/allocations/summary
export const getProjectAllocationsSummary = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  if (!projectId) return res.status(400).send('projectId required');
  try {
    const totalQ = `
      SELECT COALESCE(SUM(s.process_time), 0) AS total_hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      WHERE w.project_id = $1
    `;
    const byWPQ = `
      SELECT COALESCE(w.nombre, 'Unknown') AS name, COALESCE(SUM(s.process_time), 0) AS hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      WHERE w.project_id = $1
      GROUP BY w.nombre
      ORDER BY name
    `;
    const byDeliverableQ = `
      SELECT COALESCE(d.nombre, 'Unknown') AS name, COALESCE(SUM(s.process_time), 0) AS hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      WHERE w.project_id = $1
      GROUP BY d.nombre
      ORDER BY name
    `;
    const byCountryQ = `
      SELECT COALESCE(c.name, 'Unknown') AS name, COALESCE(SUM(s.process_time), 0) AS hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      LEFT JOIN countries c ON c.id = s.country_id
      WHERE w.project_id = $1
      GROUP BY c.name
      ORDER BY name
    `;
    const byProfileQ = `
      SELECT COALESCE(p.name, 'Unknown') AS name, COALESCE(SUM(s.process_time), 0) AS hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      LEFT JOIN profiles p ON p.id = s.profile_id
      WHERE w.project_id = $1
      GROUP BY p.name
      ORDER BY name
    `;

    const byWPDeliverableQ = `
      SELECT w.nombre AS workpackage, d.nombre AS deliverable, COALESCE(SUM(s.process_time), 0) AS hours
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages w ON w.id = d.workpackage_id
      WHERE w.project_id = $1
      GROUP BY w.nombre, d.nombre
      ORDER BY w.nombre, d.nombre
    `;

    const [totalR, wpR, delR, ctryR, profR, wpDelR] = await Promise.all([
      db.query(totalQ, [projectId]),
      db.query(byWPQ, [projectId]),
      db.query(byDeliverableQ, [projectId]),
      db.query(byCountryQ, [projectId]),
      db.query(byProfileQ, [projectId]),
      db.query(byWPDeliverableQ, [projectId]),
    ]);

    const computeFTE = (hours: number) => hours / 1600;
    const totalHours = Number(totalR.rows?.[0]?.total_hours ?? 0);
    const totalFTE = computeFTE(totalHours);
    const mapRows = (rows: any[]) => rows.map(r => ({ name: String(r.name), fte: computeFTE(Number(r.hours) || 0) }));

    // Build nested deliverables per workpackage
    const delivByWPMap = new Map<string, { name: string; fte: number }[]>();
    for (const row of (wpDelR.rows || [])) {
      const wp = String(row.workpackage || 'Unknown');
      const list = delivByWPMap.get(wp) || [];
      list.push({ name: String(row.deliverable || 'Unknown'), fte: computeFTE(Number(row.hours) || 0) });
      delivByWPMap.set(wp, list);
    }
    const deliverablesByWorkpackage = Array.from(delivByWPMap.entries()).map(([workpackage, deliverables]) => ({ workpackage, deliverables }));

    res.json({
      totalFTE,
      byWorkpackage: mapRows(wpR.rows || []),
      byDeliverable: mapRows(delR.rows || []),
      byCountry: mapRows(ctryR.rows || []),
      byProfile: mapRows(profR.rows || []),
      deliverablesByWorkpackage,
    });
  } catch (e: any) {
    console.error('getProjectAllocationsSummary error', e);
    res.status(500).send('Error computing allocations summary');
  }
};

