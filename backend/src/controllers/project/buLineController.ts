import { Request, Response } from 'express';
import db from '../../db';

// GET /bu-lines - returns all BU lines from the bu_line table
export const getBuLines = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM bu_line ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching BU lines:', err);
    res.status(500).json({ error: 'Error fetching BU lines' });
  }
};
