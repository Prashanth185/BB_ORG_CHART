/**
 * Session-scoped undo/redo history for the freeform org chart canvas.
 */

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createChartSnapshot({
  positions,
  lineEdits,
  relationships,
  routingNetwork,
  boxStyles,
  collapsed,
  showConnectionMarkers,
}) {
  return {
    positions: deepClone(positions),
    lineEdits: deepClone(lineEdits),
    relationships: deepClone(relationships || []),
    routingNetwork: deepClone(routingNetwork || { breakpoints: [], segments: [] }),
    boxStyles: deepClone(boxStyles),
    collapsed: Array.from(collapsed || []),
    showConnectionMarkers: showConnectionMarkers !== false,
  };
}

export function createChartHistory() {
  const undoStack = [];
  const redoStack = [];

  return {
    push(snapshot) {
      undoStack.push(deepClone(snapshot));
      redoStack.length = 0;
    },
    undo(currentSnapshot) {
      if (undoStack.length === 0) return null;
      redoStack.push(deepClone(currentSnapshot));
      return undoStack.pop();
    },
    redo(currentSnapshot) {
      if (redoStack.length === 0) return null;
      undoStack.push(deepClone(currentSnapshot));
      return redoStack.pop();
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
