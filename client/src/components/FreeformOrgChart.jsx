import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  GitBranch,
  Link2,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  MousePointer2,
  Move,
  Network,
  Palette,
  Pencil,
  Plus,
  PlusCircle,
  Redo2,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import SubOrgChartModal from './SubOrgChartModal';
import api from '../api/client';
import { EmployeeCard } from './common';
import LineEditModal from './LineEditModal';
import BoxStyleModal from './BoxStyleModal';
import AddLinePanel from './AddLinePanel';
import {
  getConnectorStyle, getDashArray, DEFAULT_LINE_SETTINGS,
  DRAW_LINE_COLORS, DRAW_LINE_WIDTHS,
  DEFAULT_DRAW_LINE_COLOR, DEFAULT_DRAW_LINE_WIDTH,
  DEFAULT_ROUTING_SEGMENT_COLOR, DEFAULT_ROUTING_SEGMENT_WIDTH,
} from '../utils/chartLineStyles';
import {
  CARD_W, CARD_H, buildChildrenMap, getHiddenEmployeeIds,
  getConnectorGeometry, buildOrthogonalRouteThroughPoints,
} from '../utils/orgChartHelpers';
import { snapBoxPosition, gridBackgroundStyle, GRID_SIZE } from '../utils/chartSnap';
import { createChartSnapshot, createChartHistory } from '../utils/chartHistory';
import { LoadingSpinner } from './common';

