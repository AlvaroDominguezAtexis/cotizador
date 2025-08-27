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
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      deliverable_qtys AS (
        SELECT 
          deliverable_id,
          year_number as year,
          quantity as yearly_quantity,
          deliverable_name
        FROM raw_quantities
        WHERE quantity IS NOT NULL
      ),
      step_data AS (
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
          syd.year as step_year,
          COALESCE(syd.fte, 0) as base_fte,
          COALESCE(dq.quantity, 0) as deliverable_quantity,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id AND ($2::int IS NULL OR syd.year = $2)
        LEFT JOIN countries c ON c.id = s.country_id
        LEFT JOIN profiles p ON p.id = s.profile_id
        LEFT JOIN project_profiles pp ON (pp.project_id = w.project_id AND pp.profile_id = s.profile_id)
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
        LEFT JOIN LATERAL (
          SELECT pps1.*
          FROM project_profile_salaries pps1
          WHERE pps1.project_profile_id = pp.id
            AND pps1.country_id = s.country_id
            AND ($2::int IS NULL OR pps1.year = $2::int)
          ORDER BY pps1.year ASC
          LIMIT 1
        ) pps ON true
      )
    `;
    console.log('Executing query with params:', [projectId, yearParam ?? null]);
    const { rows } = await db.query(query + ' SELECT * FROM step_data ORDER BY step_id', [projectId, yearParam ?? null]);
    console.log('Found allocations:', rows.length);
    console.log('Allocation details:');
    rows.forEach((r: any) => {
      console.log(`Step: ${r.step_name}
        - Year: ${r.step_year}
        - Base FTE: ${r.base_fte}
        - Deliverable: ${r.deliverable_name}
        - Deliverable Quantity: ${r.deliverable_quantity}
        - Calculated FTE: ${r.calculated_fte}
      `);
    });
    const mapped = rows.map((r: any) => ({
      stepId: r.step_id,
      step: r.step_name,
      process_time: Number(r.process_time) || 0,
      year: r.step_year,
      country_id: r.country_id,
      country_name: r.country_name,
      profile_id: r.profile_id,
      profile_name: r.profile_name,
      fte: Number(r.calculated_fte) || 0, // Using the calculated FTE that includes quantity
      base_fte: Number(r.fte) || 0, // Original FTE without quantity
      deliverable_quantity: Number(r.deliverable_quantity) || 0,
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
  console.log('=== Starting getProjectAllocationsSummary ===');
  const { projectId } = req.params as { projectId: string };
  console.log('Project ID:', projectId);
  if (!projectId) return res.status(400).send('projectId required');
  try {
    console.log('Attempting to fetch allocation summary...');
    const totalQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          s.id as step_id,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
      )
      SELECT COALESCE(SUM(calculated_fte), 0) AS total_fte
      FROM step_fte_data
    `;
    const byWPQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          w.nombre as wp_name,
          s.id as step_id,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte,
          c.name as country_name,
          p.name as profile_name
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
        LEFT JOIN countries c ON c.id = s.country_id
        LEFT JOIN profiles p ON p.id = s.profile_id
      )
      SELECT 
        COALESCE(wp_name, 'Unknown') AS name,
        COALESCE(SUM(calculated_fte), 0) AS fte,
        string_agg(DISTINCT country_name, ', ') as countries,
        string_agg(DISTINCT profile_name, ', ') as profiles
      FROM step_fte_data
      GROUP BY wp_name
      ORDER BY name
    `;
    const byDeliverableQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          d.nombre as del_name,
          s.id as step_id,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          COALESCE(dq.quantity, 0) as deliverable_quantity,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
      )
      SELECT 
        COALESCE(del_name, 'Unknown') as name,
        COALESCE(SUM(calculated_fte), 0) as fte
      FROM step_fte_data
      GROUP BY del_name
      ORDER BY name
    `;
    const byCountryQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          s.id as step_id,
          c.name as country_name,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN countries c ON c.id = s.country_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
      )
      SELECT 
        COALESCE(country_name, 'Unknown') AS name,
        COALESCE(SUM(calculated_fte), 0) AS fte
      FROM step_fte_data
      GROUP BY country_name
      ORDER BY name
    `;
    const byProfileQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          s.id as step_id,
          p.name as profile_name,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN profiles p ON p.id = s.profile_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
      )
      SELECT 
        COALESCE(profile_name, 'Unknown') AS name,
        COALESCE(SUM(calculated_fte), 0) AS fte
      FROM step_fte_data
      GROUP BY profile_name
      ORDER BY name
    `;

    const byWPDeliverableQ = `
      WITH raw_quantities AS (
        SELECT
          d.id as deliverable_id,
          d.nombre as deliverable_name,
          dyq.year_number,
          dyq.quantity
        FROM deliverables d
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN deliverable_yearly_quantities dyq ON d.id = dyq.deliverable_id
      ),
      step_fte_data AS (
        SELECT 
          w.nombre as workpackage,
          d.nombre as deliverable,
          syd.year,
          COALESCE(syd.fte, 0) as base_fte,
          CASE 
            WHEN dq.quantity > 0 THEN COALESCE(syd.fte, 0) * dq.quantity
            ELSE COALESCE(syd.fte, 0)
          END as calculated_fte
        FROM steps s
        JOIN deliverables d ON d.id = s.deliverable_id
        JOIN workpackages w ON w.id = d.workpackage_id AND w.project_id = $1
        JOIN projects proj ON proj.id = w.project_id
        LEFT JOIN step_yearly_data syd ON s.id = syd.step_id
        LEFT JOIN raw_quantities dq ON 
          d.id = dq.deliverable_id AND 
          dq.year_number = (syd.year - EXTRACT(YEAR FROM proj.start_date::date)::integer + 1)
      )
      SELECT 
        workpackage,
        deliverable,
        COALESCE(SUM(calculated_fte), 0) AS fte
      FROM step_fte_data
      GROUP BY workpackage, deliverable
      ORDER BY workpackage, deliverable
    `;

    console.log('Executing allocation summary queries for project:', projectId);

    // Log the queries before execution
    console.log('Total FTE Query:', totalQ);
    
    // Execute all queries in parallel
    const [totalR, wpR, delR, ctryR, profR, wpDelR] = await Promise.all([
      db.query(totalQ, [projectId]),
      db.query(byWPQ, [projectId]),
      db.query(byDeliverableQ, [projectId]),
      db.query(byCountryQ, [projectId]),
      db.query(byProfileQ, [projectId]),
      db.query(byWPDeliverableQ, [projectId]),
    ]);

    console.log('Raw query results:', {
      total: totalR.rows,
      byWorkpackage: wpR.rows,
      byDeliverable: delR.rows,
      byCountry: ctryR.rows,
      byProfile: profR.rows
    });

    const totalFTE = Number(totalR.rows?.[0]?.total_fte ?? 0);
    console.log('Total FTE:', totalFTE);
    
    const mapRows = (rows: any[]) => {
      const mapped = rows.map(r => ({ name: String(r.name), fte: Number(r.fte) || 0 }));
      return mapped;
    };

    // Build nested deliverables per workpackage
    const delivByWPMap = new Map<string, { name: string; fte: number }[]>();
    for (const row of (wpDelR.rows || [])) {
      const wp = String(row.workpackage || 'Unknown');
      const list = delivByWPMap.get(wp) || [];
      list.push({ name: String(row.deliverable || 'Unknown'), fte: Number(row.fte) || 0 });
      delivByWPMap.set(wp, list);
    }
    const deliverablesByWorkpackage = Array.from(delivByWPMap.entries()).map(([workpackage, deliverables]) => ({ workpackage, deliverables }));

    const response = {
      totalFTE,
      byWorkpackage: mapRows(wpR.rows || []),
      byDeliverable: mapRows(delR.rows || []),
      byCountry: mapRows(ctryR.rows || []),
      byProfile: mapRows(profR.rows || []),
      deliverablesByWorkpackage,
    };

    console.log('Summary response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (e: any) {
    console.error('getProjectAllocationsSummary error', e);
    res.status(500).send('Error computing allocations summary');
  }
};

