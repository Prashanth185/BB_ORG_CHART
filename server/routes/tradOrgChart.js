import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue } from '../utils/sql.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
// multer: memory storage so we don't write temp files to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── GET /api/trad-org-chart/employees ──────────────────────────────────────
// Returns all employees in the traditional org chart (isolated table)
router.get('/employees', authenticateToken, (_req, res) => {
  const rows = db.prepare(`
    SELECT
      te.id,
      te.employee_id,
      te.name,
      te.designation,
      te.department,
      te.manager_id,
      mgr.name AS manager_name
    FROM trad_employees te
    LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
    ORDER BY te.created_at ASC
  `).all();
  res.json(rows);
});

// ── POST /api/trad-org-chart/employees ─────────────────────────────────────
// Creates a new employee in the traditional org chart
router.post('/employees', authenticateToken, (req, res) => {
  try {
    const { employee_id, name, designation, department, manager_id } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const empId = employee_id?.trim() || `TRAD-${Date.now()}`;

    const result = db.prepare(`
      INSERT INTO trad_employees (employee_id, name, designation, department, manager_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      empId,
      name.trim(),
      sqlValue(designation),
      sqlValue(department),
      manager_id ? Number(manager_id) : null,
    );

    const newEmp = db.prepare(`
      SELECT
        te.id,
        te.employee_id,
        te.name,
        te.designation,
        te.department,
        te.manager_id,
        mgr.name AS manager_name
      FROM trad_employees te
      LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
      WHERE te.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newEmp);
  } catch (err) {
    console.error('Create trad employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employee' });
  }
});

// ── DELETE /api/trad-org-chart/employees/:id ───────────────────────────────
// Deletes an employee (and re-parents their children to their manager)
router.delete('/employees/:id', authenticateToken, (req, res) => {
  try {
    const emp = db.prepare('SELECT * FROM trad_employees WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Re-parent children to the deleted employee's manager
    db.prepare(`
      UPDATE trad_employees SET manager_id = ? WHERE manager_id = ?
    `).run(emp.manager_id ?? null, emp.id);

    db.prepare('DELETE FROM trad_employees WHERE id = ?').run(emp.id);
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    console.error('Delete trad employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete employee' });
  }
});

// ── GET /api/trad-org-chart/hierarchy ──────────────────────────────────────
// Returns the full tree as a nested structure for rendering (includes node colors)
router.get('/hierarchy', authenticateToken, (_req, res) => {
  const all = db.prepare(`
    SELECT
      te.id,
      te.employee_id,
      te.name,
      te.designation,
      te.department,
      te.manager_id,
      mgr.name AS manager_name,
      tnc.color AS node_color
    FROM trad_employees te
    LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
    LEFT JOIN trad_node_colors tnc ON tnc.employee_id = te.id
    ORDER BY te.created_at ASC
  `).all();

  // Build a nested tree
  const map = {};
  const roots = [];

  for (const emp of all) {
    map[emp.id] = { ...emp, children: [] };
  }

  for (const emp of all) {
    if (emp.manager_id && map[emp.manager_id]) {
      map[emp.manager_id].children.push(map[emp.id]);
    } else {
      roots.push(map[emp.id]);
    }
  }

  res.json({ roots, total: all.length });
});

// ── GET /api/trad-org-chart/state ──────────────────────────────────────────
// Returns the saved chart UI state (expanded nodes, etc.)
router.get('/state', authenticateToken, (_req, res) => {
  const row = db.prepare(`SELECT value FROM trad_chart_state WHERE key = 'ui_state'`).get();
  if (!row) return res.json({ expandedIds: null });
  try {
    res.json(JSON.parse(row.value));
  } catch {
    res.json({ expandedIds: null });
  }
});

