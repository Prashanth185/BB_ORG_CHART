import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/span-of-control', authenticateToken, (_req, res) => {
  const data = db.prepare(`
    SELECT e.id, e.name, e.designation, d.name as department,
      COUNT(r.employee_id) as direct_reports
    FROM employees e
    LEFT JOIN relationships r ON r.manager_id = e.id AND r.relationship_type = 'reports_to'
    LEFT JOIN departments d ON d.id = e.department_id
    GROUP BY e.id
    HAVING direct_reports > 0
    ORDER BY direct_reports DESC
  `).all();

  res.json(data);
});

router.get('/department-distribution', authenticateToken, (_req, res) => {
  const data = db.prepare(`
    SELECT d.name as department, COUNT(e.id) as count
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id
    GROUP BY d.id
    ORDER BY count DESC
  `).all();
  res.json(data);
});

router.get('/matrix-report', authenticateToken, (_req, res) => {
  const data = db.prepare(`
    SELECT e.name as employee, e.designation,
      GROUP_CONCAT(m.name || ' (' || r.relationship_type || ')', ', ') as managers
    FROM employees e
    JOIN relationships r ON r.employee_id = e.id
    JOIN employees m ON m.id = r.manager_id
    GROUP BY e.id
    HAVING COUNT(r.id) > 1
    ORDER BY e.name
  `).all();
  res.json(data);
});

router.get('/location-report', authenticateToken, (_req, res) => {
  const data = db.prepare(`
    SELECT l.name as location, l.city, l.country, COUNT(e.id) as count
    FROM locations l
    LEFT JOIN employees e ON e.location_id = l.id
    GROUP BY l.id
    ORDER BY count DESC
  `).all();
  res.json(data);
});

router.get('/export', authenticateToken, (req, res) => {
  const { type = 'employees' } = req.query;

  let data;
  if (type === 'relationships') {
    data = db.prepare(`
      SELECT e.name as employee, e.employee_id, m.name as manager,
        r.relationship_type, d.name as department
      FROM relationships r
      JOIN employees e ON e.id = r.employee_id
      JOIN employees m ON m.id = r.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER BY e.name
    `).all();
  } else {
    data = db.prepare(`
      SELECT e.employee_id, e.name, e.designation, e.email, e.phone,
        d.name as department, bu.name as business_unit, l.name as location
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN business_units bu ON bu.id = e.business_unit_id
      LEFT JOIN locations l ON l.id = e.location_id
      ORDER BY e.name
    `).all();
  }

  res.json(data);
});

export default router;
