import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue, sqlInt } from '../utils/sql.js';

const router = Router();

const employeeSelect = `
  SELECT e.id, e.employee_id, e.name, e.designation, e.email, e.phone, e.photo_url,
    d.name as department
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
`;

function computeAutoPositions() {
  const employees = db.prepare(employeeSelect).all();
  const relationships = db.prepare(`
    SELECT * FROM relationships WHERE relationship_type = 'reports_to'
  `).all();

  const children = new Map();
  const hasManager = new Set();

  for (const rel of relationships) {
    if (!children.has(rel.manager_id)) children.set(rel.manager_id, []);
    children.get(rel.manager_id).push(rel.employee_id);
    hasManager.add(rel.employee_id);
  }

  const roots = employees.filter(e => !hasManager.has(e.id));
  const positions = {};
  const CARD_W = 240;
  const CARD_H = 92;
  const GAP_X = 40;
  const GAP_Y = 80;

  function layoutSubtree(empId, depth, offsetX) {
    const kids = children.get(empId) || [];
    if (kids.length === 0) {
      positions[empId] = { x: offsetX, y: 60 + depth * (CARD_H + GAP_Y) };
      return offsetX + CARD_W + GAP_X;
    }

    let cursor = offsetX;
    for (const kidId of kids) {
      cursor = layoutSubtree(kidId, depth + 1, cursor);
    }
    const childXs = kids.map(k => positions[k]?.x ?? 0).filter(Boolean);
    positions[empId] = {
      x: childXs.length ? (Math.min(...childXs) + Math.max(...childXs)) / 2 : offsetX,
      y: 60 + depth * (CARD_H + GAP_Y),
    };
    return cursor;
  }

  let startX = 60;
  if (roots.length === 0 && employees.length > 0) {
    employees.forEach((emp, i) => {
      positions[emp.id] = { x: 60 + i * (CARD_W + GAP_X), y: 60 };
    });
  } else {
    for (const root of roots) {
      startX = layoutSubtree(root.id, 0, startX);
      startX += GAP_X;
    }
  }

  const GRID = 20;
  const snapGrid = (n) => Math.round(n / GRID) * GRID;
  for (const id of Object.keys(positions)) {
    positions[id].x = snapGrid(positions[id].x);
    positions[id].y = snapGrid(positions[id].y);
  }

  return {
    employees,
    relationships: db.prepare(`
      SELECT r.id, r.employee_id, r.manager_id, r.relationship_type,
        e.name as employee_name, m.name as manager_name
      FROM relationships r
      JOIN employees e ON e.id = r.employee_id
      JOIN employees m ON m.id = r.manager_id
    `).all(),
    positions,
  };
}

function parseWaypoints(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeWaypoints(waypoints) {
  if (!Array.isArray(waypoints)) return [];
  return waypoints
    .map((point) => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: Math.max(0, point.x),
      y: Math.max(0, point.y),
    }));
}

function sanitizePoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function normalizeAnchor(anchor) {
  return ['top', 'right', 'bottom', 'left'].includes(anchor) ? anchor : null;
}

function normalizeDirection(direction) {
  return ['up', 'down', 'left', 'right'].includes(direction) ? direction : null;
}