// ── PUT /api/trad-org-chart/state ──────────────────────────────────────────
// Saves the chart UI state (expanded nodes, etc.)
router.put('/state', authenticateToken, (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    db.prepare(`
      INSERT INTO trad_chart_state (key, value, updated_at)
      VALUES ('ui_state', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(value);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save trad state error:', err);
    res.status(500).json({ error: err.message || 'Failed to save state' });
  }
});

// ── POST /api/trad-org-chart/share ─────────────────────────────────────────
// Creates a shareable web chart snapshot. Requires auth (editor only).
// Returns { id, url } — the url is the public viewer link.
router.post('/share', authenticateToken, (req, res) => {
  try {
    const { chartData } = req.body;
    if (!chartData) {
      return res.status(400).json({ error: 'chartData is required' });
    }

    // Generate a unique ID (timestamp + random hex)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const value = typeof chartData === 'string' ? chartData : JSON.stringify(chartData);

    db.prepare(`
      INSERT INTO trad_shared_charts (id, chart_data, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(id, value);

    res.status(201).json({ id, ok: true });
  } catch (err) {
    console.error('Share chart error:', err);
    res.status(500).json({ error: err.message || 'Failed to create shared chart' });
  }
});

// ── GET /api/trad-org-chart/share/:id ──────────────────────────────────────
// Public endpoint — NO authentication required.
// Returns the stored chart snapshot for the viewer.
// Checks both trad_shared_charts (legacy singleton) and proj_trad_shared_charts (project-scoped).
router.get('/share/:id', (req, res) => {
  try {
    // Check legacy table first
    let row = db.prepare(`SELECT chart_data FROM trad_shared_charts WHERE id = ?`).get(req.params.id);
    // Fall back to project-scoped shared charts
    if (!row) {
      row = db.prepare(`SELECT chart_data FROM proj_trad_shared_charts WHERE id = ?`).get(req.params.id);
    }
    if (!row) {
      return res.status(404).json({ error: 'Shared chart not found' });
    }
    let data;
    try {
      data = JSON.parse(row.chart_data);
    } catch {
      return res.status(500).json({ error: 'Invalid chart data' });
    }
    res.json(data);
  } catch (err) {
    console.error('Get shared chart error:', err);
    res.status(500).json({ error: err.message || 'Failed to load shared chart' });
  }
});

// ── POST /api/trad-org-chart/import/validate ────────────────────────────────
// Parses uploaded Excel file, validates it, and returns a summary report.
// Does NOT write anything to the database.
router.post('/import/validate', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = (req.file.originalname || '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      return res.status(400).json({ error: 'Only .xlsx and .xls files are supported' });
    }

    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'The Excel file contains no data rows' });
    }

    // Normalise column names — strip whitespace, lower-case
    function normalise(rows) {
      return rows.map((row) => {
        const r = {};
        for (const [k, v] of Object.entries(row)) {
          r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
        }
        return r;
      });
    }
    const data = normalise(rows);

    // Column aliases accepted
    function col(row, ...aliases) {
      for (const a of aliases) if (row[a] !== undefined) return row[a];
      return '';
    }

    const errors   = [];
    const warnings = [];
    const seen     = new Set(); // employee_ids already encountered

    const parsed = data.map((row, idx) => {
      const rowNum    = idx + 2; // 1-based, row 1 is header
      const empId     = col(row, 'employee_id', 'emp_id', 'id', 'employeeid');
      const name      = col(row, 'employee_name', 'name', 'full_name', 'employeename');
      const desig     = col(row, 'designation', 'title', 'job_title');
      const dept      = col(row, 'department', 'dept');
      const reportsTo = col(row, 'reports_to_employee_id', 'reports_to', 'manager_id', 'reportsto', 'manager');

      if (!empId)  errors.push({ row: rowNum, field: 'Employee ID', message: 'Missing Employee ID' });
      if (!name)   errors.push({ row: rowNum, field: 'Employee Name', message: `Row ${rowNum}: Missing Employee Name` });
      if (empId && seen.has(empId)) errors.push({ row: rowNum, field: 'Employee ID', message: `Duplicate Employee ID: ${empId}` });
      if (empId)   seen.add(empId);

      return { rowNum, empId, name, desig, dept, reportsTo };
    });

    // Validate manager references
    const empIdSet = new Set(parsed.map((p) => p.empId).filter(Boolean));
    for (const p of parsed) {
      if (p.reportsTo && p.reportsTo !== '' && !empIdSet.has(p.reportsTo)) {
        errors.push({ row: p.rowNum, field: 'Reports To', message: `Row ${p.rowNum} (${p.empId}): Manager ID "${p.reportsTo}" not found` });
      }
    }

    // Detect circular references (DFS cycle detection)
    const childOf = {};
    for (const p of parsed) { if (p.reportsTo) { if (!childOf[p.reportsTo]) childOf[p.reportsTo] = []; childOf[p.reportsTo].push(p.empId); } }
    function hasCycle(id, visited = new Set()) {
      if (visited.has(id)) return true;
      visited.add(id);
      for (const child of (childOf[id] || [])) { if (hasCycle(child, new Set(visited))) return true; }
      return false;
    }
    for (const p of parsed) {
      if (p.reportsTo && hasCycle(p.empId)) {
        errors.push({ row: p.rowNum, field: 'Reports To', message: `Circular reference detected for Employee ID: ${p.empId}` });
      }
    }

    const rootCount  = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
    const relCount   = parsed.filter((p) => p.reportsTo && p.reportsTo !== '').length;

    res.json({
      valid:      errors.length === 0,
      total:      parsed.length,
      rootCount,
      relCount,
      errorCount: errors.length,
      warnCount:  warnings.length,
      errors,
      warnings,
      preview:    parsed.slice(0, 5).map((p) => ({ empId: p.empId, name: p.name, desig: p.desig, dept: p.dept, reportsTo: p.reportsTo })),
    });
  } catch (err) {
    console.error('Validate import error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse Excel file' });
  }
});

