import { Request, Response } from 'express';
import db from '../../db';

// GET /business-units - returns all business units from the business_unit table
export const getBusinessUnits = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM business_unit ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching business units:', err);
    res.status(500).json({ error: 'Error fetching business units' });
  }
};