router.get('/canvas', authenticateToken, (_req, res) => {
  const saved = db.prepare('SELECT employee_id, pos_x, pos_y FROM chart_positions').all();
  const savedMap = Object.fromEntries(saved.map(p => [p.employee_id, { x: p.pos_x, y: p.pos_y }]));

  const lineEdits = db.prepare('SELECT * FROM chart_line_edits').all();
  const lineEditMap = {};
  for (const l of lineEdits) {
    lineEditMap[l.relationship_id] = {
      ...l,
      waypoints: parseWaypoints(l.waypoints),
    };
  }

  const boxStyles = db.prepare('SELECT * FROM chart_box_styles').all();
  const boxStyleMap = Object.fromEntries(boxStyles.map(b => [b.employee_id, b]));

  const collapsed = db.prepare('SELECT employee_id FROM chart_collapsed WHERE collapsed = 1').all();
  const collapsedSet = collapsed.map(c => c.employee_id);

  const auto = computeAutoPositions();
  const positions = {};
  for (const emp of auto.employees) {
    positions[emp.id] = savedMap[emp.id] || auto.positions[emp.id] || { x: 60, y: 60 };
  }

  res.json({
    employees: auto.employees,
    relationships: auto.relationships,
    positions,
    lineEdits: lineEditMap,
    boxStyles: boxStyleMap,
    collapsed: collapsedSet,
    routingNetwork: {
      breakpoints: db.prepare(`
        SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind
        FROM chart_breakpoints
        ORDER BY id
      `).all(),
      segments: db.prepare(`
        SELECT id, from_breakpoint_id, from_employee_id, from_anchor, from_x, from_y,
          to_breakpoint_id, parent_breakpoint_id, direction, color, width
        FROM chart_line_segments
        ORDER BY id
      `).all(),
    },
  });
});

