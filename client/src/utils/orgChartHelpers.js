/** Fixed chart box size — must match FreeformOrgChart wrapper and server auto-arrange */
export const CARD_W = 240;
export const CARD_H = 92;

export function buildChildrenMap(relationships) {
  const map = new Map();
  for (const r of relationships) {
    if (r.relationship_type === 'reports_to') {
      if (!map.has(r.manager_id)) map.set(r.manager_id, []);
      map.get(r.manager_id).push(r.employee_id);
    }
  }
  return map;
}

export function getHiddenEmployeeIds(collapsedIds, childrenMap) {
  const hidden = new Set();
  const visit = (empId) => {
    for (const child of childrenMap.get(empId) || []) {
      hidden.add(child);
      visit(child);
    }
  };
  for (const id of collapsedIds) visit(id);
  return hidden;
}

export function getBoxRect(empId, positions) {
  const p = positions[empId] || { x: 0, y: 0 };
  return {
    x: p.x,
    y: p.y,
    cx: p.x + CARD_W / 2,
    cy: p.y + CARD_H / 2,
    top: p.y,
    bottom: p.y + CARD_H,
    left: p.x,
    right: p.x + CARD_W,
  };
}

/**
 * Pick edge midpoints so lines attach flush to box sides (not through box centers).
 */
export function computeAnchors(from, to) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy >= absDx * 0.5) {
    if (dy >= 0) {
      return {
        x1: from.cx,
        y1: from.bottom,
        x2: to.cx,
        y2: to.top,
        orientation: 'vertical-down',
      };
    }
    return {
      x1: from.cx,
      y1: from.top,
      x2: to.cx,
      y2: to.bottom,
      orientation: 'vertical-up',
    };
  }

  if (dx >= 0) {
    return {
      x1: from.right,
      y1: from.cy,
      x2: to.left,
      y2: to.cy,
      orientation: 'horizontal-right',
    };
  }

  return {
    x1: from.left,
    y1: from.cy,
    x2: to.right,
    y2: to.cy,
    orientation: 'horizontal-left',
  };
}

function normalizeWaypoints(savedWaypoints) {
  if (!Array.isArray(savedWaypoints)) return [];
  return savedWaypoints
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/**
 * Orthogonal GCC-style path: exit box → turn → travel → turn → enter box.
 */
function buildCurvedPath(x1, y1, x2, y2, connector = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const curve = connector ? 0.65 : 0.5;
  return `M ${x1} ${y1} C ${x1 + dx * curve} ${y1}, ${x2 - dx * curve} ${y2}, ${x2} ${y2}`;
}

function buildPolygonPath(x1, y1, x2, y2) {
  const midX = x1 + (x2 - x1) * 0.5;
  const offset = Math.abs(y2 - y1) < 40 ? 28 : 0;
  return pathFromPoints([
    { x: x1, y: y1 },
    { x: midX, y: y1 + offset },
    { x: midX, y: y2 - offset },
    { x: x2, y: y2 },
  ]);
}

export function buildConnectorPath(anchors, savedBend = null, routingType = 'orthogonal') {
  const { x1, y1, x2, y2, orientation } = anchors;

  if (routingType === 'straight') {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      waypoints: [],
      handles: [],
    };
  }

  if (routingType === 'curved' || routingType === 'curvedConnector') {
    return {
      d: buildCurvedPath(x1, y1, x2, y2, routingType === 'curvedConnector'),
      waypoints: [],
      handles: [],
    };
  }

  if (routingType === 'polygon') {
    return {
      d: buildPolygonPath(x1, y1, x2, y2),
      waypoints: [],
      handles: [],
    };
  }

  const gap = 12;

  if (orientation.startsWith('vertical')) {
    const goingDown = orientation === 'vertical-down';
    const defaultMidY = goingDown
      ? y1 + Math.max(gap, (y2 - y1) * 0.5)
      : y1 - Math.max(gap, (y1 - y2) * 0.5);
    const midY = savedBend?.y ?? defaultMidY;
    const wp = [{ x: x1, y: midY }, { x: x2, y: midY }];
    const d = pathFromPoints([{ x: x1, y: y1 }, ...wp, { x: x2, y: y2 }]);
    return {
      d,
      waypoints: wp,
      handles: [{ x: (x1 + x2) / 2, y: midY, axis: 'y' }],
    };
  }

  const defaultMidX = x1 + (x2 - x1) * 0.5;
  const midX = savedBend?.x ?? defaultMidX;
  const wp = [{ x: midX, y: y1 }, { x: midX, y: y2 }];
  const d = pathFromPoints([{ x: x1, y: y1 }, ...wp, { x: x2, y: y2 }]);
  return {
    d,
    waypoints: wp,
    handles: [{ x: midX, y: (y1 + y2) / 2, axis: 'x' }],
  };
}

