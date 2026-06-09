import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue, sqlInt } from '../utils/sql.js';

const router = Router();

function enrichEmployee(emp) {
  if (!emp) return null;
  const managers = db.prepare(`
    SELECT e.id, e.name, e.designation, r.relationship_type
    FROM relationships r
    JOIN employees e ON e.id = r.manager_id
    WHERE r.employee_id = ?
  `).all(emp.id);

  const directReports = db.prepare(`
    SELECT e.id, e.name, e.designation, e.employee_id, r.relationship_type
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    WHERE r.manager_id = ? AND r.relationship_type = 'reports_to'
  `).all(emp.id);

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, ep.role
    FROM employee_projects ep
    JOIN projects p ON p.id = ep.project_id
    WHERE ep.employee_id = ?
  `).all(emp.id);

  const documents = db.prepare(`
    SELECT id, title, file_url, doc_type, uploaded_at
    FROM documents WHERE employee_id = ?
  `).all(emp.id);

  return { ...emp, managers, directReports, projects, documents };
}

const employeeSelect = `
  SELECT e.*,
    d.name as department,
    bu.name as business_unit,
    l.name as location,
    l.city,
    l.country
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN business_units bu ON bu.id = e.business_unit_id
  LEFT JOIN locations l ON l.id = e.location_id
`;

function resolveDepartmentId(department) {
  if (!department?.trim()) return null;
  const name = department.trim();
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid;
}

function resolveBusinessUnitId(business_unit) {
  if (!business_unit?.trim()) return null;
  const name = business_unit.trim();
  const existing = db.prepare('SELECT id FROM business_units WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO business_units (name) VALUES (?)').run(name).lastInsertRowid;
}

function resolveLocationId(location) {
  if (!location?.trim()) return null;
  const name = location.trim();
  const existing = db.prepare('SELECT id FROM locations WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO locations (name) VALUES (?)').run(name).lastInsertRowid;
}

router.get('/', authenticateToken, (req, res) => {
  const { search, department, location, designation } = req.query;
  let query = employeeSelect + ' WHERE 1=1';
  const params = [];

  if (search) {
    query += ` AND (e.name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ? OR e.designation LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (department) {
    query += ' AND d.name = ?';
    params.push(department);
  }
  if (location) {
    query += ' AND l.name = ?';
    params.push(location);
  }
  if (designation) {
    query += ' AND e.designation LIKE ?';
    params.push(`%${designation}%`);
  }

  query += ' ORDER BY e.name';
  const employees = db.prepare(query).all(...params);
  res.json(employees);
});

router.get('/filters', authenticateToken, (_req, res) => {
  const departments = db.prepare('SELECT DISTINCT name FROM departments ORDER BY name').all().map(r => r.name);
  const locations = db.prepare('SELECT DISTINCT name FROM locations ORDER BY name').all().map(r => r.name);
  const designations = db.prepare('SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL ORDER BY designation').all().map(r => r.designation);
  const businessUnits = db.prepare('SELECT DISTINCT name FROM business_units ORDER BY name').all().map(r => r.name);
  res.json({ departments, locations, designations, businessUnits });
});

router.get('/:id', authenticateToken, (req, res) => {
  const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  res.json(enrichEmployee(emp));
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      employee_id, name, designation, department, business_unit, location,
      email, phone, photo_url, bio, reporting_to,
    } = req.body;

    if (!employee_id?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'Employee ID and name are required' });
    }

    const departmentId = resolveDepartmentId(department);
    const buId = resolveBusinessUnitId(business_unit);
    const locId = resolveLocationId(location);

    const result = db.prepare(`
      INSERT INTO employees (employee_id, name, designation, department_id, business_unit_id, location_id, email, phone, photo_url, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee_id.trim(),
      name.trim(),
      sqlValue(designation),
      sqlInt(departmentId),
      sqlInt(buId),
      sqlInt(locId),
      sqlValue(email),
      sqlValue(phone),
      sqlValue(photo_url),
      sqlValue(bio),
    );

    const newId = result.lastInsertRowid;

    if (reporting_to) {
      const managerIds = Array.isArray(reporting_to) ? reporting_to : [reporting_to];
      const insertRel = db.prepare(`
        INSERT OR IGNORE INTO relationships (employee_id, manager_id, relationship_type)
        VALUES (?, ?, 'reports_to')
      `);
      for (const mgrId of managerIds) {
        insertRel.run(newId, Number(mgrId));
      }
    }

    const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(newId);
    res.status(201).json(enrichEmployee(emp));
  } catch (err) {
    console.error('Create employee error:', err);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to save employee' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    const {
      employee_id, name, designation, department, business_unit, location,
      email, phone, photo_url, bio,
    } = req.body;

    const departmentId = resolveDepartmentId(department);
    const buId = resolveBusinessUnitId(business_unit);
    const locId = resolveLocationId(location);

    db.prepare(`
      UPDATE employees SET
        employee_id = ?,
        name = ?,
        designation = ?,
        department_id = ?,
        business_unit_id = ?,
        location_id = ?,
        email = ?,
        phone = ?,
        photo_url = ?,
        bio = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      employee_id?.trim() || existing.employee_id,
      name?.trim() || existing.name,
      sqlValue(designation),
      sqlInt(departmentId),
      sqlInt(buId),
      sqlInt(locId),
      sqlValue(email),
      sqlValue(phone),
      sqlValue(photo_url),
      sqlValue(bio),
      req.params.id,
    );

    const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(req.params.id);
    res.json(enrichEmployee(emp));
  } catch (err) {
    console.error('Update employee error:', err);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to update employee' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ message: 'Employee deleted successfully' });
});

export default router;
