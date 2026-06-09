/**
 * SharedOrgChart.jsx
 *
 * PUBLIC read-only interactive viewer for a shared Traditional Org Chart.
 * No login required. No editing. No deleting. View-only.
 *
 * Features:
 *  - Expand / collapse nodes (single-level, same rule as editor)
 *  - Zoom in / out
 *  - Pan (drag canvas or use pan button)
 *  - Search employees (highlights match)
 *  - Fit to screen
 *  - Full screen
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronDown, ChevronRight, Search, X,
  GitBranch, Move, MousePointer2,
} from 'lucide-react';
import { API_BASE } from '../api/client';

// ─── Constants (must match TraditionalOrgChart.jsx exactly) ──────────────────
const CARD_W    = 176;
const CARD_H    = 80;
const H_GAP     = 36;
const V_GAP     = 60;
const DEFAULT_LINE_COLOR     = '#94a3b8';
const DEFAULT_LINE_THICKNESS = 2;

const DEPT_COLORS = [
  '#2563eb','#059669','#d97706','#7c3aed',
  '#dc2626','#0891b2','#c026d3','#65a30d',
];
function deptColor(dept) {
  if (!dept) return DEPT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

// Determine readable text color against a background
function textColorFor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#1e293b' : '#ffffff';
  } catch { return '#ffffff'; }
}

// ─── Layout helpers (same pure functions as TraditionalOrgChart) ──────────────
function subtreeWidth(node, expandedSet) {
  if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return CARD_W;
  const cw = node.children.map((c) => subtreeWidth(c, expandedSet));
  return Math.max(CARD_W, cw.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1));
}

function measureCanvas(roots, expandedSet) {
  if (roots.length === 0) return { width: 0, height: 0 };
  const rw  = roots.map((r) => subtreeWidth(r, expandedSet));
  const totalW = rw.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
  function h(node) {
    if (!expandedSet.has(node.id) || !node.children || !node.children.length) return CARD_H;
    return CARD_H + V_GAP + Math.max(...node.children.map(h));
  }
  return { width: Math.max(totalW, 400), height: Math.max(Math.max(...roots.map(h)) + 60, 300) };
}

function renderTree(node, x, y, expandedSet, searchId, onToggle, nodeColors, cards, lines) {
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isMatch     = searchId && node.id === searchId;

  cards.push(
    <ViewerCard
      key={node.id}
      node={node}
      x={x - CARD_W / 2}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      isMatch={isMatch}
      onToggle={onToggle}
      nodeColor={nodeColors ? (nodeColors[node.id] || node.node_color || null) : null}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  const cw   = node.children.map((c) => subtreeWidth(c, expandedSet));
  const tot  = cw.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1);
  const cy   = y + CARD_H + V_GAP;
  const cx   = [];
  let rx = x - tot / 2;
  for (let i = 0; i < node.children.length; i++) { cx.push(rx + cw[i] / 2); rx += cw[i] + H_GAP; }

  const pbx = x, pby = y + CARD_H;
  if (node.children.length === 1) {
    lines.push({ key: `v-${node.id}-0`, x1: pbx, y1: pby, x2: pbx, y2: cy });
  } else {
    const ey = pby + V_GAP / 2;
    lines.push({ key: `stub-${node.id}`, x1: pbx, y1: pby, x2: pbx, y2: ey });
    lines.push({ key: `hbar-${node.id}`, x1: cx[0], y1: ey, x2: cx[cx.length - 1], y2: ey });
    for (let i = 0; i < cx.length; i++) lines.push({ key: `drop-${node.id}-${i}`, x1: cx[i], y1: ey, x2: cx[i], y2: cy });
  }
  for (let i = 0; i < node.children.length; i++) {
    renderTree(node.children[i], cx[i], cy, expandedSet, searchId, onToggle, nodeColors, cards, lines);
  }
}

// ─── Single-level toggle helpers ─────────────────────────────────────────────
function findNode(id, list) {
  for (const n of list) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(id, n.children); if (f) return f; }
  }
  return null;
}
function allDescendants(node) {
  const ids = [];
  function c(n) { for (const ch of (n.children||[])) { ids.push(ch.id); c(ch); } }
  c(node);
  return ids;
}
function buildDefaultExpanded(roots) {
  const s = new Set(); for (const r of roots) s.add(r.id); return s;
}

// ─── Viewer card (no delete button, no edit; F1: custom node color) ──────────
function ViewerCard({ node, x, y, isExpanded, hasChildren, isMatch, onToggle, nodeColor }) {
  const isColorized = !!nodeColor;
  const bgColor     = nodeColor || '#ffffff';
  const accent      = isColorized ? nodeColor : deptColor(node.department);
  const textColor   = isColorized ? textColorFor(bgColor) : '#1e3a5f';
  const subColor    = isColorized ? textColorFor(bgColor) + 'cc' : '#475569';
  const deptClr     = isColorized ? textColorFor(bgColor) + 'dd' : accent;

  return (
    <div className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H, zIndex: 10 }}>
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand one level'}
          style={{ zIndex: 20 }}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}
      <div
        className="w-full h-full rounded-lg overflow-hidden flex"
        style={{
          border: isMatch ? '2px solid #f59e0b' : '1px solid #e2e8f0',
          background: isMatch ? '#fffbeb' : bgColor,
          boxShadow: isMatch
            ? '0 0 0 3px rgba(245,158,11,0.3), 0 4px 6px -1px rgba(0,0,0,0.1)'
            : '0 4px 6px -1px rgba(0,0,0,0.08)',
        }}
      >
        {!isColorized && <div style={{ width: 5, flexShrink: 0, background: accent }} />}
        <div className="flex-1 px-2.5 py-2 min-w-0">
          <p className="font-bold text-sm leading-tight truncate" style={{ color: textColor }} title={node.name}>
            {node.name}
          </p>
          {node.designation && (
            <p className="text-xs truncate mt-0.5" style={{ color: subColor }} title={node.designation}>
              {node.designation}
            </p>
          )}
          {node.department && (
            <p className="text-xs truncate mt-0.5" style={{ color: deptClr, fontWeight: 500 }} title={node.department}>
              {node.department}
            </p>
          )}
          <p className="text-xs truncate mt-0.5" style={{ color: isColorized ? textColorFor(bgColor) + '99' : '#94a3b8' }}>
            {node.employee_id}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main viewer canvas (F1+F2: nodeColors, lineColor, lineThickness) ────────
function ViewerCanvas({ roots, expandedSet, searchId, onToggle, zoom, pan, onPanStart, isPanMode, nodeColors, lineColor, lineThickness }) {
  const cards = [], lines = [];
  const lc = lineColor || DEFAULT_LINE_COLOR;
  const lt = lineThickness || DEFAULT_LINE_THICKNESS;

  if (roots.length > 0) {
    const rw = roots.map((r) => subtreeWidth(r, expandedSet));
    const tot = rw.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
    let rx = -tot / 2;
    for (let i = 0; i < roots.length; i++) {
      renderTree(roots[i], rx + rw[i] / 2, 0, expandedSet, searchId, onToggle, nodeColors, cards, lines);
      rx += rw[i] + H_GAP;
    }
  }
  const { width: cw, height: ch } = measureCanvas(roots, expandedSet);
  const pad = 60;
  const totalW = cw + pad * 2, totalH = ch + pad * 2;

  return (
    <div
      className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{
        width: Math.max(totalW * zoom, 100),
        height: Math.max(totalH * zoom, 100),
        transform: `translate(${pan.x}px, ${pan.y}px)`,
      }}
      onMouseDown={onPanStart}
    >
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: totalW, height: totalH, position: 'relative' }}>
        <svg className="absolute top-0 left-0 pointer-events-none" width={totalW} height={totalH} style={{ zIndex: 1 }}>
          {lines.map((l) => (
            <line key={l.key}
              x1={l.x1 + cw / 2 + pad} y1={l.y1 + pad}
              x2={l.x2 + cw / 2 + pad} y2={l.y2 + pad}
              stroke={lc} strokeWidth={lt} strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute" style={{ left: cw / 2 + pad, top: pad, width: 0, height: 0 }}>
          {cards}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SharedOrgChart() {
  const { id } = useParams();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [zoom,        setZoom]        = useState(1);
  const [pan,         setPan]         = useState({ x: 0, y: 0 });
  const [isPanMode,   setIsPanMode]   = useState(false);
  const [isFullscreen,setIsFullscreen]= useState(false);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [searchId,    setSearchId]    = useState(null);
  const [showSearch,  setShowSearch]  = useState(false);

  const containerRef = useRef(null);
  const panRef       = useRef(null);

  // ── Load shared chart (public, no auth) ──
  useEffect(() => {
    fetch(`${API_BASE}/trad-org-chart/share/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Chart not found or link has expired.');
        return r.json();
      })
      .then((d) => {
        setData(d);
        setExpandedSet(buildDefaultExpanded(d.roots || []));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Single-level toggle (same logic as editor) ──
  const handleToggle = useCallback((nodeId) => {
    if (!data) return;
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
        const node = findNode(nodeId, data.roots || []);
        if (node) for (const d of allDescendants(node)) next.delete(d);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, [data]);

  // ── Zoom ──
  const zoomIn  = () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)));

  // ── Fit to screen ──
  const fitToScreen = useCallback(() => {
    if (!data || !containerRef.current) return;
    const { width: cw, height: ch } = measureCanvas(data.roots || [], expandedSet);
    const pad = 60;
    const el  = containerRef.current;
    const fz  = Math.min(0.99, (el.clientWidth - 40) / (cw + pad * 2), (el.clientHeight - 40) / (ch + pad * 2));
    setZoom(Math.max(0.3, fz));
    setPan({ x: 0, y: 0 });
  }, [data, expandedSet]);

  // ── Pan ──
  const handlePanStart = useCallback((e) => {
    if (!isPanMode) return;
    e.preventDefault();
    panRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    const onMove = (ev) => {
      if (!panRef.current) return;
      setPan({ x: ev.clientX - panRef.current.x, y: ev.clientY - panRef.current.y });
    };
    const onUp = () => { panRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isPanMode, pan]);

  // ── Wheel zoom ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.max(0.3, Math.min(2.5, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Fullscreen ──
  const toggleFullscreen = () => {
    const el = containerRef.current?.closest('[data-viewer-root]');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Search ──
  const allEmployees = data
    ? (() => { const r = []; function c(n) { r.push(n); (n.children||[]).forEach(c); } (data.roots||[]).forEach(c); return r; })()
    : [];

  const filteredSearch = searchTerm.trim()
    ? allEmployees.filter((e) =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.designation||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.department||'').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleSearchSelect = (emp) => {
    setSearchId(emp.id);
    setSearchTerm(emp.name);
    setShowSearch(false);
    // Expand path to make the node visible
    if (!data) return;
    function pathTo(id, list, path = []) {
      for (const n of list) {
        if (n.id === id) return [...path, n.id];
        const found = pathTo(id, n.children || [], [...path, n.id]);
        if (found) return found;
      }
      return null;
    }
    const path = pathTo(emp.id, data.roots || []);
    if (path) {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        // Add only each node in path one at a time (single-level rule: we expand
        // each ancestor so the target becomes visible)
        for (const pid of path.slice(0, -1)) next.add(pid);
        return next;
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <p className="text-gray-500 text-sm">Loading chart…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-8">
      <GitBranch className="w-16 h-16 text-gray-300" />
      <h1 className="text-2xl font-bold text-gray-700">Chart not found</h1>
      <p className="text-gray-400 text-center max-w-sm">{error}</p>
    </div>
  );

  const {
    roots = [],
    title = 'Org Chart',
    employeeCount = 0,
    nodeColors = {},
    lineColor = DEFAULT_LINE_COLOR,
    lineThickness = DEFAULT_LINE_THICKNESS,
  } = data;

  return (
    <div data-viewer-root className="min-h-screen bg-gray-100 flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 z-20 shadow-sm">
        <GitBranch className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-base leading-tight truncate">{title}</h1>
          <p className="text-xs text-gray-400">{employeeCount} employees · Read-only view</p>
        </div>

        {/* Search */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowSearch((v) => !v); setSearchTerm(''); setSearchId(null); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Search employee"
          >
            <Search className="w-4 h-4" />
          </button>
          {showSearch && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30">
              <div className="relative p-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, designation…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {filteredSearch.length > 0 && (
                <ul className="max-h-48 overflow-y-auto border-t border-gray-100 divide-y divide-gray-50">
                  {filteredSearch.map((emp) => (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => handleSearchSelect(emp)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium text-gray-800">{emp.name}</span>
                        {emp.designation && <span className="text-gray-400 ml-1 text-xs">— {emp.designation}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchTerm && filteredSearch.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">No results</p>
              )}
            </div>
          )}
        </div>

        {/* Zoom */}
        <button type="button" onClick={zoomOut} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs text-gray-500 w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>

        {/* Fit */}
        <button type="button" onClick={fitToScreen} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Fit to screen">
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Pan toggle */}
        <button
          type="button"
          onClick={() => setIsPanMode((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${isPanMode ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
          title={isPanMode ? 'Pan mode ON — click to switch to select' : 'Pan mode OFF — click to enable pan'}
        >
          {isPanMode ? <Move className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Chart area ── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-50"
        style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        {roots.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
            <GitBranch className="w-16 h-16 opacity-20" />
            <p className="text-base">This chart has no employees yet.</p>
          </div>
        ) : (
          <ViewerCanvas
            roots={roots}
            expandedSet={expandedSet}
            searchId={searchId}
            onToggle={handleToggle}
            zoom={zoom}
            pan={pan}
            onPanStart={handlePanStart}
            isPanMode={isPanMode}
            nodeColors={nodeColors}
            lineColor={lineColor}
            lineThickness={lineThickness}
          />
        )}

        {/* Hint bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-gray-500 shadow border border-gray-200 pointer-events-none select-none">
          Click ▶ to expand · ▾ to collapse · Ctrl+scroll to zoom · Drag in Pan mode
        </div>
      </div>
    </div>
  );
}
