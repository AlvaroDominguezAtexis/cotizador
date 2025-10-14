import { Request, Response } from 'express';
import pool from '../../db';

// GET /api/officialprofile-salaries
export const getOfficialProfileSalaries = async (req: Request, res: Response) => {
  try {
    // Obtener salarios de perfiles oficiales desde project_profile_salaries
    // Filtrando solo los que corresponden a perfiles oficiales
    const query = `
      SELECT DISTINCT
        pp.profile_id,
        pps.country_id,
        pps.salary
      FROM project_profile_salaries pps
      JOIN project_profiles pp ON pps.project_profile_id = pp.id
      JOIN profiles p ON pp.profile_id = p.id
      WHERE p.is_official = true
      ORDER BY pp.profile_id, pps.country_id
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching official profile salaries:', err);
    res.status(500).json({ error: 'Error fetching official profile salaries', details: err });
  }
};