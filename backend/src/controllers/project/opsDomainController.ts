import { Request, Response } from 'express';
import db from '../../db';

// GET /ops-domains - returns all ops domains from the ops_domain table
export const getOpsDomains = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM ops_domain ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching ops domains:', err);
    res.status(500).json({ error: 'Error fetching ops domains' });
  }
};