export default function FreeformOrgChart({
  globalLineSettings,
  onPositionsChange,
  theme = 'standard',
  orthogonalLines = true,
  routingType = 'orthogonal',
  onDrillDown,
}) {
  const cardVariant = theme === 'professional' ? 'professional' : 'standard';
  const containerRef = useRef(null);
  const dragMovedRef = useRef(false);
  const panRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [positions, setPositions] = useState({});
  const [lineEdits, setLineEdits] = useState({});
  const [boxStyles, setBoxStyles] = useState({});
  const [collapsed, setCollapsed] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [draggingBox, setDraggingBox] = useState(null);
  const [draggingWaypoint, setDraggingWaypoint] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
  const [connectWaypoints, setConnectWaypoints] = useState([]);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [drawLineMode, setDrawLineMode] = useState(false);
  const [lineDraft, setLineDraft] = useState(null);
  const [selectedBreakpointId, setSelectedBreakpointId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [draggingBreakpoint, setDraggingBreakpoint] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [autoMsg, setAutoMsg] = useState('');
  const [snapGuides, setSnapGuides] = useState({ vertical: [], horizontal: [] });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showConnectionMarkers, setShowConnectionMarkers] = useState(true);
  const [drawLineColor, setDrawLineColor] = useState(DEFAULT_DRAW_LINE_COLOR);
  const [drawLineWidth, setDrawLineWidth] = useState(DEFAULT_DRAW_LINE_WIDTH);
  const [historyVersion, setHistoryVersion] = useState(0);
  // ── drill-down modal ──
  const [drillEmployee, setDrillEmployee] = useState(null);
  const historyRef = useRef(createChartHistory());
  const dragHistorySnapshotRef = useRef(null);
  const breakpointDragSnapshotRef = useRef(null);
  const breakpointDragMovedRef = useRef(false);
  const drawLineModeRef = useRef(drawLineMode);
  drawLineModeRef.current = drawLineMode;
  const drawLineColorRef = useRef(drawLineColor);
  drawLineColorRef.current = drawLineColor;
  const drawLineWidthRef = useRef(drawLineWidth);
  drawLineWidthRef.current = drawLineWidth;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const lineEditsRef = useRef(lineEdits);
  lineEditsRef.current = lineEdits;
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const connectionDraftRef = useRef(connectionDraft);
  connectionDraftRef.current = connectionDraft;
  const connectWaypointsRef = useRef(connectWaypoints);
  connectWaypointsRef.current = connectWaypoints;
  const lineDraftRef = useRef(lineDraft);
  lineDraftRef.current = lineDraft;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const showConnectionMarkersRef = useRef(showConnectionMarkers);
  showConnectionMarkersRef.current = showConnectionMarkers;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const boxStylesRef = useRef(boxStyles);
  boxStylesRef.current = boxStyles;

  const captureSnapshot = useCallback(() => createChartSnapshot({
    positions: positionsRef.current,
    lineEdits: lineEditsRef.current,
    relationships: canvasRef.current?.relationships || [],
    routingNetwork: canvasRef.current?.routingNetwork || { breakpoints: [], segments: [] },
    boxStyles: boxStylesRef.current,
    collapsed: collapsedRef.current,
    showConnectionMarkers: showConnectionMarkersRef.current,
  }), []);

  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const recordHistory = useCallback(() => {
    historyRef.current.push(captureSnapshot());
    bumpHistory();
  }, [bumpHistory, captureSnapshot]);

  const applySnapshot = useCallback((snapshot) => {
    setPositions(snapshot.positions);
    setLineEdits(snapshot.lineEdits);
    setBoxStyles(snapshot.boxStyles);
    setCollapsed(new Set(snapshot.collapsed));
    setShowConnectionMarkers(snapshot.showConnectionMarkers);
    setCanvas((prev) => (prev ? {
      ...prev,
      relationships: snapshot.relationships,
      routingNetwork: snapshot.routingNetwork,
    } : prev));
  }, []);

  const loadCanvasRef = useRef(null);

  const loadCanvas = useCallback(() => {
    setLoading(true);
    api.chartLayout.canvas()
      .then((data) => {
        setCanvas(data);
        setPositions(data.positions || {});
        setLineEdits(data.lineEdits || {});
        setBoxStyles(data.boxStyles || {});
        setCollapsed(new Set(data.collapsed || []));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  loadCanvasRef.current = loadCanvas;

  const syncSnapshotToServer = useCallback(async (targetSnapshot) => {
    await api.chartLayout.savePositions(targetSnapshot.positions);

    const lineSaves = Object.entries(targetSnapshot.lineEdits)
      .filter(([, edit]) => Array.isArray(edit?.waypoints))
      .map(([relId, edit]) => api.chartLayout.saveLineWaypoints(Number(relId), edit.waypoints));
    await Promise.all(lineSaves);

    await api.chartLayout.saveRoutingNetwork(targetSnapshot.routingNetwork);

    const currentRels = canvasRef.current?.relationships || [];
    const targetRels = targetSnapshot.relationships;
    const currentIds = new Set(currentRels.map((r) => r.id));
    const targetIds = new Set(targetRels.map((r) => r.id));
    let needsReload = false;

    for (const rel of currentRels) {
      if (!targetIds.has(rel.id)) {
        await api.relationships.delete(rel.id);
        needsReload = true;
      }
    }

    for (const rel of targetRels) {
      if (!currentIds.has(rel.id)) {
        const created = await api.relationships.create({
          manager_id: rel.manager_id,
          employee_id: rel.employee_id,
          relationship_type: rel.relationship_type,
        });
        const edit = targetSnapshot.lineEdits[rel.id];
        if (edit) {
          if (edit.color || edit.width || edit.line_type) {
            await api.chartLayout.saveLineStyle(created.id, {
              color: edit.color,
              width: edit.width,
              line_type: edit.line_type,
            });
          }
          if (edit.waypoints?.length) {
            await api.chartLayout.saveLineWaypoints(created.id, edit.waypoints);
          }
        }
        needsReload = true;
      }
    }

    if (needsReload) loadCanvasRef.current?.();
  }, []);

  const handleUndo = useCallback(async () => {
    const previous = historyRef.current.undo(captureSnapshot());
    if (!previous) return;
    applySnapshot(previous);
    bumpHistory();
    try {
      await syncSnapshotToServer(previous);
    } catch (err) {
      console.error(err);
    }
  }, [applySnapshot, bumpHistory, captureSnapshot, syncSnapshotToServer]);

  const handleRedo = useCallback(async () => {
    const next = historyRef.current.redo(captureSnapshot());
    if (!next) return;
    applySnapshot(next);
    bumpHistory();
    try {
      await syncSnapshotToServer(next);
    } catch (err) {
      console.error(err);
    }
  }, [applySnapshot, bumpHistory, captureSnapshot, syncSnapshotToServer]);

  useEffect(() => { loadCanvas(); }, [loadCanvas]);

  const savePositions = useCallback(async (pos) => {
    setSaving(true);
    try {
      await api.chartLayout.savePositions(pos);
      onPositionsChange?.();
      setAutoMsg('Saved');
      setTimeout(() => setAutoMsg(''), 2500);
    } catch (err) {
      console.error(err);
      setAutoMsg('Save failed');
      alert(err.message || 'Unable to save chart changes');
    } finally {
      setSaving(false);
    }
  }, [onPositionsChange]);

  const getRoutingSegmentStyle = useCallback((segment) => ({
    color: segment?.color || DEFAULT_ROUTING_SEGMENT_COLOR,
    width: segment?.width ?? DEFAULT_ROUTING_SEGMENT_WIDTH,
  }), []);

  const updateSegmentStyle = useCallback((segmentId, patch) => {
    setCanvas((prev) => {
      if (!prev?.routingNetwork) return prev;
      return {
        ...prev,
        routingNetwork: {
          ...prev.routingNetwork,
          segments: prev.routingNetwork.segments.map((seg) => (
            seg.id === segmentId ? { ...seg, ...patch } : seg
          )),
        },
      };
    });
  }, []);

  const applyDrawStyleToNewRelationship = useCallback(async (relId) => {
    const color = drawLineColorRef.current;
    const width = drawLineWidthRef.current;
    await api.chartLayout.saveLineStyle(relId, { color, width });
    setLineEdits((prev) => ({
      ...prev,
      [relId]: { ...prev[relId], color, width },
    }));
  }, []);

  const handleDrawColorSelect = useCallback((color) => {
    drawLineColorRef.current = color;
    setDrawLineColor(color);
    if (selectedSegmentId) {
      recordHistory();
      updateSegmentStyle(selectedSegmentId, { color });
      api.chartLayout.saveRoutingSegmentStyle(selectedSegmentId, { color }).catch(console.error);
    } else if (selectedLine) {
      recordHistory();
      const width = lineEditsRef.current[selectedLine.id]?.width ?? drawLineWidthRef.current;
      setLineEdits((prev) => ({
        ...prev,
        [selectedLine.id]: { ...prev[selectedLine.id], color, width },
      }));
      api.chartLayout.saveLineStyle(selectedLine.id, { color, width }).catch(console.error);
    }
  }, [recordHistory, selectedLine, selectedSegmentId, updateSegmentStyle]);

  const handleDrawWidthSelect = useCallback((width) => {
    drawLineWidthRef.current = width;
    setDrawLineWidth(width);
    if (selectedSegmentId) {
      recordHistory();
      updateSegmentStyle(selectedSegmentId, { width });
      api.chartLayout.saveRoutingSegmentStyle(selectedSegmentId, { width }).catch(console.error);
    } else if (selectedLine) {
      recordHistory();
      const color = lineEditsRef.current[selectedLine.id]?.color ?? drawLineColorRef.current;
      setLineEdits((prev) => ({
        ...prev,
        [selectedLine.id]: { ...prev[selectedLine.id], color, width },
      }));
      api.chartLayout.saveLineStyle(selectedLine.id, { color, width }).catch(console.error);
    }
  }, [recordHistory, selectedLine, selectedSegmentId, updateSegmentStyle]);

  const handleSaveChart = useCallback(async () => {
    setSaving(true);
    try {
      if (lineDraftRef.current) {
        const draft = lineDraftRef.current;
        if (Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) >= 8) {
          recordHistory();
          await api.chartLayout.createRoutingSegment({
            start: draft.start,
            end: draft.end,
            direction: draft.direction,
            color: drawLineColorRef.current,
            width: drawLineWidthRef.current,
          });
          setLineDraft(null);
        }
      }

      await api.chartLayout.savePositions(positionsRef.current);

      const waypointSaves = Object.entries(lineEditsRef.current)
        .filter(([, edit]) => Array.isArray(edit?.waypoints))
        .map(([relId, edit]) => api.chartLayout.saveLineWaypoints(Number(relId), edit.waypoints));

      const styleSaves = Object.entries(lineEditsRef.current)
        .filter(([, edit]) => edit?.color || edit?.width)
        .map(([relId, edit]) => api.chartLayout.saveLineStyle(Number(relId), {
          color: edit.color,
          width: edit.width,
          line_type: edit.line_type,
        }));

      const routingNetwork = canvasRef.current?.routingNetwork;
      const routingSave = routingNetwork
        ? api.chartLayout.saveRoutingNetwork(routingNetwork)
        : Promise.resolve();

      await Promise.all([...waypointSaves, ...styleSaves, routingSave]);

      onPositionsChange?.();
      setAutoMsg('Chart saved');
      setTimeout(() => setAutoMsg(''), 3000);
      loadCanvasRef.current?.();
    } catch (err) {
      console.error(err);
      setAutoMsg('Save failed');
      alert(err.message || 'Unable to save chart changes');
    } finally {
      setSaving(false);
    }
  }, [onPositionsChange, recordHistory]);

  const handleAutoArrange = async () => {
    setLoading(true);
    try {
      const data = await api.chartLayout.autoArrange();
      setPositions(data.positions);
      setAutoMsg('Layout saved');
      setTimeout(() => setAutoMsg(''), 3000);
      loadCanvas();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCanvasPoint = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left + (containerRef.current?.scrollLeft || 0)) / zoom,
      y: (e.clientY - rect.top + (containerRef.current?.scrollTop || 0)) / zoom,
    };
  }, [zoom]);

  const snapPoint = useCallback((point) => {
    if (!snapEnabled) return { x: Math.max(0, point.x), y: Math.max(0, point.y) };
    return {
      x: Math.max(0, Math.round(point.x / GRID_SIZE) * GRID_SIZE),
      y: Math.max(0, Math.round(point.y / GRID_SIZE) * GRID_SIZE),
    };
  }, [snapEnabled]);

  const handleBoxClick = async (emp, e) => {
    if (e.target.closest('[data-chart-control]')) return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    if (drawLineMode) {
      e.stopPropagation();
      setSelectedNodeId(emp.id);
      setSelectedNodeIds(new Set([emp.id]));
      return;
    }

    if (connectMode) {
      e.stopPropagation();
      if (!connectFrom) {
        setConnectFrom(emp.id);
        setConnectWaypoints([]);
        setAutoMsg(`From: ${emp.name} — now click who reports to them`);
      } else if (connectFrom === emp.id) {
        setAutoMsg('Choose a different person for "To"');
      } else {
        try {
          recordHistory();
          const rel = await api.relationships.create({
            employee_id: emp.id,
            manager_id: connectFrom,
            relationship_type: 'reports_to',
          });
          await applyDrawStyleToNewRelationship(rel.id);
          if (connectWaypointsRef.current.length) {
            await api.chartLayout.saveLineWaypoints(rel.id, connectWaypointsRef.current);
          }
          setConnectFrom(null);
          setConnectWaypoints([]);
          setConnectMode(false);
          setSelectedLine(rel);
          setAutoMsg(connectWaypointsRef.current.length ? 'Connector added with manual routing' : 'Connector added');
          setTimeout(() => setAutoMsg(''), 2000);
          loadCanvas();
        } catch (err) {
          alert(err.message);
        }
      }
      return;
    }

    e.stopPropagation();
    setSelectedNodeId(emp.id);
    setSelectedNodeIds((prev) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const next = new Set(prev);
        if (next.has(emp.id)) next.delete(emp.id);
        else next.add(emp.id);
        return next;
      }
      return new Set([emp.id]);
    });
    setSelectedLine(null);
    setSelectedWaypoint(null);
    const childIds = buildChildrenMap(canvas?.relationships || []).get(emp.id) || [];
    if (childIds.length > 0) {
      toggleCollapse(emp.id);
    }
  };

  const handleBoxMouseDown = (e, empId) => {
    if (connectMode) return;
    if (drawLineMode) return;
    if (e.target.closest('[data-chart-control]')) return;
    e.preventDefault();
    e.stopPropagation();
    dragMovedRef.current = false;
    const canvasPoint = getCanvasPoint(e);
    const pos = positions[empId] || { x: 0, y: 0 };
    const selectedIds = selectedNodeIdsRef.current.has(empId)
      ? Array.from(selectedNodeIdsRef.current)
      : [empId];
    if (!selectedNodeIdsRef.current.has(empId)) {
      setSelectedNodeId(empId);
      setSelectedNodeIds(new Set([empId]));
    }
    dragHistorySnapshotRef.current = captureSnapshot();
    setDraggingBox({
      empId,
      selectedIds,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: canvasPoint.x - pos.x,
      offsetY: canvasPoint.y - pos.y,
      startPositions: Object.fromEntries(selectedIds.map((id) => [id, positionsRef.current[id] || { x: 60, y: 60 }])),
    });
  };

  useEffect(() => {
    if (!draggingBox) return;
    const onMove = (e) => {
      if (
        Math.abs(e.clientX - draggingBox.startX) > 4
        || Math.abs(e.clientY - draggingBox.startY) > 4
      ) {
        dragMovedRef.current = true;
      }
      const canvasPoint = getCanvasPoint(e);
      const rawX = Math.max(0, canvasPoint.x - draggingBox.offsetX);
      const rawY = Math.max(0, canvasPoint.y - draggingBox.offsetY);
      const snapped = snapEnabled
        ? snapBoxPosition(rawX, rawY, draggingBox.empId, positionsRef.current)
        : { x: rawX, y: rawY, guides: { vertical: [], horizontal: [] } };
      setSnapGuides(snapped.guides);
      setPositions((prev) => {
        const next = { ...prev };
        const activeStart = draggingBox.startPositions[draggingBox.empId] || { x: 0, y: 0 };
        const dx = snapped.x - activeStart.x;
        const dy = snapped.y - activeStart.y;
        for (const id of draggingBox.selectedIds || [draggingBox.empId]) {
          const start = draggingBox.startPositions[id] || prev[id] || { x: 60, y: 60 };
          next[id] = { x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) };
        }
        positionsRef.current = next;
        return next;
      });
    };
    const onUp = () => {
      if (draggingBox && dragMovedRef.current) {
        if (dragHistorySnapshotRef.current) {
          historyRef.current.push(dragHistorySnapshotRef.current);
          bumpHistory();
          dragHistorySnapshotRef.current = null;
        }
        savePositions(positionsRef.current);
      } else {
        dragHistorySnapshotRef.current = null;
      }
      setDraggingBox(null);
      setSnapGuides({ vertical: [], horizontal: [] });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [bumpHistory, draggingBox, getCanvasPoint, savePositions, snapEnabled]);

  const getLineStyle = (rel) => {
    const edit = lineEdits[rel.id];
    const isShapeConnector = (routingType || (orthogonalLines ? 'orthogonal' : 'straight')) === 'orthogonal';
    if (isShapeConnector && !edit?.color && !edit?.width && !edit?.line_type) {
      return {
        color: '#d7dbe0',
        width: 1.4,
        dash: undefined,
      };
    }
    if (edit?.color || edit?.width || edit?.line_type) {
      return {
        color: edit.color || globalLineSettings.color,
        width: edit.width ?? globalLineSettings.width,
        dash: getDashArray(edit.line_type || globalLineSettings.lineType),
      };
    }
    return getConnectorStyle(rel.relationship_type, globalLineSettings);
  };

  const syncDrawStyleFromLine = useCallback((rel) => {
    const style = getLineStyle(rel);
    drawLineColorRef.current = style.color;
    drawLineWidthRef.current = style.width;
    setDrawLineColor(style.color);
    setDrawLineWidth(style.width);
  }, [globalLineSettings, lineEdits, orthogonalLines, routingType]);

  const syncDrawStyleFromSegment = useCallback((segment) => {
    const style = getRoutingSegmentStyle(segment);
    drawLineColorRef.current = style.color;
    drawLineWidthRef.current = style.width;
    setDrawLineColor(style.color);
    setDrawLineWidth(style.width);
  }, [getRoutingSegmentStyle]);

  const getLineGeometry = useCallback((rel) => {
    return getConnectorGeometry(
      rel.manager_id,
      rel.employee_id,
      positions,
      lineEdits[rel.id],
      routingType || (orthogonalLines ? 'orthogonal' : 'straight'),
    );
  }, [positions, lineEdits, orthogonalLines, routingType]);

  const saveLineWaypoints = useCallback(async (relId, waypoints) => {
    try {
      await api.chartLayout.saveLineWaypoints(relId, waypoints);
      setLineEdits((prev) => ({
        ...prev,
        [relId]: { ...prev[relId], waypoints },
      }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const waypointDragRef = useRef(null);

  const findWaypointInsertIndex = useCallback((rel, point) => {
    const geo = getLineGeometry(rel);
    const route = geo.points?.length
      ? geo.points
      : [{ x: geo.anchors.x1, y: geo.anchors.y1 }, ...geo.waypoints, { x: geo.anchors.x2, y: geo.anchors.y2 }];
    let best = { index: geo.waypoints.length, dist: Infinity };

    for (let i = 0; i < route.length - 1; i += 1) {
      const dist = distanceToSegment(point, route[i], route[i + 1]);
      if (dist < best.dist) {
        const before = geo.waypoints.filter((wp) => route.findIndex((p) => pointsEqual(p, wp)) <= i).length;
        best = { index: before, dist };
      }
    }

    return best.index;
  }, [getLineGeometry]);

  const insertWaypoint = useCallback((rel, point) => {
    recordHistory();
    const geo = getLineGeometry(rel);
    const wp = [...(geo.waypoints || [])];
    const snapped = snapPoint(point);
    const index = findWaypointInsertIndex(rel, snapped);
    wp.splice(index, 0, snapped);
    setLineEdits((prev) => ({
      ...prev,
      [rel.id]: { ...prev[rel.id], waypoints: wp },
    }));
    setSelectedLine(rel);
    setSelectedWaypoint({ relId: rel.id, index });
    saveLineWaypoints(rel.id, wp);
  }, [findWaypointInsertIndex, getLineGeometry, recordHistory, saveLineWaypoints, snapPoint]);

  const handleWaypointMouseDown = (e, rel, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const geo = getLineGeometry(rel);
    let waypoints = geo.waypoints.map((p) => ({ ...p }));
    let index = handle.index;
    if (handle.kind !== 'routing') {
      const point = snapPoint({ x: handle.x, y: handle.y });
      index = findWaypointInsertIndex(rel, point);
      waypoints.splice(index, 0, point);
    }
    recordHistory();
    setSelectedLine(rel);
    setSelectedBox(null);
    setSelectedWaypoint({ relId: rel.id, index });
    waypointDragRef.current = {
      relId: rel.id,
      index,
      waypoints,
    };
    setDraggingWaypoint(rel.id);
  };

  useEffect(() => {
    if (!draggingWaypoint) return;
    const onMove = (e) => {
      const drag = waypointDragRef.current;
      if (!drag) return;
      const point = snapPoint(getCanvasPoint(e));
      const wp = drag.waypoints.map((p, index) => (
        index === drag.index ? point : p
      ));
      drag.waypoints = wp;
      setLineEdits((prev) => ({
        ...prev,
        [drag.relId]: { ...prev[drag.relId], waypoints: wp },
      }));
    };
    const onUp = () => {
      const drag = waypointDragRef.current;
      if (drag?.waypoints?.length) {
        saveLineWaypoints(drag.relId, drag.waypoints);
      }
      waypointDragRef.current = null;
      setDraggingWaypoint(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingWaypoint, getCanvasPoint, saveLineWaypoints, snapPoint]);

  const toggleCollapse = async (empId) => {
    const next = new Set(collapsed);
    if (next.has(empId)) next.delete(empId);
    else next.add(empId);
    setCollapsed(next);
    await api.chartLayout.setCollapsed(empId, next.has(empId));
  };

  const handleAddLine = async (data) => {
    recordHistory();
    const created = await api.relationships.create(data);
    await applyDrawStyleToNewRelationship(created.id);
    setShowAddLine(false);
    setAutoMsg('Line added');
    setTimeout(() => setAutoMsg(''), 2000);
    loadCanvas();
  };

  const handleCreateNode = async () => {
    const name = window.prompt('New node name:', 'New person');
    if (!name?.trim()) return;
    const designation = window.prompt('Designation / title:', 'Title') || 'Title';
    const department = window.prompt('Department:', 'Dept') || 'Dept';
    try {
      recordHistory();
      const created = await api.employees.create({
        employee_id: `EMP-${Date.now()}`,
        name: name.trim(),
        designation,
        department,
        email: '',
        phone: '',
      });
      const nextPositions = {
        ...positionsRef.current,
        [created.id]: {
          x: Math.max(40, ((containerRef.current?.scrollLeft || 0) / zoom) + 80),
          y: Math.max(40, ((containerRef.current?.scrollTop || 0) / zoom) + 80),
        },
      };
      setPositions(nextPositions);
      setSelectedNodeId(created.id);
      setSelectedNodeIds(new Set([created.id]));
      await savePositions(nextPositions);
      setAutoMsg('Node created');
      setTimeout(() => setAutoMsg(''), 2000);
      loadCanvas();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFitView = () => {
    const el = containerRef.current;
    if (!el) return;
    const nextZoom = Math.max(0.25, Math.min(1.5, Math.min(
      (el.clientWidth - 24) / Math.max(canvasWidth, 1),
      (el.clientHeight - 24) / Math.max(canvasHeight, 1),
    )));
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    });
  };

  const handleMinimapClick = (e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;
    el.scrollLeft = Math.max(0, x * zoom - el.clientWidth / 2);
    el.scrollTop = Math.max(0, y * zoom - el.clientHeight / 2);
  };

  const getAnchorPoint = useCallback((empId, anchor, sourcePositions = positionsRef.current) => {
    const pos = sourcePositions[empId] || { x: 60, y: 60 };
    const points = {
      top: { x: pos.x + CARD_W / 2, y: pos.y },
      right: { x: pos.x + CARD_W, y: pos.y + CARD_H / 2 },
      bottom: { x: pos.x + CARD_W / 2, y: pos.y + CARD_H },
      left: { x: pos.x, y: pos.y + CARD_H / 2 },
    };
    return points[anchor] || points.right;
  }, []);

  const findNearestAnchor = useCallback((point, sourceId = null) => {
    let best = null;
    for (const emp of canvas?.employees || []) {
      if (emp.id === sourceId) continue;
      for (const anchor of ['top', 'right', 'bottom', 'left']) {
        const p = getAnchorPoint(emp.id, anchor);
        const dist = Math.hypot(point.x - p.x, point.y - p.y);
        if (!best || dist < best.dist) best = { empId: emp.id, anchor, point: p, dist };
      }
    }
    return best?.dist <= 34 ? best : null;
  }, [canvas?.employees, getAnchorPoint]);

  const startFreeformLine = useCallback((start) => {
    setLineDraft({
      start,
      end: { x: start.x, y: start.y },
      direction: null,
    });
    setSelectedLine(null);
    setSelectedBox(null);
    setSelectedBreakpointId(start.type === 'breakpoint' ? start.id : null);
    setSelectedSegmentId(null);
    setAutoMsg('Draw line: move horizontally/vertically, then right-click to stop and create breakpoint');
  }, []);

  const snapAxisPoint = useCallback((start, point) => {
    const snapped = snapPoint(point);
    const dx = snapped.x - start.x;
    const dy = snapped.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return {
        point: { x: snapped.x, y: start.y },
        direction: dx >= 0 ? 'right' : 'left',
      };
    }
    return {
      point: { x: start.x, y: snapped.y },
      direction: dy >= 0 ? 'down' : 'up',
    };
  }, [snapPoint]);

  const saveLineDraft = useCallback(async () => {
    const draft = lineDraftRef.current;
    if (!draft || Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) < 8) return;
    try {
      recordHistory();
      await api.chartLayout.createRoutingSegment({
        start: draft.start,
        end: draft.end,
        direction: draft.direction,
        color: drawLineColorRef.current,
        width: drawLineWidthRef.current,
      });
      setLineDraft(null);
      setAutoMsg('Breakpoint created - click it later to continue or branch');
      setTimeout(() => setAutoMsg(''), 2500);
      loadCanvas();
    } catch (err) {
      alert(err.message);
    }
  }, [loadCanvas, recordHistory]);

  const handleAnchorMouseDown = (e, emp, anchor) => {
    e.preventDefault();
    e.stopPropagation();
    const start = getAnchorPoint(emp.id, anchor);
    if (drawLineModeRef.current) {
      setSelectedNodeId(emp.id);
      setSelectedLine(null);
      startFreeformLine({
        type: 'employee',
        id: emp.id,
        anchor,
        x: start.x,
        y: start.y,
      });
      return;
    }
    const end = getCanvasPoint(e);
    setSelectedNodeId(emp.id);
    setSelectedLine(null);
    setConnectionDraft({
      fromId: emp.id,
      fromAnchor: anchor,
      start,
      end,
      targetId: null,
      targetAnchor: null,
    });
  };


  const handleReconnectMouseDown = (e, rel, endpoint) => {
    e.preventDefault();
    e.stopPropagation();
    const geo = getLineGeometry(rel);
    const draggingSource = endpoint === 'source';
    const fixedId = draggingSource ? rel.employee_id : rel.manager_id;
    const start = draggingSource
      ? { x: geo.anchors.x2, y: geo.anchors.y2 }
      : { x: geo.anchors.x1, y: geo.anchors.y1 };
    const end = draggingSource
      ? { x: geo.anchors.x1, y: geo.anchors.y1 }
      : { x: geo.anchors.x2, y: geo.anchors.y2 };
    setSelectedLine(rel);
    setSelectedBox(null);
    setConnectionDraft({
      mode: 'reconnect',
      relId: rel.id,
      endpoint,
      relationshipType: rel.relationship_type,
      fixedId,
      fromId: draggingSource ? rel.employee_id : rel.manager_id,
      fromAnchor: null,
      start,
      end,
      targetId: null,
      targetAnchor: null,
    });
  };

  useEffect(() => {
    if (!connectionDraft) return;
    const onMove = (e) => {
      const point = getCanvasPoint(e);
      const target = findNearestAnchor(point, connectionDraft.fromId);
      setConnectionDraft((prev) => prev && ({
        ...prev,
        end: target?.point || point,
        targetId: target?.empId || null,
        targetAnchor: target?.anchor || null,
      }));
    };
    const onUp = async () => {
      const draft = connectionDraftRef.current;
      setConnectionDraft(null);
      if (!draft?.targetId || draft.targetId === draft.fromId) return;
      try {
        recordHistory();
        if (draft.mode === 'reconnect') {
          await api.relationships.update(draft.relId, {
            manager_id: draft.endpoint === 'source' ? draft.targetId : draft.fromId,
            employee_id: draft.endpoint === 'target' ? draft.targetId : draft.fixedId,
            relationship_type: draft.relationshipType || 'reports_to',
          });
          await api.chartLayout.saveLineWaypoints(draft.relId, []);
          setLineEdits((prev) => ({
            ...prev,
            [draft.relId]: { ...prev[draft.relId], waypoints: [] },
          }));
          setAutoMsg('Connector reconnected');
        } else {
          const created = await api.relationships.create({
            manager_id: draft.fromId,
            employee_id: draft.targetId,
            relationship_type: 'reports_to',
          });
          await applyDrawStyleToNewRelationship(created.id);
          setAutoMsg('Connector added');
        }
        setTimeout(() => setAutoMsg(''), 2000);
        loadCanvas();
      } catch (err) {
        alert(err.message);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [applyDrawStyleToNewRelationship, connectionDraft, findNearestAnchor, getCanvasPoint, loadCanvas, recordHistory]);

  const handleAddReport = async (manager) => {
    const name = window.prompt(`New direct report for ${manager.name}:`);
    if (!name?.trim()) return;
    const designation = window.prompt('Designation / title:', 'Title') || 'Title';
    const department = window.prompt('Department:', manager.department || '') || manager.department || '';
    try {
      const created = await api.employees.create({
        employee_id: `EMP-${Date.now()}`,
        name: name.trim(),
        designation,
        department,
        email: '',
        phone: '',
        reporting_to: manager.id,
      });
      const managerPos = positionsRef.current[manager.id] || { x: 60, y: 60 };
      const nextPositions = {
        ...positionsRef.current,
        [created.id]: { x: managerPos.x, y: managerPos.y + CARD_H + 80 },
      };
      setPositions(nextPositions);
      await savePositions(nextPositions);
      setAutoMsg('Employee added');
      setTimeout(() => setAutoMsg(''), 2000);
      loadCanvas();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteLine = async () => {
    if (!selectedLine || !confirm('Delete this connection line?')) return;
    recordHistory();
    await api.relationships.delete(selectedLine.id);
    setSelectedLine(null);
    setSelectedWaypoint(null);
    loadCanvas();
  };

  const updateSelectedLineWaypoints = useCallback((updater) => {
    if (!selectedLine) return;
    const current = [...(lineEditsRef.current[selectedLine.id]?.waypoints || [])];
    const next = updater(current);
    setLineEdits((prev) => ({
      ...prev,
      [selectedLine.id]: { ...prev[selectedLine.id], waypoints: next },
    }));
    saveLineWaypoints(selectedLine.id, next);
  }, [saveLineWaypoints, selectedLine]);

  const deleteSelectedWaypoint = useCallback(() => {
    if (!selectedLine || selectedWaypoint?.relId !== selectedLine.id) return false;
    recordHistory();
    updateSelectedLineWaypoints((current) => current.filter((_, index) => index !== selectedWaypoint.index));
    setSelectedWaypoint(null);
    return true;
  }, [selectedLine, selectedWaypoint, updateSelectedLineWaypoints]);

  const moveSelectedWaypoint = useCallback((direction) => {
    if (!selectedLine || selectedWaypoint?.relId !== selectedLine.id) return;
    recordHistory();
    updateSelectedLineWaypoints((current) => {
      const from = selectedWaypoint.index;
      const to = from + direction;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      setSelectedWaypoint({ relId: selectedLine.id, index: to });
      return next;
    });
  }, [recordHistory, selectedLine, selectedWaypoint, updateSelectedLineWaypoints]);

  const handleDeleteSelectedNodes = async () => {
    const ids = Array.from(selectedNodeIdsRef.current);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length === 1 ? 'this node' : `${ids.length} selected nodes`} and its connections?`)) return;
    try {
      recordHistory();
      await Promise.all(ids.map((id) => api.employees.delete(id)));
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());
      setSelectedLine(null);
      setAutoMsg(ids.length === 1 ? 'Node deleted' : 'Nodes deleted');
      setTimeout(() => setAutoMsg(''), 2000);
      loadCanvas();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteSelectedRoutingObject = useCallback(async () => {
    try {
      if (selectedBreakpointId) {
        recordHistory();
        await api.chartLayout.deleteRoutingBreakpoint(selectedBreakpointId);
        setSelectedBreakpointId(null);
        loadCanvas();
        return true;
      }
      if (selectedSegmentId) {
        recordHistory();
        await api.chartLayout.deleteRoutingSegment(selectedSegmentId);
        setSelectedSegmentId(null);
        loadCanvas();
        return true;
      }
    } catch (err) {
      alert(err.message);
      return true;
    }
    return false;
  }, [loadCanvas, recordHistory, selectedBreakpointId, selectedSegmentId]);

  const toggleConnectionMarkers = useCallback((visible) => {
    recordHistory();
    setShowConnectionMarkers(visible);
  }, [recordHistory]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }
      if ((e.key === 'Escape') && lineDraftRef.current) {
        e.preventDefault();
        setLineDraft(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedBreakpointId || selectedSegmentId)) {
        e.preventDefault();
        deleteSelectedRoutingObject();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLine) {
        e.preventDefault();
        if (!deleteSelectedWaypoint()) handleDeleteLine();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIdsRef.current.size > 0) {
        e.preventDefault();
        handleDeleteSelectedNodes();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedRoutingObject, deleteSelectedWaypoint, handleRedo, handleUndo, selectedBreakpointId, selectedLine, selectedSegmentId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateViewport = () => {
      setViewport({
        left: el.scrollLeft / zoom,
        top: el.scrollTop / zoom,
        width: el.clientWidth / zoom,
        height: el.clientHeight / zoom,
      });
    };
    updateViewport();
    el.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      el.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [zoom, canvas]);

  const handleCanvasMouseDown = (e) => {
    if (connectMode && connectFrom && e.button === 0) {
      if (e.target.closest('[data-chart-control]')) return;
      e.preventDefault();
      const point = snapPoint(getCanvasPoint(e));
      setConnectWaypoints((prev) => [...prev, point]);
      setAutoMsg(`Routing dot ${connectWaypointsRef.current.length + 1} added - click target node to finish`);
      return;
    }
    if (!panMode) return;
    if (e.target.closest('[data-chart-control]')) return;
    const el = containerRef.current;
    if (!el) return;
    e.preventDefault();
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const handleCanvasMouseMove = (e) => {
    const draft = lineDraftRef.current;
    if (!drawLineMode || !draft) return;
    const next = snapAxisPoint(draft.start, getCanvasPoint(e));
    setLineDraft((prev) => prev && {
      ...prev,
      end: next.point,
      direction: next.direction,
    });
  };

  const handleCanvasContextMenu = (e) => {
    if (!drawLineMode || !lineDraftRef.current) return;
    e.preventDefault();
    saveLineDraft();
  };

  const handleBreakpointMouseDown = (e, breakpoint) => {
    e.preventDefault();
    e.stopPropagation();
    if (drawLineMode) {
      startFreeformLine({
        type: 'breakpoint',
        id: breakpoint.id,
        x: breakpoint.x,
        y: breakpoint.y,
      });
      return;
    }
    setSelectedBreakpointId(breakpoint.id);
    setSelectedSegmentId(null);
    setSelectedLine(null);
    setSelectedBox(null);
    breakpointDragSnapshotRef.current = captureSnapshot();
    breakpointDragMovedRef.current = false;
    setDraggingBreakpoint({
      id: breakpoint.id,
      offsetX: getCanvasPoint(e).x - breakpoint.x,
      offsetY: getCanvasPoint(e).y - breakpoint.y,
    });
  };

  useEffect(() => {
    if (!draggingBreakpoint) return;
    const onMove = (e) => {
      breakpointDragMovedRef.current = true;
      const point = snapPoint({
        x: getCanvasPoint(e).x - draggingBreakpoint.offsetX,
        y: getCanvasPoint(e).y - draggingBreakpoint.offsetY,
      });
      setCanvas((prev) => {
        if (!prev?.routingNetwork) return prev;
        return {
          ...prev,
          routingNetwork: {
            ...prev.routingNetwork,
            breakpoints: prev.routingNetwork.breakpoints.map((bp) => (
              bp.id === draggingBreakpoint.id ? { ...bp, ...point } : bp
            )),
          },
        };
      });
    };
    const onUp = async () => {
      const bp = canvas?.routingNetwork?.breakpoints?.find((item) => item.id === draggingBreakpoint.id);
      if (bp) {
        try {
          if (breakpointDragMovedRef.current && breakpointDragSnapshotRef.current) {
            historyRef.current.push(breakpointDragSnapshotRef.current);
            bumpHistory();
          }
          breakpointDragSnapshotRef.current = null;
          breakpointDragMovedRef.current = false;
          await api.chartLayout.moveRoutingBreakpoint(bp.id, { x: bp.x, y: bp.y });
        } catch (err) {
          alert(err.message);
        }
      }
      setDraggingBreakpoint(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [bumpHistory, canvas?.routingNetwork?.breakpoints, draggingBreakpoint, getCanvasPoint, snapPoint]);

  useEffect(() => {
    const onMove = (e) => {
      if (!panRef.current || !containerRef.current) return;
      containerRef.current.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.x);
      containerRef.current.scrollTop = panRef.current.scrollTop - (e.clientY - panRef.current.y);
    };
    const onUp = () => {
      panRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (loading && !canvas) return <LoadingSpinner message="Loading chart..." />;

  const allEmployees = canvas?.employees || [];
  const allRelationships = canvas?.relationships || [];
  const routingBreakpoints = canvas?.routingNetwork?.breakpoints || [];
  const routingSegments = canvas?.routingNetwork?.segments || [];
  const breakpointMap = new Map(routingBreakpoints.map((bp) => [bp.id, bp]));
  const childrenMap = buildChildrenMap(allRelationships);
  const hiddenIds = getHiddenEmployeeIds(collapsed, childrenMap);

  const employees = allEmployees.filter((e) => !hiddenIds.has(e.id));
  const relationships = allRelationships.filter(
    (r) => !hiddenIds.has(r.employee_id) && !hiddenIds.has(r.manager_id)
  );
  const roots = allEmployees.filter(
    (e) => !allRelationships.some((r) => r.employee_id === e.id && r.relationship_type === 'reports_to')
  );
  const levelMap = new Map();
  const assignLevel = (empId, level) => {
    if (levelMap.has(empId) && levelMap.get(empId) <= level) return;
    levelMap.set(empId, level);
    for (const childId of childrenMap.get(empId) || []) assignLevel(childId, level + 1);
  };
  roots.forEach((root) => assignLevel(root.id, 0));

  const routeExtentPoints = [
    ...Object.values(lineEdits).flatMap((edit) => edit?.waypoints || []),
    ...connectWaypoints,
    ...routingBreakpoints,
    ...(lineDraft ? [lineDraft.end] : []),
  ];
  const canvasWidth = Math.max(
    800,
    ...employees.map((e) => (positions[e.id]?.x || 0) + CARD_W + 80),
    ...routeExtentPoints.map((p) => p.x + 80),
  );
  const canvasHeight = Math.max(
    500,
    ...employees.map((e) => (positions[e.id]?.y || 0) + CARD_H + 80),
    ...routeExtentPoints.map((p) => p.y + 80),
  );

  const selectedLineStyle = selectedLine ? lineEdits[selectedLine.id] : null;
  const selectedSegment = selectedSegmentId
    ? routingSegments.find((seg) => seg.id === selectedSegmentId)
    : null;
  const activeDrawColor = selectedSegment
    ? getRoutingSegmentStyle(selectedSegment).color
    : selectedLine
      ? getLineStyle(selectedLine).color
      : drawLineColor;
  const activeDrawWidth = selectedSegment
    ? getRoutingSegmentStyle(selectedSegment).width
    : selectedLine
      ? getLineStyle(selectedLine).width
      : drawLineWidth;
  const draftPath = connectionDraft
    ? getDraftPath(connectionDraft.start, connectionDraft.end, routingType)
    : '';
  const connectDraftStart = connectFrom ? getAnchorPoint(connectFrom, 'right') : null;
  const connectDraftPath = connectDraftStart && connectWaypoints.length
    ? pathFromPoints(buildOrthogonalRouteThroughPoints([connectDraftStart, ...connectWaypoints]))
    : '';
  const getRoutingSegmentPoints = (segment) => {
    let start;
    if (segment.from_breakpoint_id) {
      start = breakpointMap.get(segment.from_breakpoint_id);
    } else if (segment.from_employee_id) {
      start = getAnchorPoint(segment.from_employee_id, segment.from_anchor || 'right');
    } else {
      start = { x: segment.from_x || 0, y: segment.from_y || 0 };
    }
    const end = breakpointMap.get(segment.to_breakpoint_id);
    if (!start || !end) return null;
    return { start, end };
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3" data-export-exclude>
        <button
          type="button"
          onClick={handleCreateNode}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> New Node
        </button>
        <button
          type="button"
          onClick={() => { setShowAddLine(!showAddLine); setConnectMode(false); setConnectFrom(null); setConnectWaypoints([]); setDrawLineMode(false); setLineDraft(null); }}
          className={`btn-secondary text-sm flex items-center gap-1 ${showAddLine ? 'ring-2 ring-primary-400' : ''}`}
        >
          <Link2 className="w-4 h-4" /> Add Line
        </button>
        <button
          type="button"
          onClick={() => {
            setConnectMode(!connectMode);
            setConnectFrom(null);
            setConnectWaypoints([]);
            setDrawLineMode(false);
            setLineDraft(null);
            setShowAddLine(false);
            setAutoMsg(connectMode ? '' : 'Click source node, click routing dots on canvas, then click target node');
          }}
          className={`btn-secondary text-sm ${connectMode ? 'bg-primary-100 ring-2 ring-primary-400' : ''}`}
        >
          {connectMode ? 'Cancel Connect' : 'Connect on Chart'}
        </button>
        <button
          type="button"
          onClick={() => {
            setDrawLineMode((value) => !value);
            setLineDraft(null);
            setConnectMode(false);
            setConnectFrom(null);
            setConnectWaypoints([]);
            setShowAddLine(false);
            setAutoMsg(drawLineMode ? '' : 'Draw Line: click node or breakpoint, drag direction, right-click to stop');
          }}
          className={`btn-secondary text-sm flex items-center gap-1.5 ${drawLineMode ? 'bg-primary-100 ring-2 ring-primary-400' : ''}`}
        >
          <GitBranch className="w-4 h-4" /> {drawLineMode ? 'Cancel Draw Line' : 'Draw Line'}
        </button>
        {selectedLine && (
          <button
            type="button"
            onClick={handleDeleteLine}
            className="btn-secondary text-sm flex items-center gap-1.5 text-red-600"
          >
            <Trash2 className="w-4 h-4" /> Delete Link
          </button>
        )}
        {selectedWaypoint && selectedLine && (
          <>
            <button
              type="button"
              onClick={() => moveSelectedWaypoint(-1)}
              className="btn-secondary text-sm"
              title="Move selected routing dot earlier"
            >
              Dot Earlier
            </button>
            <button
              type="button"
              onClick={() => moveSelectedWaypoint(1)}
              className="btn-secondary text-sm"
              title="Move selected routing dot later"
            >
              Dot Later
            </button>
            <button
              type="button"
              onClick={deleteSelectedWaypoint}
              className="btn-secondary text-sm text-red-600"
              title="Delete selected routing dot"
            >
              Delete Dot
            </button>
          </>
        )}
        {selectedNodeIds.size > 0 && !selectedLine && (
          <button
            type="button"
            onClick={handleDeleteSelectedNodes}
            className="btn-secondary text-sm flex items-center gap-1.5 text-red-600"
          >
            <Trash2 className="w-4 h-4" /> Delete {selectedNodeIds.size > 1 ? `${selectedNodeIds.size} Nodes` : 'Node'}
          </button>
        )}
        {selectedNodeId && !selectedLine && selectedNodeIds.size === 1 && (
          <button
            type="button"
            data-chart-control
            onClick={() => {
              const emp = allEmployees.find((e) => e.id === selectedNodeId);
              if (emp) setDrillEmployee(emp);
            }}
            className="btn-secondary text-sm flex items-center gap-1.5 text-primary-700 border-primary-300"
            title="Open sub-org-chart for this person (or double-click any box)"
          >
            <Network className="w-4 h-4" /> Drill Down
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveChart}
          disabled={saving || loading}
          className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Save chart changes"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={historyVersion < 0 || !historyRef.current.canUndo()}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" /> Undo
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={historyVersion < 0 || !historyRef.current.canRedo()}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" /> Redo
        </button>
        <button
          type="button"
          onClick={() => toggleConnectionMarkers(false)}
          disabled={!showConnectionMarkers}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
          title="Hide round circles and arrow markers"
        >
          <EyeOff className="w-4 h-4" /> Hide Connection Markers
        </button>
        <button
          type="button"
          onClick={() => toggleConnectionMarkers(true)}
          disabled={showConnectionMarkers}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
          title="Show round circles and arrow markers"
        >
          <Eye className="w-4 h-4" /> Show Connection Markers
        </button>
        <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setPanMode((value) => !value)}
          className={`btn-secondary text-sm flex items-center gap-1.5 ${panMode ? 'bg-primary-100 ring-2 ring-primary-400' : ''}`}
        >
          {panMode ? <Move className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
          {panMode ? 'Pan On' : 'Select'}
        </button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.1))} className="btn-secondary text-sm px-3">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 w-11 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.1))} className="btn-secondary text-sm px-3">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleFitView} className="btn-secondary text-sm flex items-center gap-1.5">
          <Maximize2 className="w-4 h-4" /> Fit
        </button>
        <button
          type="button"
          onClick={() => setShowMinimap((value) => !value)}
          className={`btn-secondary text-sm px-3 ${showMinimap ? 'bg-gray-50' : ''}`}
          title="Toggle minimap"
        >
          <MapIcon className="w-4 h-4" />
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />
          Snap to grid &amp; align ({GRID_SIZE}px)
        </label>
        <span className="text-xs text-gray-500">
          Drag boxes — pink guides show alignment • Click a line to bend it
        </span>
        {saving && <span className="text-xs text-primary-600">Saving...</span>}
        {autoMsg && <span className="text-xs text-green-600 font-medium">{autoMsg}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3" data-export-exclude>
        <span className="text-xs font-semibold text-gray-700">Line Color</span>
        {DRAW_LINE_COLORS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            onClick={() => handleDrawColorSelect(preset.value)}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${
              activeDrawColor === preset.value ? 'border-gray-900 scale-110' : 'border-white shadow'
            }`}
            style={{ backgroundColor: preset.value }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden="true" />
        <span className="text-xs font-semibold text-gray-700">Line Thickness</span>
        {DRAW_LINE_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            onClick={() => handleDrawWidthSelect(width)}
            className={`min-w-[2rem] px-2 py-1 rounded text-xs font-medium border ${
              activeDrawWidth === width
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {width}px
          </button>
        ))}
        {(selectedLine || selectedSegment) && (
          <span className="text-xs text-gray-500 ml-1">
            Selected: {activeDrawColor} · {activeDrawWidth}px
          </span>
        )}
      </div>

      {showAddLine && (
        <div data-export-exclude>
        <AddLinePanel
          employees={allEmployees}
          connectingFrom={connectFrom}
          onCreate={handleAddLine}
          onCancel={() => setShowAddLine(false)}
        />
        </div>
      )}

      {connectMode && (
        <p className="text-sm text-primary-700 mb-2 p-2 bg-primary-50 rounded-lg" data-export-exclude>
          {connectFrom
            ? `Step 2: Click canvas routing dots in order, then click the target node (${connectWaypoints.length} dots)`
            : `Step 1: Click the source node`}
        </p>
      )}

      {drawLineMode && (
        <p className="text-sm text-primary-700 mb-2 p-2 bg-primary-50 rounded-lg" data-export-exclude>
          {lineDraft
            ? 'Move horizontally or vertically, then right-click or Save to create a breakpoint'
            : 'Click a connection point (top/right/bottom/left) or existing breakpoint to start a trunk or branch'}
        </p>
      )}

      <div data-export-capture>
      <div
        ref={containerRef}
        className={`relative rounded-lg border border-gray-200 overflow-auto ${panMode ? 'cursor-grab' : ''}`}
        style={{ minHeight: 520 }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onContextMenu={handleCanvasContextMenu}
      >
        <div style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'relative' }}>
          <div
            data-chart-export-root
            data-canvas-width={canvasWidth}
            data-canvas-height={canvasHeight}
            style={{
              width: canvasWidth,
              height: canvasHeight,
              position: 'relative',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
        {/* Grid background — hidden from PNG/PDF export */}
        <div
          data-export-hide-grid
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: canvasWidth, height: canvasHeight, zIndex: 0, ...gridBackgroundStyle() }}
        />

        {/* Alignment guides while dragging */}
        {(snapGuides.vertical.length > 0 || snapGuides.horizontal.length > 0) && (
          <svg
            data-export-hide-grid
            className="absolute top-0 left-0 pointer-events-none"
            width={canvasWidth}
            height={canvasHeight}
            style={{ zIndex: 8 }}
          >
            {snapGuides.vertical.map((gx) => (
              <line
                key={`vg-${gx}`}
                x1={gx}
                y1={0}
                x2={gx}
                y2={canvasHeight}
                stroke="#f43f5e"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={0.85}
              />
            ))}
            {snapGuides.horizontal.map((gy) => (
              <line
                key={`hg-${gy}`}
                x1={0}
                y1={gy}
                x2={canvasWidth}
                y2={gy}
                stroke="#f43f5e"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={0.85}
              />
            ))}
          </svg>
        )}

        {/* Visible lines — no pointer events */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={canvasWidth}
          height={canvasHeight}
          style={{ zIndex: 1 }}
        >
          {relationships.map((rel) => {
            const style = getLineStyle(rel);
            const isSelected = selectedLine?.id === rel.id;
            const { d } = getLineGeometry(rel);
            const isShapeConnector = (routingType || (orthogonalLines ? 'orthogonal' : 'straight')) === 'orthogonal';
            const strokeColor = isSelected && isShapeConnector ? '#8ea0b3' : style.color || '#2563eb';
            return (
              <path
                key={rel.id}
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isSelected && isShapeConnector ? Math.max(2, style.width + 0.6) : isSelected ? style.width + 2 : style.width}
                strokeDasharray={style.dash}
                strokeLinejoin="miter"
                strokeLinecap="square"
                opacity={isSelected ? 1 : 0.9}
              />
            );
          })}
          {routingSegments.map((segment) => {
            const pts = getRoutingSegmentPoints(segment);
            if (!pts) return null;
            const isSelected = selectedSegmentId === segment.id;
            const segStyle = getRoutingSegmentStyle(segment);
            return (
              <path
                key={`routing-vis-${segment.id}`}
                d={buildAxisAlignedPath(pts.start, pts.end)}
                fill="none"
                stroke={isSelected ? '#8ea0b3' : segStyle.color}
                strokeWidth={isSelected ? Math.max(segStyle.width + 0.6, 2) : segStyle.width}
                strokeLinecap="square"
                opacity={0.9}
              />
            );
          })}
          {lineDraft && drawLineMode && (
            <path
              d={buildAxisAlignedPath(
                { x: lineDraft.start.x, y: lineDraft.start.y },
                lineDraft.end,
              )}
              fill="none"
              stroke={drawLineColor}
              strokeWidth={drawLineWidth}
              strokeDasharray="5 4"
              strokeLinecap="square"
            />
          )}
        </svg>

        {/* Line handles + click targets */}
        <svg
          className="absolute top-0 left-0"
          width={canvasWidth}
          height={canvasHeight}
          style={{ zIndex: 15, pointerEvents: 'none' }}
        >
          {relationships.map((rel) => {
            const { d, handles, anchors } = getLineGeometry(rel);
            const isSelected = selectedLine?.id === rel.id;
            return (
              <g key={`hit-${rel.id}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLine(rel);
                    setSelectedSegmentId(null);
                    setSelectedBreakpointId(null);
                    setSelectedBox(null);
                    setSelectedWaypoint(null);
                    syncDrawStyleFromLine(rel);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    insertWaypoint(rel, getCanvasPoint(e));
                  }}
                />
                {isSelected && showConnectionMarkers && (
                  <>
                    <circle
                      cx={anchors.x1}
                      cy={anchors.y1}
                      r={8}
                      fill="#fff"
                      stroke="#16a34a"
                      strokeWidth={3}
                      style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                      onMouseDown={(e) => handleReconnectMouseDown(e, rel, 'source')}
                    />
                    <circle
                      cx={anchors.x2}
                      cy={anchors.y2}
                      r={8}
                      fill="#fff"
                      stroke="#16a34a"
                      strokeWidth={3}
                      style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                      onMouseDown={(e) => handleReconnectMouseDown(e, rel, 'target')}
                    />
                  </>
                )}
                {isSelected && showConnectionMarkers && handles.map((h, i) => (
                  <circle
                    key={`${rel.id}-handle-${i}`}
                    cx={h.x}
                    cy={h.y}
                    r={h.kind === 'routing' ? 7 : 5}
                    fill="#fff"
                    stroke={h.kind === 'routing' ? '#2563eb' : '#8ea0b3'}
                    strokeWidth={h.kind === 'routing' && selectedWaypoint?.relId === rel.id && selectedWaypoint?.index === h.index ? 3 : 2}
                    style={{
                      pointerEvents: 'all',
                      cursor: h.cursor || 'move',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (h.kind === 'routing') setSelectedWaypoint({ relId: rel.id, index: h.index });
                    }}
                    onMouseDown={(e) => handleWaypointMouseDown(e, rel, h)}
                  />
                ))}
              </g>
            );
          })}
          {routingSegments.map((segment) => {
            const pts = getRoutingSegmentPoints(segment);
            if (!pts) return null;
            const isSelected = selectedSegmentId === segment.id;
            return (
              <g key={`routing-hit-${segment.id}`}>
                <path
                  d={buildAxisAlignedPath(pts.start, pts.end)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSegmentId(segment.id);
                    setSelectedBreakpointId(null);
                    setSelectedLine(null);
                    setSelectedBox(null);
                    syncDrawStyleFromSegment(segment);
                  }}
                />
                {showConnectionMarkers && isSelected && (
                  <circle
                    cx={pts.end.x}
                    cy={pts.end.y}
                    r={6}
                    fill="#2563eb"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}
          {routingBreakpoints.map((bp) => (
            <circle
              key={`bp-${bp.id}`}
              cx={bp.x}
              cy={bp.y}
              r={showConnectionMarkers ? 6 : 10}
              fill={showConnectionMarkers
                ? (selectedBreakpointId === bp.id ? '#2563eb' : '#fff')
                : 'transparent'}
              stroke={showConnectionMarkers
                ? (selectedBreakpointId === bp.id ? '#2563eb' : '#8ea0b3')
                : 'transparent'}
              strokeWidth={showConnectionMarkers ? 2 : 0}
              style={{ pointerEvents: 'all', cursor: drawLineMode ? 'crosshair' : 'move' }}
              onMouseDown={(e) => handleBreakpointMouseDown(e, bp)}
            />
          ))}
        </svg>

        {connectionDraft && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={canvasWidth}
            height={canvasHeight}
            style={{ zIndex: 18 }}
          >
            <path
              d={draftPath}
              fill="none"
              stroke={connectionDraft.mode === 'reconnect' ? '#8ea0b3' : drawLineColor}
              strokeWidth={connectionDraft.mode === 'reconnect' ? 1.8 : drawLineWidth}
              strokeDasharray={connectionDraft.targetId ? undefined : '5 4'}
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            {showConnectionMarkers && (
              <>
                <circle cx={connectionDraft.start.x} cy={connectionDraft.start.y} r={4} fill="#fff" stroke="#8ea0b3" strokeWidth={2} />
                <circle
                  cx={connectionDraft.end.x}
                  cy={connectionDraft.end.y}
                  r={connectionDraft.targetId ? 5 : 4}
                  fill="#fff"
                  stroke={connectionDraft.targetId ? '#8ea0b3' : '#b6c0ca'}
                  strokeWidth={2}
                />
              </>
            )}
          </svg>
        )}

        {connectMode && connectFrom && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={canvasWidth}
            height={canvasHeight}
            style={{ zIndex: 18 }}
          >
            {connectDraftPath && (
              <path
                d={connectDraftPath}
                fill="none"
                stroke="#8ea0b3"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            )}
            {showConnectionMarkers && connectDraftStart && (
              <circle cx={connectDraftStart.x} cy={connectDraftStart.y} r={4} fill="#fff" stroke="#8ea0b3" strokeWidth={2} />
            )}
            {showConnectionMarkers && connectWaypoints.map((point, index) => (
              <g key={`draft-dot-${index}`}>
                <circle cx={point.x} cy={point.y} r={5} fill="#fff" stroke="#8ea0b3" strokeWidth={2} />
              </g>
            ))}
          </svg>
        )}

        {/* Employee boxes */}
        <div
          style={{ width: canvasWidth, height: canvasHeight, position: 'relative', zIndex: 10, pointerEvents: 'none' }}
        >
          {employees.map((emp) => {
            const pos = positions[emp.id] || { x: 60, y: 60 };
            const childCount = (childrenMap.get(emp.id) || []).length;
            const isCollapsed = collapsed.has(emp.id);
            const isConnectFrom = connectFrom === emp.id;
            const isHighlighted = connectMode && (isConnectFrom || !connectFrom);
            const isSelectedNode = selectedNodeId === emp.id;
            const showAnchors = hoveredNodeId === emp.id || isSelectedNode || drawLineMode
              || connectionDraft?.fromId === emp.id || connectionDraft?.targetId === emp.id;

            return (
              <div
                key={emp.id}
                className={`absolute ${draggingBox?.empId === emp.id ? 'z-30' : 'z-20'}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  height: CARD_H,
                  pointerEvents: 'auto',
                }}
                onMouseDown={(e) => handleBoxMouseDown(e, emp.id)}
                onClick={(e) => handleBoxClick(emp, e)}
                onDoubleClick={(e) => {
                  // automatic drill-down: double-click opens sub-chart
                  if (e.target.closest('[data-chart-control]')) return;
                  if (dragMovedRef.current) return;
                  e.stopPropagation();
                  setDrillEmployee(emp);
                }}
                onMouseEnter={() => setHoveredNodeId(emp.id)}
                onMouseLeave={() => setHoveredNodeId((id) => (id === emp.id ? null : id))}
              >
                {isSelectedNode && (
                  <div data-export-exclude className="pointer-events-none absolute -inset-2 z-10 rounded-xl border-2 border-primary-500">
                    {[
                      'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
                      'right-0 top-0 translate-x-1/2 -translate-y-1/2',
                      'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
                      'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
                    ].map((className) => (
                      <span
                        key={className}
                        className={`absolute h-2.5 w-2.5 rounded-sm border border-primary-600 bg-white ${className}`}
                      />
                    ))}
                  </div>
                )}

                {childCount > 0 && (
                  <button
                    type="button"
                    data-chart-control
                    data-export-exclude
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(emp.id); }}
                    className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow"
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="button"
                  data-chart-control
                  data-export-exclude
                  onClick={(e) => { e.stopPropagation(); setSelectedBox(emp); setSelectedLine(null); }}
                  className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow"
                  title="Font & colors"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  data-chart-control
                  data-export-exclude
                  onClick={(e) => { e.stopPropagation(); handleAddReport(emp); }}
                  className="absolute top-1/2 -right-3 z-20 w-7 h-7 -translate-y-1/2 rounded-full bg-white text-gray-700 border border-gray-200 flex items-center justify-center shadow hover:bg-cyan-50 hover:text-cyan-700"
                  title="Add employee"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Drill-down button — appears on hover; double-click also works */}
                <button
                  type="button"
                  data-chart-control
                  data-export-exclude
                  onClick={(e) => { e.stopPropagation(); setDrillEmployee(emp); }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center shadow hover:bg-primary-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Drill-down: view sub-org-chart (or double-click)"
                  style={{ opacity: hoveredNodeId === emp.id ? 1 : 0, transition: 'opacity 0.15s' }}
                >
                  <Network className="w-3.5 h-3.5" />
                </button>

                {showAnchors && ['top', 'right', 'bottom', 'left'].map((anchor) => (
                  <button
                    key={anchor}
                    type="button"
                    data-chart-control
                    data-export-exclude
                    onMouseDown={(e) => handleAnchorMouseDown(e, emp, anchor)}
                    className={`absolute z-30 rounded-full ${
                      showConnectionMarkers
                        ? `h-3.5 w-3.5 border-2 border-white shadow ${
                          connectionDraft?.targetId === emp.id && connectionDraft?.targetAnchor === anchor
                            ? 'bg-green-500 ring-4 ring-green-200'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`
                        : 'h-6 w-6 opacity-0'
                    } ${anchorClassName(anchor)}`}
                    title={`Draw connector from ${anchor}`}
                  />
                ))}

                <div
                  className={`rounded-lg select-none h-full w-full overflow-hidden flex items-center justify-center ${
                    isConnectFrom ? 'ring-4 ring-green-400' : ''
                  } ${connectMode && !connectFrom ? 'ring-2 ring-primary-300' : ''} ${
                    draggingBox?.empId === emp.id ? 'cursor-grabbing opacity-90' : 'cursor-grab'
                  }`}
                >
                  <EmployeeCard
                    employee={emp}
                    compact
                    variant={cardVariant}
                    customStyle={boxStyles[emp.id]}
                    level={levelMap.get(emp.id) || 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      </div>
      </div>
      </div>

      {/* Lines list — always works for edit */}
      {relationships.length > 0 && (
        <div className="card mt-4" data-export-exclude>
          <h4 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> All connection lines — click Edit
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {relationships.map((rel) => {
              const style = getLineStyle(rel);
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-1 rounded" style={{ backgroundColor: style.color }} />
                    <span>{rel.manager_name} → {rel.employee_name}</span>
                    <span className="text-xs text-gray-400 capitalize">{rel.relationship_type?.replace('_', ' ')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedLine(rel)}
                    className="text-primary-600 hover:text-primary-800 text-xs font-medium px-2 py-1"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {relationships.length === 0 && allEmployees.length > 1 && (
        <p className="text-sm text-amber-700 mt-3 p-3 bg-amber-50 rounded-lg">
          No lines yet. Use <strong>Add Line</strong> or <strong>Connect on Chart</strong> to link people (e.g. Prabhu → Maruti).
        </p>
      )}

      {selectedLine && (
        <LineEditModal
          line={selectedLine}
          lineStyle={selectedLineStyle}
          onSave={async (style) => {
            if (style.relationship_type && style.relationship_type !== selectedLine.relationship_type) {
              await api.relationships.update(selectedLine.id, { relationship_type: style.relationship_type });
            }
            await api.chartLayout.saveLineStyle(selectedLine.id, {
              color: style.color,
              width: style.width,
              line_type: style.line_type,
            });
            setLineEdits((prev) => ({
              ...prev,
              [selectedLine.id]: {
                ...prev[selectedLine.id],
                color: style.color,
                width: style.width,
                line_type: style.line_type,
              },
            }));
            loadCanvas();
          }}
          onDelete={handleDeleteLine}
          onClose={() => setSelectedLine(null)}
        />
      )}

      {selectedBox && (
        <BoxStyleModal
          employee={selectedBox}
          style={boxStyles[selectedBox.id]}
          onSave={async (form) => {
            await api.chartLayout.saveBoxStyle(selectedBox.id, form);
            setBoxStyles((prev) => ({ ...prev, [selectedBox.id]: form }));
          }}
          onReset={async () => {
            await api.chartLayout.resetBoxStyle(selectedBox.id);
            setBoxStyles((prev) => {
              const next = { ...prev };
              delete next[selectedBox.id];
              return next;
            });
            setSelectedBox(null);
          }}
          onClose={() => setSelectedBox(null)}
        />
      )}

      {/* ── Sub-Org-Chart drill-down modal ── */}
      {drillEmployee && (
        <SubOrgChartModal
          rootEmployee={drillEmployee}
          onClose={() => setDrillEmployee(null)}
        />
      )}
    </div>
  );
}

function buildAxisAlignedPath(start, end) {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function anchorClassName(anchor) {
  if (anchor === 'top') return 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-crosshair';
  if (anchor === 'right') return 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-crosshair';
  if (anchor === 'bottom') return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-crosshair';
  return 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair';
}

function getDraftPath(start, end, routingType = 'orthogonal') {
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;
  const midX = x1 + (x2 - x1) / 2;
  const midY = y1 + (y2 - y1) / 2;

  if (routingType === 'straight') return `M ${x1} ${y1} L ${x2} ${y2}`;
  if (routingType === 'curved') return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  if (routingType === 'curvedConnector') return `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.7} ${y1}, ${x2 - (x2 - x1) * 0.7} ${y2}, ${x2} ${y2}`;
  if (routingType === 'polygon') return `M ${x1} ${y1} L ${midX} ${midY - 28} L ${midX} ${midY + 28} L ${x2} ${y2}`;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

function pathFromPoints(points) {
  if (!points.length) return '';
  return points.reduce((d, point, index) => (
    index === 0 ? `M ${point.x} ${point.y}` : `${d} L ${point.x} ${point.y}`
  ), '');
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}
