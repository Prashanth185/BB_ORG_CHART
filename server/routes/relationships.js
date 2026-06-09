import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const VALID_TYPES = ['reports_to', 'functional', 'project', 'collaboration'];

router.get('/', authenticateToken, (req, res) => {
  const { employee_id, manager_id, type } = req.query;
  let query = `
    SELECT r.*,
      e.name as employee_name, e.designation as employee_designation, e.employee_id as emp_code,
      m.name as manager_name, m.designation as manager_designation, m.employee_id as mgr_code
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    JOIN employees m ON m.id = r.manager_id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) { query += ' AND r.employee_id = ?'; params.push(employee_id); }
  if (manager_id) { query += ' AND r.manager_id = ?'; params.push(manager_id); }
  if (type) { query += ' AND r.relationship_type = ?'; params.push(type); }

  query += ' ORDER BY e.name';
  res.json(db.prepare(query).all(...params));
});

router.post('/', authenticateToken, (req, res) => {
  const { employee_id, manager_id, relationship_type } = req.body;

  if (!employee_id || !manager_id) {
    return res.status(400).json({ error: 'Employee and manager are required' });
  }

  const type = relationship_type || 'reports_to';
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid relationship type. Valid: ${VALID_TYPES.join(', ')}` });
  }

  if (employee_id === manager_id) {
    return res.status(400).json({ error: 'Employee cannot report to themselves' });
  }

  const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
  const mgr = db.prepare('SELECT id FROM employees WHERE id = ?').get(manager_id);
  if (!emp || !mgr) return res.status(404).json({ error: 'Employee or manager not found' });

  try {
    const result = db.prepare(`
      INSERT INTO relationships (employee_id, manager_id, relationship_type)
      VALUES (?, ?, ?)
    `).run(employee_id, manager_id, type);

    const rel = db.prepare(`
      SELECT r.*,
        e.name as employee_name, m.name as manager_name
      FROM relationships r
      JOIN employees e ON e.id = r.employee_id
      JOIN employees m ON m.id = r.manager_id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(rel);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This relationship already exists' });
    }
    throw err;
  }
});

router.post('/bulk', authenticateToken, (req, res) => {
  const { relationships } = req.body;
  if (!Array.isArray(relationships)) {
    return res.status(400).json({ error: 'relationships array required' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO relationships (employee_id, manager_id, relationship_type)
    VALUES (?, ?, ?)
  `);

  const created = [];
  const tx = db.transaction((rels) => {
    for (const rel of rels) {
      const type = rel.relationship_type || 'reports_to';
      if (!VALID_TYPES.includes(type)) continue;
      const result = insert.run(rel.employee_id, rel.manager_id, type);
      if (result.changes > 0) created.push(result.lastInsertRowid);
    }
  });

  tx(relationships);
  res.status(201).json({ created: created.length, ids: created });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { employee_id, manager_id, relationship_type } = req.body;
  const existing = db.prepare('SELECT * FROM relationships WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Relationship not found' });

  const nextEmployeeId = employee_id !== undefined ? Number(employee_id) : existing.employee_id;
  const nextManagerId = manager_id !== undefined ? Number(manager_id) : existing.manager_id;
  const nextType = relationship_type || existing.relationship_type;

  if (!VALID_TYPES.includes(nextType)) {
    return res.status(400).json({ error: `Invalid relationship type. Valid: ${VALID_TYPES.join(', ')}` });
  }

  if (nextEmployeeId === nextManagerId) {
    return res.status(400).json({ error: 'Employee cannot report to themselves' });
  }

  const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(nextEmployeeId);
  const mgr = db.prepare('SELECT id FROM employees WHERE id = ?').get(nextManagerId);
  if (!emp || !mgr) return res.status(404).json({ error: 'Employee or manager not found' });

  try {
    db.prepare(`
      UPDATE relationships
      SET employee_id = ?, manager_id = ?, relationship_type = ?
      WHERE id = ?
    `).run(nextEmployeeId, nextManagerId, nextType, req.params.id);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This relationship already exists' });
    }
    throw err;
  }

  const rel = db.prepare(`
    SELECT r.*, e.name as employee_name, m.name as manager_name
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    JOIN employees m ON m.id = r.manager_id
    WHERE r.id = ?
  `).get(req.params.id);

  res.json(rel);
});

router.delete('/:id', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM relationships WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Relationship not found' });
  res.json({ message: 'Relationship deleted' });
});

export default router;
