import { Request, Response } from 'express';
import db from '../../db';

// GET /clients - returns all clients from the clients table
export const getClients = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM clients ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Error fetching clients' });
  }
};
