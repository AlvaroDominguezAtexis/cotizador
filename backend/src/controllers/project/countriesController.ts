import { Request, Response } from 'express';
import db from '../../db';

// GET /countries - returns all countries from the countries table
export const getCountries = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM countries ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching countries:', err);
    res.status(500).json({ error: 'Error fetching countries' });
  }
};
