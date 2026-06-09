import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (_req, res) => {
  const departments = db.prepare('SELECT id, name FROM departments ORDER BY name').all();
  res.json(departments);
});

router.post('/', authenticateToken, (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  const existing = db.prepare('SELECT id, name FROM departments WHERE name = ?').get(name);
  if (existing) {
    return res.status(200).json(existing);
  }

  try {
    const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      const row = db.prepare('SELECT id, name FROM departments WHERE name = ?').get(name);
      return res.json(row);
    }
    console.error('Create department error:', err);
    res.status(500).json({ error: err.message || 'Failed to add department' });
  }
});

export default router;
