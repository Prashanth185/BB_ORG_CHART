import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticateToken, (_req, res) => {
  const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  const totalDepartments = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  const totalBusinessUnits = db.prepare('SELECT COUNT(*) as count FROM business_units').get().count;
  const totalLocations = db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
  const totalRelationships = db.prepare('SELECT COUNT(*) as count FROM relationships').get().count;

  const employeesByDepartment = db.prepare(`
    SELECT d.name as department, COUNT(e.id) as count
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id
    GROUP BY d.id
    ORDER BY count DESC
  `).all();

  const employeesByLocation = db.prepare(`
    SELECT l.name as location, COUNT(e.id) as count
    FROM locations l
    LEFT JOIN employees e ON e.location_id = l.id
    GROUP BY l.id
    ORDER BY count DESC
  `).all();

  const recentEmployees = db.prepare(`
    SELECT e.id, e.name, e.designation, e.employee_id, e.created_at,
      d.name as department
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY e.created_at DESC LIMIT 5
  `).all();

  res.json({
    totalEmployees,
    totalDepartments,
    totalBusinessUnits,
    totalLocations,
    totalRelationships,
    employeesByDepartment,
    employeesByLocation,
    recentEmployees,
  });
});

export default router;