// ── POST /api/trad-org-chart/import/execute ─────────────────────────────────
// Parses Excel, validates, then writes all employees into trad_employees.
// Supports APPEND (keeps existing) or REPLACE (clears existing first).
router.post('/import/execute', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mode = req.body.mode || 'replace'; // 'replace' | 'append'

    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    function normalise(rows) {
      return rows.map((row) => {
        const r = {};
        for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
        return r;
      });
    }
    const data = normalise(rows);
    function col(row, ...aliases) { for (const a of aliases) if (row[a] !== undefined) return row[a]; return ''; }

    const parsed = data.map((row) => ({
      empId:     col(row, 'employee_id', 'emp_id', 'id', 'employeeid'),
      name:      col(row, 'employee_name', 'name', 'full_name', 'employeename'),
      desig:     col(row, 'designation', 'title', 'job_title'),
      dept:      col(row, 'department', 'dept'),
      reportsTo: col(row, 'reports_to_employee_id', 'reports_to', 'manager_id', 'reportsto', 'manager'),
    })).filter((p) => p.empId && p.name);

    // Run inside a transaction
    db.exec('BEGIN');
    try {
      if (mode === 'replace') {
        db.exec('DELETE FROM trad_employees');
        // Also reset saved state so the chart reloads cleanly
        db.prepare(`DELETE FROM trad_chart_state WHERE key = 'ui_state'`).run();
      }

      // Phase 1: Insert all employees without manager_id (we'll update in phase 2)
      const insertStmt = db.prepare(`
        INSERT INTO trad_employees (employee_id, name, designation, department, manager_id)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT DO NOTHING
      `);
      for (const p of parsed) {
        insertStmt.run(p.empId, p.name, sqlValue(p.desig), sqlValue(p.dept));
      }

      // Phase 2: Set manager_ids — build empId → db-id map first
      const allInserted = db.prepare('SELECT id, employee_id FROM trad_employees').all();
      const empIdToDbId = {};
      for (const r of allInserted) empIdToDbId[r.employee_id] = r.id;

      const updateStmt = db.prepare('UPDATE trad_employees SET manager_id = ? WHERE id = ?');
      for (const p of parsed) {
        if (p.reportsTo && empIdToDbId[p.reportsTo] && empIdToDbId[p.empId]) {
          updateStmt.run(empIdToDbId[p.reportsTo], empIdToDbId[p.empId]);
        }
      }

      // Phase 3: Log import history
      const rootCount = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
      const relCount  = parsed.filter((p) =>  p.reportsTo && p.reportsTo !== '').length;
      db.prepare(`
        INSERT INTO trad_import_history (file_name, imported_by, total_employees, root_count, relationship_count, error_count, status)
        VALUES (?, ?, ?, ?, ?, 0, 'success')
      `).run(req.file.originalname, req.user?.username || 'unknown', parsed.length, rootCount, relCount);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.json({ ok: true, imported: parsed.length });
  } catch (err) {
    console.error('Execute import error:', err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// ── GET /api/trad-org-chart/import/history ──────────────────────────────────
router.get('/import/history', authenticateToken, (_req, res) => {
  const rows = db.prepare(`
    SELECT id, file_name, imported_by, total_employees, root_count,
           relationship_count, error_count, status, created_at
    FROM trad_import_history
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// ── POST /api/trad-org-chart/import/regenerate/:historyId ───────────────────
// Re-applies the saved import (employees already in DB) — just resets state
// so the chart refreshes cleanly.
router.post('/import/regenerate/:historyId', authenticateToken, (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM trad_import_history WHERE id = ?').get(req.params.historyId);
    if (!entry) return res.status(404).json({ error: 'Import record not found' });
    // Reset ui_state so chart reloads with default expand
    db.prepare(`DELETE FROM trad_chart_state WHERE key = 'ui_state'`).run();
    res.json({ ok: true, message: 'Chart state reset — reload Traditional Org Chart to view' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to regenerate' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FEATURE ROUTES — additive only, no existing routes changed
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/trad-org-chart/title ───────────────────────────────────────────
router.get('/title', authenticateToken, (_req, res) => {
  const row = db.prepare('SELECT title FROM trad_chart_title WHERE id = 1').get();
  res.json({ title: row ? row.title : 'Traditional Org Chart' });
});

// ── PUT /api/trad-org-chart/title ───────────────────────────────────────────
router.put('/title', authenticateToken, (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    db.prepare(`
      INSERT INTO trad_chart_title (id, title, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP
    `).run(title.trim());
    res.json({ ok: true, title: title.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save title' });
  }
});

// ── GET /api/trad-org-chart/line-style ──────────────────────────────────────
router.get('/line-style', authenticateToken, (_req, res) => {
  const row = db.prepare('SELECT color, thickness FROM trad_line_styles WHERE id = 1').get();
  res.json({ color: row ? row.color : '#94a3b8', thickness: row ? row.thickness : 2 });
});

// ── PUT /api/trad-org-chart/line-style ──────────────────────────────────────
router.put('/line-style', authenticateToken, (req, res) => {
  try {
    const { color, thickness } = req.body;
    const c = color?.trim() || '#94a3b8';
    const t = Math.max(1, Math.min(10, Number(thickness) || 2));
    db.prepare(`
      INSERT INTO trad_line_styles (id, color, thickness, updated_at)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET color = excluded.color, thickness = excluded.thickness, updated_at = CURRENT_TIMESTAMP
    `).run(c, t);
    res.json({ ok: true, color: c, thickness: t });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save line style' });
  }
});

// ── GET /api/trad-org-chart/node-colors ─────────────────────────────────────
router.get('/node-colors', authenticateToken, (_req, res) => {
  const rows = db.prepare('SELECT employee_id, color FROM trad_node_colors').all();
  const map = {};
  for (const r of rows) map[r.employee_id] = r.color;
  res.json(map);
});

// ── PUT /api/trad-org-chart/node-colors/:empId ──────────────────────────────
router.put('/node-colors/:empId', authenticateToken, (req, res) => {
  try {
    const empId = Number(req.params.empId);
    const { color } = req.body;
    if (!color?.trim()) return res.status(400).json({ error: 'Color is required' });
    const emp = db.prepare('SELECT id FROM trad_employees WHERE id = ?').get(empId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    db.prepare(`
      INSERT INTO trad_node_colors (employee_id, color, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id) DO UPDATE SET color = excluded.color, updated_at = CURRENT_TIMESTAMP
    `).run(empId, color.trim());
    res.json({ ok: true, employee_id: empId, color: color.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save node color' });
  }
});

// ── DELETE /api/trad-org-chart/node-colors/:empId ───────────────────────────
router.delete('/node-colors/:empId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM trad_node_colors WHERE employee_id = ?').run(Number(req.params.empId));
  res.json({ ok: true });
});

export default router;