router.post('/routing-segments', authenticateToken, (req, res) => {
  const { start, end, direction, color, width } = req.body;
  const endPoint = sanitizePoint(end);
  if (!endPoint) return res.status(400).json({ error: 'Valid end point required' });

  let fromBreakpointId = null;
  let fromEmployeeId = null;
  let fromAnchor = null;
  let fromPoint = null;
  let parentBreakpointId = null;

  if (start?.type === 'breakpoint') {
    const bp = db.prepare('SELECT id FROM chart_breakpoints WHERE id = ?').get(Number(start.id));
    if (!bp) return res.status(404).json({ error: 'Start breakpoint not found' });
    fromBreakpointId = bp.id;
    parentBreakpointId = bp.id;
  } else if (start?.type === 'employee') {
    const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(Number(start.id));
    if (!emp) return res.status(404).json({ error: 'Start employee not found' });
    fromEmployeeId = emp.id;
    fromAnchor = normalizeAnchor(start.anchor) || 'right';
  } else {
    fromPoint = sanitizePoint(start);
    if (!fromPoint) return res.status(400).json({ error: 'Valid start point required' });
  }

  const tx = db.transaction(() => {
    const bpResult = db.prepare(`
      INSERT INTO chart_breakpoints (pos_x, pos_y, parent_breakpoint_id, kind)
      VALUES (?, ?, ?, 'breakpoint')
    `).run(endPoint.x, endPoint.y, parentBreakpointId);

    const breakpointId = bpResult.lastInsertRowid;
    db.prepare(`
      INSERT INTO chart_line_segments (
        from_breakpoint_id, from_employee_id, from_anchor, from_x, from_y,
        to_breakpoint_id, parent_breakpoint_id, direction, color, width
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fromBreakpointId,
      fromEmployeeId,
      fromAnchor,
      fromPoint?.x ?? null,
      fromPoint?.y ?? null,
      breakpointId,
      parentBreakpointId,
      normalizeDirection(direction),
      sqlValue(color),
      width != null ? Number(width) : null,
    );

    return breakpointId;
  });

  const breakpointId = tx();
  res.status(201).json({
    message: 'Routing segment created',
    breakpoint: db.prepare('SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind FROM chart_breakpoints WHERE id = ?').get(breakpointId),
  });
});

router.post('/routing-segments/:segmentId/split', authenticateToken, (req, res) => {
  const segmentId = Number(req.params.segmentId);
  const splitPoint = sanitizePoint(req.body?.point);
  if (!splitPoint) return res.status(400).json({ error: 'Valid split point required' });

  const segment = db.prepare('SELECT * FROM chart_line_segments WHERE id = ?').get(segmentId);
  if (!segment) return res.status(404).json({ error: 'Segment not found' });

  const tx = db.transaction(() => {
    const bpResult = db.prepare(`
      INSERT INTO chart_breakpoints (pos_x, pos_y, parent_breakpoint_id, kind)
      VALUES (?, ?, ?, 'junction')
    `).run(splitPoint.x, splitPoint.y, segment.parent_breakpoint_id);
    const junctionId = bpResult.lastInsertRowid;

    db.prepare(`
      UPDATE chart_line_segments
      SET to_breakpoint_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(junctionId, segmentId);

    db.prepare(`
      INSERT INTO chart_line_segments (
        from_breakpoint_id, to_breakpoint_id, parent_breakpoint_id, direction, color, width
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(junctionId, segment.to_breakpoint_id, junctionId, segment.direction, segment.color, segment.width);

    return junctionId;
  });

  const junctionId = tx();
  res.status(201).json({
    message: 'Segment split',
    breakpoint: db.prepare('SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind FROM chart_breakpoints WHERE id = ?').get(junctionId),
  });
});

router.put('/routing-breakpoints/:breakpointId', authenticateToken, (req, res) => {
  const breakpointId = Number(req.params.breakpointId);
  const point = sanitizePoint(req.body);
  if (!point) return res.status(400).json({ error: 'Valid breakpoint position required' });

  const result = db.prepare(`
    UPDATE chart_breakpoints
    SET pos_x = ?, pos_y = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(point.x, point.y, breakpointId);
  if (result.changes === 0) return res.status(404).json({ error: 'Breakpoint not found' });

  res.json({
    message: 'Breakpoint moved',
    breakpoint: db.prepare('SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind FROM chart_breakpoints WHERE id = ?').get(breakpointId),
  });
});

router.delete('/routing-breakpoints/:breakpointId', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM chart_breakpoints WHERE id = ?').run(Number(req.params.breakpointId));
  if (result.changes === 0) return res.status(404).json({ error: 'Breakpoint not found' });
  res.json({ message: 'Breakpoint and attached segments deleted' });
});

router.delete('/routing-segments/:segmentId', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM chart_line_segments WHERE id = ?').run(Number(req.params.segmentId));
  if (result.changes === 0) return res.status(404).json({ error: 'Segment not found' });
  res.json({ message: 'Routing segment deleted' });
});

router.put('/routing-segments/:segmentId/style', authenticateToken, (req, res) => {
  const segmentId = Number(req.params.segmentId);
  const { color, width } = req.body;
  const segment = db.prepare('SELECT id FROM chart_line_segments WHERE id = ?').get(segmentId);
  if (!segment) return res.status(404).json({ error: 'Segment not found' });

  db.prepare(`
    UPDATE chart_line_segments
    SET color = COALESCE(?, color),
        width = COALESCE(?, width),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sqlValue(color), width != null ? Number(width) : null, segmentId);

  res.json({ message: 'Segment style saved', segment_id: segmentId });
});

router.put('/routing-network', authenticateToken, (req, res) => {
  const breakpoints = Array.isArray(req.body?.breakpoints) ? req.body.breakpoints : [];
  const segments = Array.isArray(req.body?.segments) ? req.body.segments : [];

  const tx = db.transaction(() => {
    db.exec('DELETE FROM chart_line_segments');
    db.exec('DELETE FROM chart_breakpoints');

    const insertBp = db.prepare(`
      INSERT INTO chart_breakpoints (id, pos_x, pos_y, parent_breakpoint_id, kind)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const bp of breakpoints) {
      const id = Number(bp.id);
      if (!Number.isFinite(id)) continue;
      insertBp.run(
        id,
        Number(bp.x) || 0,
        Number(bp.y) || 0,
        bp.parent_breakpoint_id != null ? Number(bp.parent_breakpoint_id) : null,
        bp.kind || 'breakpoint',
      );
    }

    const insertSeg = db.prepare(`
      INSERT INTO chart_line_segments (
        id, from_breakpoint_id, from_employee_id, from_anchor, from_x, from_y,
        to_breakpoint_id, parent_breakpoint_id, direction, color, width
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const seg of segments) {
      const id = Number(seg.id);
      if (!Number.isFinite(id)) continue;
      insertSeg.run(
        id,
        seg.from_breakpoint_id != null ? Number(seg.from_breakpoint_id) : null,
        seg.from_employee_id != null ? Number(seg.from_employee_id) : null,
        normalizeAnchor(seg.from_anchor),
        seg.from_x != null ? Number(seg.from_x) : null,
        seg.from_y != null ? Number(seg.from_y) : null,
        Number(seg.to_breakpoint_id),
        seg.parent_breakpoint_id != null ? Number(seg.parent_breakpoint_id) : null,
        normalizeDirection(seg.direction),
        sqlValue(seg.color),
        seg.width != null ? Number(seg.width) : null,
      );
    }
  });

  tx();

  res.json({
    message: 'Routing network saved',
    routingNetwork: {
      breakpoints: db.prepare(`
        SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind
        FROM chart_breakpoints ORDER BY id
      `).all(),
      segments: db.prepare(`
        SELECT id, from_breakpoint_id, from_employee_id, from_anchor, from_x, from_y,
          to_breakpoint_id, parent_breakpoint_id, direction, color, width
        FROM chart_line_segments ORDER BY id
      `).all(),
    },
  });
});

router.put('/positions', authenticateToken, (req, res) => {
  const { positions } = req.body;
  if (!positions || typeof positions !== 'object') {
    return res.status(400).json({ error: 'positions object required' });
  }

  const upsert = db.prepare(`
    INSERT INTO chart_positions (employee_id, pos_x, pos_y, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(employee_id) DO UPDATE SET
      pos_x = excluded.pos_x,
      pos_y = excluded.pos_y,
      updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction((pos) => {
    for (const [empId, { x, y }] of Object.entries(pos)) {
      upsert.run(Number(empId), Number(x), Number(y));
    }
  });

  tx(positions);
  res.json({ message: 'Positions saved permanently', count: Object.keys(positions).length });
});

router.post('/auto-arrange', authenticateToken, (_req, res) => {
  const auto = computeAutoPositions();
  const upsert = db.prepare(`
    INSERT INTO chart_positions (employee_id, pos_x, pos_y, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(employee_id) DO UPDATE SET
      pos_x = excluded.pos_x,
      pos_y = excluded.pos_y,
      updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    for (const [empId, pos] of Object.entries(auto.positions)) {
      upsert.run(Number(empId), pos.x, pos.y);
    }
  });
  tx();

  res.json({
    message: 'Auto layout applied and saved',
    positions: auto.positions,
    employees: auto.employees,
    relationships: auto.relationships,
  });
});

router.put('/line-styles/:relationshipId', authenticateToken, (req, res) => {
  const { color, width, line_type, waypoints } = req.body;
  const relId = Number(req.params.relationshipId);

  const rel = db.prepare('SELECT id FROM relationships WHERE id = ?').get(relId);
  if (!rel) return res.status(404).json({ error: 'Relationship not found' });

  const waypointsJson = Array.isArray(waypoints)
    ? JSON.stringify(sanitizeWaypoints(waypoints))
    : null;

  db.prepare(`
    INSERT INTO chart_line_edits (relationship_id, color, width, line_type, waypoints, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(relationship_id) DO UPDATE SET
      color = COALESCE(excluded.color, chart_line_edits.color),
      width = COALESCE(excluded.width, chart_line_edits.width),
      line_type = COALESCE(excluded.line_type, chart_line_edits.line_type),
      waypoints = COALESCE(excluded.waypoints, chart_line_edits.waypoints),
      updated_at = CURRENT_TIMESTAMP
  `).run(
    relId,
    sqlValue(color),
    sqlInt(width),
    sqlValue(line_type),
    waypointsJson,
  );

  res.json({ message: 'Line saved', relationship_id: relId });
});

router.put('/line-waypoints/:relationshipId', authenticateToken, (req, res) => {
  const relId = Number(req.params.relationshipId);
  const { waypoints } = req.body;

  const rel = db.prepare('SELECT id FROM relationships WHERE id = ?').get(relId);
  if (!rel) return res.status(404).json({ error: 'Relationship not found' });

  const existing = db.prepare('SELECT * FROM chart_line_edits WHERE relationship_id = ?').get(relId);
  const waypointsJson = JSON.stringify(sanitizeWaypoints(waypoints));

  if (existing) {
    db.prepare(`
      UPDATE chart_line_edits SET waypoints = ?, updated_at = CURRENT_TIMESTAMP WHERE relationship_id = ?
    `).run(waypointsJson, relId);
  } else {
    db.prepare(`
      INSERT INTO chart_line_edits (relationship_id, waypoints) VALUES (?, ?)
    `).run(relId, waypointsJson);
  }

  res.json({ message: 'Line route saved', relationship_id: relId });
});

router.delete('/line-styles/:relationshipId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM chart_line_edits WHERE relationship_id = ?').run(req.params.relationshipId);
  res.json({ message: 'Line style reset to default' });
});

router.put('/box-styles/:employeeId', authenticateToken, (req, res) => {
  const empId = Number(req.params.employeeId);
  const {
    name_color, title_color, dept_color, name_font_size, title_font_size,
    name_font_weight, bg_color_top, bg_color_bottom,
  } = req.body;

  const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(empId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  db.prepare(`
    INSERT INTO chart_box_styles (
      employee_id, name_color, title_color, dept_color, name_font_size, title_font_size,
      name_font_weight, bg_color_top, bg_color_bottom, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(employee_id) DO UPDATE SET
      name_color = excluded.name_color,
      title_color = excluded.title_color,
      dept_color = excluded.dept_color,
      name_font_size = excluded.name_font_size,
      title_font_size = excluded.title_font_size,
      name_font_weight = excluded.name_font_weight,
      bg_color_top = excluded.bg_color_top,
      bg_color_bottom = excluded.bg_color_bottom,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    empId,
    sqlValue(name_color) || '#facc15',
    sqlValue(title_color) || '#ffffff',
    sqlValue(dept_color) || '#f87171',
    sqlInt(name_font_size) ?? 14,
    sqlInt(title_font_size) ?? 12,
    sqlValue(name_font_weight) || 'bold',
    sqlValue(bg_color_top) || '#5a6578',
    sqlValue(bg_color_bottom) || '#2a3140',
  );

  res.json({ message: 'Box style saved', employee_id: empId });
});

router.delete('/box-styles/:employeeId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM chart_box_styles WHERE employee_id = ?').run(req.params.employeeId);
  res.json({ message: 'Box style reset' });
});

router.put('/collapsed/:employeeId', authenticateToken, (req, res) => {
  const empId = Number(req.params.employeeId);
  const { collapsed } = req.body;

  db.prepare(`
    INSERT INTO chart_collapsed (employee_id, collapsed) VALUES (?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET collapsed = excluded.collapsed
  `).run(empId, collapsed ? 1 : 0);

  res.json({ message: 'Collapse state saved', employee_id: empId, collapsed: !!collapsed });
});

router.get('/settings', authenticateToken, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM chart_settings').all();
  const settings = {
    title: 'GCC – May 2026',
    theme: 'professional',
    orthogonalLines: true,
    routingType: 'orthogonal',
  };
  for (const row of rows) {
    if (row.key === 'orthogonalLines') settings.orthogonalLines = row.value === 'true';
    else settings[row.key] = row.value;
  }
  res.json(settings);
});

router.put('/settings', authenticateToken, (req, res) => {
  const { title, theme, orthogonalLines, routingType } = req.body;
  const upsert = db.prepare(`
    INSERT INTO chart_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  if (title !== undefined) upsert.run('title', String(title));
  if (theme !== undefined) upsert.run('theme', String(theme));
  if (orthogonalLines !== undefined) upsert.run('orthogonalLines', orthogonalLines ? 'true' : 'false');
  if (routingType !== undefined) upsert.run('routingType', String(routingType));
  res.json({ message: 'Chart settings saved' });
});

export default router;
