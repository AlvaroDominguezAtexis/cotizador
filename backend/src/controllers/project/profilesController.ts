// PUT /profiles/:id
export const updateProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    // Solo permite editar perfiles no oficiales
    const result = await pool.query(
      'UPDATE profiles SET name = $1 WHERE id = $2 AND is_official = false RETURNING id, name, is_official',
      [name, id]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'No se puede editar un perfil oficial o el perfil no existe' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando perfil', details: err });
  }
};
// DELETE /profiles/:id
export const deleteProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Solo eliminar si no es oficial
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 AND is_official = false RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'No se puede eliminar un perfil oficial o el perfil no existe' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando perfil', details: err });
  }
};
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
