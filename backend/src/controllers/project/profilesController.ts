// backend/src/controllers/project/profilesController.ts
import { Request, Response } from 'express';
import pool from '../../db';

// GET /profiles?official=true
export const getProfiles = async (req: Request, res: Response) => {
  try {
    const { official } = req.query;
    let query = 'SELECT id, name, is_official FROM profiles';
    let params: any[] = [];
    if (official === 'true') {
      query += ' WHERE is_official = true';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching profiles' });
  }
};

// POST /profiles
export const createProfile = async (req: Request, res: Response) => {
  try {
    const { name, is_official } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await pool.query(
      'INSERT INTO profiles (name, is_official) VALUES ($1, $2) RETURNING id, name, is_official',
      [name, is_official === true || is_official === 'true']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creating profile' });
  }
};
