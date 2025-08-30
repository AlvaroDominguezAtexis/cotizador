import { Request, Response } from 'express';
import db from '../../db';

// GET /countries/:countryId/cities - return cities for a country
export const getCountryCities = async (req: Request, res: Response) => {
  const { countryId } = req.params as any;
  try {
    const q = 'SELECT id, name FROM cities WHERE country_id = $1 ORDER BY name ASC';
    const r = await db.query(q, [countryId]);
    res.json(r.rows);
  } catch (e) {
    console.error('Error fetching cities for country', e);
    res.status(500).json({ error: 'Error fetching cities' });
  }
};