function pathFromPoints(points) {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function pushPoint(points, point) {
  if (!points.length || !samePoint(points[points.length - 1], point)) {
    points.push(point);
  }
}

export function buildOrthogonalRouteThroughPoints(points) {
  if (!points.length) return [];
  const routed = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const from = routed[routed.length - 1];
    const to = points[i];
    if (Math.abs(from.x - to.x) < 0.5 || Math.abs(from.y - to.y) < 0.5) {
      pushPoint(routed, to);
    } else {
      pushPoint(routed, { x: to.x, y: from.y });
      pushPoint(routed, to);
    }
  }

  return routed;
}

function manualConnectorPath(anchors, waypoints, routingType) {
  const routePoints = [
    { x: anchors.x1, y: anchors.y1 },
    ...waypoints,
    { x: anchors.x2, y: anchors.y2 },
  ];
  const points = routingType === 'straight'
    ? routePoints
    : buildOrthogonalRouteThroughPoints(routePoints);
  const routingHandles = waypoints.map((point, index) => ({
    ...point,
    index,
    kind: 'routing',
    cursor: 'move',
  }));
  const bendHandles = points
    .slice(1, -1)
    .filter((point) => !waypoints.some((wp) => samePoint(wp, point)))
    .map((point, index) => ({
      ...point,
      index,
      kind: 'bend',
      cursor: 'crosshair',
    }));

  return {
    d: pathFromPoints(points),
    points,
    waypoints,
    handles: [...routingHandles, ...bendHandles],
  };
}

export function getConnectorGeometry(managerId, employeeId, positions, lineEdit = null, routingType = 'orthogonal') {
  const from = getBoxRect(managerId, positions);
  const to = getBoxRect(employeeId, positions);
  const anchors = computeAnchors(from, to);
  const manualWaypoints = normalizeWaypoints(lineEdit?.waypoints);
  const path = manualWaypoints.length
    ? manualConnectorPath(anchors, manualWaypoints, routingType)
    : buildConnectorPath(anchors, null, routingType);
  return { ...path, anchors };
}

/** @deprecated use getConnectorGeometry */
export function edgePoints(managerId, employeeId, positions) {
  const { anchors } = getConnectorGeometry(managerId, employeeId, positions);
  return { x1: anchors.x1, y1: anchors.y1, x2: anchors.x2, y2: anchors.y2 };
}

export function defaultWaypoints(x1, y1, x2, y2, orthogonal) {
  if (orthogonal && Math.abs(x1 - x2) >= 4) {
    const midY = y1 + Math.max(24, (y2 - y1) * 0.45);
    return [{ x: x1, y: midY }, { x: x2, y: midY }];
  }
  return [{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }];
}

export function buildLinePath(x1, y1, x2, y2, waypoints, orthogonal) {
  const points = waypoints?.length
    ? [{ x: x1, y: y1 }, ...waypoints, { x: x2, y: y2 }]
    : [{ x: x1, y: y1 }, ...defaultWaypoints(x1, y1, x2, y2, orthogonal), { x: x2, y: y2 }];
  return { d: pathFromPoints(points), points: waypoints || [] };
}
