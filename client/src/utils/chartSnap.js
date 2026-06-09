import { CARD_W, CARD_H } from './orgChartHelpers';

export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 10;

/**
 * Snap box top-left to grid and align with other boxes (edges and centers).
 */
export function snapBoxPosition(rawX, rawY, empId, positions, options = {}) {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const threshold = options.threshold ?? SNAP_THRESHOLD;

  const guides = { vertical: new Set(), horizontal: new Set() };
  const xTargets = [];
  const yTargets = [];

  for (const [id, pos] of Object.entries(positions)) {
    if (String(id) === String(empId)) continue;
    xTargets.push(pos.x, pos.x + CARD_W / 2, pos.x + CARD_W);
    yTargets.push(pos.y, pos.y + CARD_H / 2, pos.y + CARD_H);
  }

  const draggedXEdges = [0, CARD_W / 2, CARD_W];
  const draggedYEdges = [0, CARD_H / 2, CARD_H];

  let snapX = rawX;
  let snapY = rawY;
  let bestXDelta = threshold + 1;
  let bestYDelta = threshold + 1;

  for (const targetX of xTargets) {
    for (const edge of draggedXEdges) {
      const delta = targetX - (rawX + edge);
      if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestXDelta)) {
        bestXDelta = delta;
        snapX = rawX + delta;
        guides.vertical.add(targetX);
      }
    }
  }

  for (const targetY of yTargets) {
    for (const edge of draggedYEdges) {
      const delta = targetY - (rawY + edge);
      if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestYDelta)) {
        bestYDelta = delta;
        snapY = rawY + delta;
        guides.horizontal.add(targetY);
      }
    }
  }

  if (Math.abs(bestXDelta) > threshold) {
    const gridX = Math.round(rawX / gridSize) * gridSize;
    if (Math.abs(gridX - rawX) <= threshold) snapX = gridX;
  }

  if (Math.abs(bestYDelta) > threshold) {
    const gridY = Math.round(rawY / gridSize) * gridSize;
    if (Math.abs(gridY - rawY) <= threshold) snapY = gridY;
  }

  return {
    x: Math.max(0, snapX),
    y: Math.max(0, snapY),
    guides: {
      vertical: [...guides.vertical],
      horizontal: [...guides.horizontal],
    },
  };
}

export function gridBackgroundStyle(gridSize = GRID_SIZE) {
  const major = gridSize * 4;
  return {
    backgroundColor: '#f8fafc',
    backgroundImage: `
      linear-gradient(to right, rgba(148, 163, 184, 0.35) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148, 163, 184, 0.35) 1px, transparent 1px),
      linear-gradient(to right, rgba(100, 116, 139, 0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(100, 116, 139, 0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${major}px ${major}px, ${major}px ${major}px`,
  };
}
