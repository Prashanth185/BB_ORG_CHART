import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const employeeSelect = `
  SELECT e.id, e.employee_id, e.name, e.designation, e.email, e.phone, e.photo_url,
    d.name as department, bu.name as business_unit, l.name as location
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN business_units bu ON bu.id = e.business_unit_id
  LEFT JOIN locations l ON l.id = e.location_id
`;

function buildTree(employees, relationships, rootId = null) {
  const empMap = new Map(employees.map(e => [e.id, { ...e, children: [] }]));
  const hasManager = new Set();

  for (const rel of relationships) {
    if (rel.relationship_type === 'reports_to') {
      const child = empMap.get(rel.employee_id);
      const parent = empMap.get(rel.manager_id);
      if (child && parent) {
        parent.children.push({ ...child, relationship_type: rel.relationship_type });
        hasManager.add(rel.employee_id);
      }
    }
  }

  if (rootId) {
    return empMap.get(Number(rootId)) || null;
  }

  const roots = employees.filter(e => !hasManager.has(e.id)).map(e => empMap.get(e.id));
  return roots.length === 1 ? roots[0] : roots;
}

function buildChain(employees, relationships, startId) {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const reportsTo = new Map();
  const managedBy = new Map();

  for (const rel of relationships) {
    if (rel.relationship_type === 'reports_to') {
      reportsTo.set(rel.employee_id, rel.manager_id);
      if (!managedBy.has(rel.manager_id)) managedBy.set(rel.manager_id, []);
      managedBy.get(rel.manager_id).push(rel.employee_id);
    }
  }

  if (startId) {
    const chain = [];
    let current = empMap.get(Number(startId));
    while (current) {
      chain.push(current);
      const reports = managedBy.get(current.id) || [];
      current = reports.length === 1 ? empMap.get(reports[0]) : null;
    }
    return chain;
  }

  const chains = [];
  const visited = new Set();

  for (const emp of employees) {
    if (visited.has(emp.id)) continue;
    if (reportsTo.has(emp.id)) continue;

    const chain = [];
    let current = emp;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      const reports = managedBy.get(current.id) || [];
      current = reports.length === 1 ? empMap.get(reports[0]) : null;
    }
    if (chain.length > 1) chains.push(chain);
  }

  return chains;
}

router.get('/hierarchy', authenticateToken, (req, res) => {
  const { root_id } = req.query;
  const employees = db.prepare(employeeSelect).all();
  const relationships = db.prepare('SELECT * FROM relationships').all();
  const tree = buildTree(employees, relationships, root_id);
  res.json(tree);
});

router.get('/chain', authenticateToken, (req, res) => {
  const { start_id } = req.query;
  const employees = db.prepare(employeeSelect).all();
  const relationships = db.prepare('SELECT * FROM relationships').all();
  const chains = buildChain(employees, relationships, start_id);
  res.json(chains);
});

router.get('/matrix', authenticateToken, (req, res) => {
  const { employee_id } = req.query;
  const employees = db.prepare(employeeSelect).all();
  const relationships = db.prepare(`
    SELECT r.*, e.name as employee_name, m.name as manager_name
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    JOIN employees m ON m.id = r.manager_id
  `).all();

  if (employee_id) {
    const empRels = relationships.filter(r => r.employee_id === Number(employee_id));
    const emp = employees.find(e => e.id === Number(employee_id));
    const managers = empRels.map(r => ({
      ...employees.find(e => e.id === r.manager_id),
      relationship_type: r.relationship_type,
    }));
    const reports = relationships
      .filter(r => r.manager_id === Number(employee_id))
      .map(r => ({
        ...employees.find(e => e.id === r.employee_id),
        relationship_type: r.relationship_type,
      }));

    return res.json({ employee: emp, managers, directReports: reports, allRelationships: empRels });
  }

  const multiReport = employees.filter(emp => {
    const mgrCount = relationships.filter(r => r.employee_id === emp.id).length;
    return mgrCount > 1;
  }).map(emp => {
    const mgrs = relationships
      .filter(r => r.employee_id === emp.id)
      .map(r => ({
        ...employees.find(e => e.id === r.manager_id),
        relationship_type: r.relationship_type,
      }));
    return { employee: emp, managers: mgrs };
  });

  res.json(multiReport);
});

router.get('/network', authenticateToken, (req, res) => {
  const { center_id } = req.query;
  const employees = db.prepare(employeeSelect).all();
  const relationships = db.prepare('SELECT * FROM relationships').all();

  let centerEmp;
  if (center_id) {
    centerEmp = employees.find(e => e.id === Number(center_id));
  } else {
    const reportCounts = {};
    for (const rel of relationships) {
      reportCounts[rel.manager_id] = (reportCounts[rel.manager_id] || 0) + 1;
    }
    const topManager = Object.entries(reportCounts).sort((a, b) => b[1] - a[1])[0];
    centerEmp = topManager ? employees.find(e => e.id === Number(topManager[0])) : employees[0];
  }

  if (!centerEmp) return res.json({ center: null, nodes: [], edges: [] });

  const connectedIds = new Set([centerEmp.id]);
  const edges = [];

  for (const rel of relationships) {
    if (rel.employee_id === centerEmp.id || rel.manager_id === centerEmp.id) {
      connectedIds.add(rel.employee_id);
      connectedIds.add(rel.manager_id);
      edges.push({
        id: rel.id,
        source: rel.manager_id,
        target: rel.employee_id,
        type: rel.relationship_type,
      });
    }
  }

  for (const rel of relationships) {
    if (connectedIds.has(rel.employee_id) && connectedIds.has(rel.manager_id)) {
      if (!edges.find(e => e.id === rel.id)) {
        edges.push({
          id: rel.id,
          source: rel.manager_id,
          target: rel.employee_id,
          type: rel.relationship_type,
        });
      }
    }
  }

  const nodes = employees
    .filter(e => connectedIds.has(e.id))
    .map(e => ({ ...e, isCenter: e.id === centerEmp.id }));

  res.json({ center: centerEmp, nodes, edges });
});

router.get('/drill-down/:id', authenticateToken, (req, res) => {
  const empId = Number(req.params.id);
  const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(empId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const directReports = db.prepare(`
    SELECT e.id, e.employee_id, e.name, e.designation, e.photo_url,
      d.name as department, r.relationship_type,
      (SELECT COUNT(*) FROM relationships r2 WHERE r2.manager_id = e.id) as report_count
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE r.manager_id = ?
    ORDER BY e.name
  `).all(empId);

  const managers = db.prepare(`
    SELECT e.id, e.name, e.designation, r.relationship_type
    FROM relationships r
    JOIN employees e ON e.id = r.manager_id
    WHERE r.employee_id = ?
  `).all(empId);

  res.json({ employee: emp, directReports, managers });
});

export default router;
