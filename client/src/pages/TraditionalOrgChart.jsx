/**
 * TraditionalOrgChart.jsx
 *
 * EXISTING (COMPLETELY UNCHANGED):
 *   - Hierarchy generation logic
 *   - Connector line rendering (SVG, elbow style)
 *   - Save button + server persistence
 *   - Undo / Redo
 *   - Employee creation form and reporting relationship logic
 *   - Database / API calls
 *   - Expand/collapse mechanism (expandedSet)
 *   - Export PNG / PDF (orgChartExport.js)
 *   - Export Web Chart (ExportWebChartModal)
 *   - Import From Excel (ImportExcelModal)
 *
 * NEW FEATURES ADDED (additive only):
 *   F1. Node Color Customization — per-node color picker, saved in DB
 *   F2. Line Color & Thickness — global connector styling, saved in DB
 *   F3. Export Full Org Chart — renamed/clarified existing PDF/PNG exports
 *   F4. Export Team — subtree-only PDF/PNG export via employee selector
 *   F5. Share Full Org Chart — renamed/clarified existing share
 *   F6. Share Team Link — subtree-only shareable link
 *   F7. Edit Chart Title — inline editable title, saved in DB
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  UserPlus, Trash2, ChevronDown, ChevronRight,
  GitBranch, Save, Undo2, Redo2, Image, FileText, Loader2, Globe, FileSpreadsheet,
  Pencil, Check, X, Palette, Minus, Users,
} from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, LoadingSpinner } from '../components/common';
import { exportChartAsImage, exportChartAsPdf } from '../utils/orgChartExport';
import ExportWebChartModal from '../components/ExportWebChartModal';
import ImportExcelModal from '../components/ImportExcelModal';

// ─── Layout constants (UNCHANGED) ────────────────────────────────────────────
const CARD_W    = 176;
const CARD_H    = 80;
const H_GAP     = 36;
const V_GAP     = 60;

// ─── F1: Professional node color palette ─────────────────────────────────────
const NODE_COLORS = [
  { name: 'Blue',   value: '#2563eb' },
  { name: 'Green',  value: '#059669' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Orange', value: '#d97706' },
  { name: 'Red',    value: '#dc2626' },
  { name: 'Gray',   value: '#475569' },
  { name: 'Teal',   value: '#0891b2' },
  { name: 'Pink',   value: '#c026d3' },
];
const DEFAULT_NODE_COLOR = '#2563eb';

// ─── F2: Line thickness options ───────────────────────────────────────────────
const LINE_THICKNESSES = [1, 2, 3, 4, 5, 6, 8, 10];
const DEFAULT_LINE_COLOR = '#94a3b8';
const DEFAULT_LINE_THICKNESS = 2;

// ─── Department accent colours (UNCHANGED — used as fallback when no custom color) ──
const DEPT_COLORS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#c026d3', '#65a30d',
];
function deptColor(dept) {
  if (!dept) return DEPT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

// ─── Measure subtree width (UNCHANGED) ───────────────────────────────────────
function subtreeWidth(node, expandedSet) {
  const isExpanded = expandedSet.has(node.id);
  if (!isExpanded || !node.children || node.children.length === 0) return CARD_W;
  const childWidths = node.children.map((c) => subtreeWidth(c, expandedSet));
  const total = childWidths.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1);
  return Math.max(CARD_W, total);
}

// ─── Recursive renderer (UNCHANGED connector logic, passes lineColor/lineThickness) ─
function renderTree(node, x, y, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lineColor, lineThickness, selectedToolbarColor, cards, lines) {
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  cards.push(
    <NodeCard
      key={node.id}
      node={node}
      x={x - CARD_W / 2}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      onToggle={onToggle}
      onDelete={onDelete}
      onColorChange={onColorChange}
      nodeColor={nodeColors[node.id] || node.node_color || null}
      selectedToolbarColor={selectedToolbarColor}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  const childWidths  = node.children.map((c) => subtreeWidth(c, expandedSet));
  const totalChildW  = childWidths.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1);
  const childY       = y + CARD_H + V_GAP;
  const childCentres = [];
  let cx = x - totalChildW / 2;
  for (let i = 0; i < node.children.length; i++) {
    childCentres.push(cx + childWidths[i] / 2);
    cx += childWidths[i] + H_GAP;
  }

  const parentBottomX = x;
  const parentBottomY = y + CARD_H;

  if (node.children.length === 1) {
    lines.push({ key: `v-${node.id}-0`, x1: parentBottomX, y1: parentBottomY, x2: parentBottomX, y2: childY });
  } else {
    const elbowY = parentBottomY + V_GAP / 2;
    lines.push({ key: `stub-${node.id}`, x1: parentBottomX, y1: parentBottomY, x2: parentBottomX, y2: elbowY });
    lines.push({ key: `hbar-${node.id}`, x1: childCentres[0], y1: elbowY, x2: childCentres[childCentres.length - 1], y2: elbowY });
    for (let i = 0; i < node.children.length; i++) {
      lines.push({ key: `drop-${node.id}-${i}`, x1: childCentres[i], y1: elbowY, x2: childCentres[i], y2: childY });
    }
  }

  for (let i = 0; i < node.children.length; i++) {
    renderTree(node.children[i], childCentres[i], childY, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lineColor, lineThickness, selectedToolbarColor, cards, lines);
  }
}

// ─── Canvas size (UNCHANGED) ─────────────────────────────────────────────────
function measureCanvas(roots, expandedSet) {
  if (roots.length === 0) return { width: 0, height: 0 };
  const rootWidths = roots.map((r) => subtreeWidth(r, expandedSet));
  const totalW     = rootWidths.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
  function treeHeight(node) {
    if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return CARD_H;
    const childMax = Math.max(...node.children.map(treeHeight));
    return CARD_H + V_GAP + childMax;
  }
  const totalH = Math.max(...roots.map(treeHeight));
  return { width: Math.max(totalW, 400), height: Math.max(totalH + 60, 300) };
}

// ─── F1: Node color picker popup ─────────────────────────────────────────────
// (kept for the toolbar inline palette — no longer used inside NodeCard)

// ─── Node card — CORRECTION 1: always white background, color only on left accent strip ──
function NodeCard({ node, x, y, isExpanded, hasChildren, onToggle, onDelete, onColorChange, nodeColor, selectedToolbarColor }) {
  // accent = custom color if set, otherwise dept-based color (UNCHANGED fallback)
  const accentColor = nodeColor || deptColor(node.department);

  return (
    <div
      className="absolute"
      style={{ left: x, top: y, width: CARD_W, height: CARD_H, zIndex: 10 }}
    >
      {/* Expand/collapse button (UNCHANGED) */}
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand one level'}
          style={{ zIndex: 20 }}
          data-export-exclude
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Card — CORRECTION 1: background always white, border always same */}
      <div
        className="w-full h-full rounded-lg overflow-hidden flex shadow-md"
        style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}
      >
        {/* CORRECTION 1: Left colour strip — always rendered, uses nodeColor if set else deptColor */}
        <div
          style={{ width: 5, flexShrink: 0, background: accentColor }}
          title={nodeColor ? `Node color: ${nodeColor}` : undefined}
        />

        {/* Card body — text colors UNCHANGED (dark blue name, gray designation, dept color) */}
        <div className="flex-1 px-2.5 py-2 min-w-0 relative">
          <p className="font-bold text-sm leading-tight truncate" style={{ color: '#1e3a5f' }} title={node.name}>
            {node.name}
          </p>
          {node.designation && (
            <p className="text-xs truncate mt-0.5" style={{ color: '#475569' }} title={node.designation}>
              {node.designation}
            </p>
          )}
          {node.department && (
            <p className="text-xs truncate mt-0.5" style={{ color: accentColor, fontWeight: 500 }} title={node.department}>
              {node.department}
            </p>
          )}
          <p className="text-xs truncate mt-0.5" style={{ color: '#94a3b8' }}>
            {node.employee_id}
          </p>

          {/* CORRECTION 2: No per-node popup. Click applies the toolbar-selected color directly. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onColorChange(node.id, selectedToolbarColor || null); }}
            className="absolute top-1 right-6 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
            title={selectedToolbarColor ? `Apply ${selectedToolbarColor} to this node` : 'Click a color in the toolbar first, then click here'}
            style={{ color: '#94a3b8' }}
            data-export-exclude
          >
            <Palette className="w-3 h-3" />
          </button>

          {/* Delete button (UNCHANGED) */}
          <button
            type="button"
            onClick={() => onDelete(node.id, node.name)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-red-100"
            title="Delete employee"
            style={{ color: '#ef4444' }}
            data-export-exclude
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrgTreeCanvas (UNCHANGED logic; F1+F2: passes colors down) ──────────────
function OrgTreeCanvas({ roots, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lineColor, lineThickness, selectedToolbarColor }) {
  const cards = [];
  const lines = [];
  const lc = lineColor || DEFAULT_LINE_COLOR;
  const lt = lineThickness || DEFAULT_LINE_THICKNESS;

  if (roots.length > 0) {
    const rootWidths = roots.map((r) => subtreeWidth(r, expandedSet));
    const totalW     = rootWidths.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
    let rx = -totalW / 2;
    for (let i = 0; i < roots.length; i++) {
      const cx = rx + rootWidths[i] / 2;
      renderTree(roots[i], cx, 0, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lc, lt, selectedToolbarColor, cards, lines);
      rx += rootWidths[i] + H_GAP;
    }
  }

  const { width: canvasW, height: canvasH } = measureCanvas(roots, expandedSet);
  const padding = 48;

  return (
    <div className="relative" style={{ width: canvasW + padding * 2, height: canvasH + padding * 2 }}>
      {/* SVG connector lines (UNCHANGED except F2: dynamic stroke color/width) */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={canvasW + padding * 2}
        height={canvasH + padding * 2}
        style={{ zIndex: 1 }}
      >
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1 + canvasW / 2 + padding}
            y1={l.y1 + padding}
            x2={l.x2 + canvasW / 2 + padding}
            y2={l.y2 + padding}
            stroke={lc}
            strokeWidth={lt}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute" style={{ left: canvasW / 2 + padding, top: padding, width: 0, height: 0 }}>
        {cards}
      </div>
    </div>
  );
}

// ─── Add Employee Form (UNCHANGED) ───────────────────────────────────────────
function AddEmployeeForm({ employees, onAdd, adding }) {
  const [form, setForm] = useState({
    employee_id: '',
    name: '',
    designation: '',
    department: '',
    manager_id: '',
  });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onAdd({
      employee_id: form.employee_id.trim() || `TRAD-${Date.now()}`,
      name:        form.name.trim(),
      designation: form.designation.trim() || null,
      department:  form.department.trim()  || null,
      manager_id:  form.manager_id ? Number(form.manager_id) : null,
    });
    setForm({ employee_id: '', name: '', designation: '', department: '', manager_id: '' });
  };
  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary-600" />
        Add Employee
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID <span className="text-gray-400">(optional)</span></label>
          <input type="text" value={form.employee_id} onChange={set('employee_id')} placeholder="e.g. EMP-001" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Prabhu" className="input-field" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
          <input type="text" value={form.designation} onChange={set('designation')} placeholder="e.g. CEO" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
          <input type="text" value={form.department} onChange={set('department')} placeholder="e.g. Engineering" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reports To</label>
          <select value={form.manager_id} onChange={set('manager_id')} className="input-field">
            <option value="">— None (root node) —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}{emp.designation ? ` (${emp.designation})` : ''}</option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" disabled={adding || !form.name.trim()} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <UserPlus className="w-4 h-4" />
        {adding ? 'Adding...' : 'Add Employee'}
      </button>
    </form>
  );
}

// ─── Undo / Redo history helpers (UNCHANGED) ─────────────────────────────────
function createHistory()         { return { past: [], future: [] }; }
function historyPush(hist, snap) { return { past: [...hist.past, snap], future: [] }; }
function historyUndo(hist, current) {
  if (hist.past.length === 0) return { state: current, hist };
  const previous = hist.past[hist.past.length - 1];
  return { state: previous, hist: { past: hist.past.slice(0, -1), future: [current, ...hist.future] } };
}
function historyRedo(hist, current) {
  if (hist.future.length === 0) return { state: current, hist };
  const next = hist.future[0];
  return { state: next, hist: { past: [...hist.past, current], future: hist.future.slice(1) } };
}

// ─── Default / enforce expanded helpers (UNCHANGED) ──────────────────────────
function buildDefaultExpanded(roots) {
  const ids = new Set();
  for (const root of roots) ids.add(root.id);
  return ids;
}
function enforceSingleLevelExpanded(roots, savedIds) {
  const saved = new Set(savedIds);
  const valid = new Set();
  function walk(nodeList, parentExpanded) {
    for (const node of nodeList) {
      const canExpand = parentExpanded && saved.has(node.id);
      if (canExpand) valid.add(node.id);
      if (node.children && node.children.length > 0) walk(node.children, canExpand);
    }
  }
  for (const root of roots) {
    const canExpand = saved.has(root.id);
    if (canExpand) valid.add(root.id);
    if (root.children) walk(root.children, canExpand);
  }
  return valid;
}

// ─── F4/F6: Build subtree rooted at a given employee id ──────────────────────
function buildSubtree(empId, roots) {
  function find(id, list) {
    for (const n of list) {
      if (n.id === id) return n;
      if (n.children) { const f = find(id, n.children); if (f) return f; }
    }
    return null;
  }
  return find(empId, roots);
}

// Count all nodes in a subtree
function countSubtreeNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + countSubtreeNodes(c), 0);
}

// Fully expand a subtree (all descendants)
function buildFullyExpanded(node) {
  const ids = new Set();
  function walk(n) {
    ids.add(n.id);
    (n.children || []).forEach(walk);
  }
  walk(node);
  return ids;
}

// ─── F4: Export Team Modal ────────────────────────────────────────────────────
function ExportTeamModal({ employees, roots, nodeColors, lineColor, lineThickness, chartTitle, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [exporting, setExporting]   = useState(null);
  const exportRef = useRef(null);

  const selectedNode = selectedId ? buildSubtree(Number(selectedId), roots) : null;
  const nodeCount    = selectedNode ? countSubtreeNodes(selectedNode) : 0;

  const handleExport = async (format) => {
    if (!selectedNode || !exportRef.current) return;
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const name = selectedNode.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      if (format === 'png') {
        await exportChartAsImage(exportRef.current, `team-${name}.png`);
      } else {
        await exportChartAsPdf(exportRef.current, `team-${name}.pdf`);
      }
    } catch (err) {
      alert(err.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  // Fully expand entire selected subtree for export
  const subtreeExpanded = selectedNode ? buildFullyExpanded(selectedNode) : new Set();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <Users className="w-5 h-5 text-violet-600 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Export Team</h2>
            <p className="text-xs text-gray-400 mt-0.5">Export a subtree — selected employee and all their direct/indirect reports</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">— Choose employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.designation ? ` — ${emp.designation}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedNode && (
            <div className="bg-violet-50 rounded-xl p-3 border border-violet-100 text-sm text-violet-800">
              <p className="font-semibold">{selectedNode.name}</p>
              <p className="text-xs text-violet-600 mt-0.5">{nodeCount} employee{nodeCount !== 1 ? 's' : ''} in this subtree (all levels fully expanded)</p>
            </div>
          )}

          {selectedNode && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleExport('png')}
                disabled={!!exporting}
                className="flex-1 py-2.5 px-4 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                Export Team PNG
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
                className="flex-1 py-2.5 px-4 bg-violet-700 text-white text-sm font-semibold rounded-xl hover:bg-violet-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Export Team PDF
              </button>
            </div>
          )}

          {/* Hidden render target for export */}
          {selectedNode && (
            <div
              ref={exportRef}
              id="trad-org-chart-export-area"
              style={{
                position: 'fixed',
                left: -9999,
                top: 0,
                background: '#ffffff',
                padding: 32,
                zIndex: -1,
                pointerEvents: 'none',
              }}
            >
              <div className="mb-4 pb-3 border-b border-gray-100">
                <h2 className="text-xl font-bold text-blue-900">{chartTitle} — {selectedNode.name}&apos;s Team</h2>
                <p className="text-xs text-gray-400 mt-0.5">{nodeCount} employees · {new Date().toLocaleDateString()}</p>
              </div>
              <OrgTreeCanvas
                roots={[selectedNode]}
                expandedSet={subtreeExpanded}
                onToggle={() => {}}
                onDelete={() => {}}
                onColorChange={() => {}}
                nodeColors={nodeColors}
                lineColor={lineColor}
                lineThickness={lineThickness}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── F6: Share Team Modal ─────────────────────────────────────────────────────
function ShareTeamModal({ employees, roots, nodeColors, lineColor, lineThickness, chartTitle, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [shareUrl,   setShareUrl]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [error,      setError]      = useState('');

  const selectedNode = selectedId ? buildSubtree(Number(selectedId), roots) : null;
  const nodeCount    = selectedNode ? countSubtreeNodes(selectedNode) : 0;

  const handleGenerate = async () => {
    if (!selectedNode) return;
    setGenerating(true);
    setError('');
    try {
      const subtreeExpanded = buildFullyExpanded(selectedNode);
      const chartData = {
        roots: [selectedNode],
        title: `${chartTitle} — ${selectedNode.name}'s Team`,
        employeeCount: nodeCount,
        expandedIds: Array.from(subtreeExpanded),
        nodeColors,
        lineColor,
        lineThickness,
      };
      const result = await api.tradOrgChart.shareChart(chartData);
      setShareUrl(`${window.location.origin}/shared-chart/${result.id}`);
    } catch (err) {
      setError(err.message || 'Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <Globe className="w-5 h-5 text-teal-600 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Share Team Link</h2>
            <p className="text-xs text-gray-400 mt-0.5">Generate a shareable link for one employee&apos;s reporting hierarchy</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setShareUrl(''); }} className="input-field w-full">
              <option value="">— Choose employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.designation ? ` — ${emp.designation}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedNode && (
            <div className="bg-teal-50 rounded-xl p-3 border border-teal-100 text-sm text-teal-800">
              <p className="font-semibold">{selectedNode.name}</p>
              <p className="text-xs text-teal-600 mt-0.5">{nodeCount} employee{nodeCount !== 1 ? 's' : ''} in this subtree</p>
            </div>
          )}

          {selectedNode && !shareUrl && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2.5 px-4 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Team Link'}
            </button>
          )}

          {shareUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-2">
                <span className="flex-1 text-xs text-teal-700 font-mono truncate select-all">{shareUrl}</span>
                <button type="button" onClick={handleCopy} className="shrink-0 p-1.5 rounded-md hover:bg-gray-200 text-gray-600" title="Copy">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Globe className="w-4 h-4" />}
                </button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-md hover:bg-gray-200 text-gray-600" title="Open">
                  <Globe className="w-4 h-4" />
                </a>
              </div>
              {copied && <p className="text-xs text-green-600 font-medium">Link copied!</p>}
              <p className="text-xs text-gray-400">View-only · Interactive · Expand/collapse supported · Colors preserved</p>
            </div>
          )}

          {error && <p className="text-xs text-red-500 p-2 bg-red-50 rounded-lg">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── F2: Line Style Panel ─────────────────────────────────────────────────────
function LineStylePanel({ lineColor, lineThickness, onColorChange, onThicknessChange }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
        <Minus className="w-3.5 h-3.5" /> Line Style
      </span>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Color:</label>
        <input
          type="color"
          value={lineColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-8 h-6 rounded cursor-pointer border border-gray-200"
          title="Line color"
        />
        <div className="w-12 h-1 rounded-full" style={{ background: lineColor }} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Thickness:</label>
        <div className="flex gap-1">
          {LINE_THICKNESSES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onThicknessChange(t)}
              title={`${t}px`}
              className={`w-7 h-6 rounded text-xs font-medium transition-colors ${
                lineThickness === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CORRECTION 2: Permanently-visible Node Color Toolbar ─────────────────────
// Always visible. Selecting a color here arms the toolbar color.
// Then clicking the 🎨 icon on any node applies the armed color to that node.
// "Reset" clears the node's custom color back to dept-based default.
function NodeColorToolbar({ selectedColor, onSelect }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 shrink-0">
        <Palette className="w-3.5 h-3.5" /> Node Color:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {NODE_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={`${c.name} — click to arm, then click 🎨 on a node`}
            onClick={() => onSelect(selectedColor === c.value ? c.value : c.value)}
            className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 focus:outline-none flex items-center justify-center"
            style={{
              background: c.value,
              borderColor: selectedColor === c.value ? '#1e293b' : 'transparent',
              boxShadow: selectedColor === c.value ? '0 0 0 2px #fff, 0 0 0 3px #1e293b' : 'none',
            }}
          >
            {selectedColor === c.value && (
              <Check className="w-3.5 h-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        {/* Custom color */}
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={selectedColor || '#2563eb'}
            onChange={(e) => onSelect(e.target.value)}
            className="w-7 h-7 rounded-lg cursor-pointer border-2 border-gray-200 hover:border-gray-400"
            title="Custom color"
          />
        </div>
        {/* Reset armed color */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            !selectedColor
              ? 'bg-gray-200 text-gray-700 border-gray-300'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
          }`}
          title="Clear selection (use dept color)"
        >
          Reset
        </button>
      </div>
      <span className="text-xs text-gray-400 italic">
        {selectedColor
          ? `Armed: ${selectedColor} — click 🎨 on a node to apply`
          : 'Select a color, then click 🎨 on any node'}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TraditionalOrgChart() {
  // ── EXISTING state (UNCHANGED) ──
  const [employees,   setEmployees]   = useState([]);
  const [roots,       setRoots]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [exporting,   setExporting]   = useState(null);
  const [msg,         setMsg]         = useState('');
  const [showWebExport,  setShowWebExport]  = useState(false);
  const [showImport,     setShowImport]     = useState(false);
  const [expandedSet,    setExpandedSet]    = useState(() => new Set());
  const [history,        setHistory]        = useState(createHistory());
  const chartAreaRef     = useRef(null);
  const savedStateApplied = useRef(false);

  // ── NEW state: F1 node colors ──
  const [nodeColors,       setNodeColors]       = useState({});       // { empDbId: hexColor }
  const [defaultNodeColor, setDefaultNodeColor] = useState(null);     // color for next new node

  // ── NEW state: F2 line styles ──
  const [lineColor,     setLineColor]     = useState(DEFAULT_LINE_COLOR);
  const [lineThickness, setLineThickness] = useState(DEFAULT_LINE_THICKNESS);

  // ── NEW state: F7 chart title ──
  const [chartTitle,     setChartTitle]     = useState('Traditional Org Chart');
  const [editingTitle,   setEditingTitle]   = useState(false);
  const [titleDraft,     setTitleDraft]     = useState('');

  // ── NEW state: F4 export team modal ──
  const [showExportTeam, setShowExportTeam] = useState(false);

  // ── NEW state: F6 share team modal ──
  const [showShareTeam,  setShowShareTeam]  = useState(false);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  // ── CORRECTION 3+4: Snapshot now includes nodeColors, lineColor, lineThickness ──
  const captureSnapshot = useCallback((empList, rootList, expSet, nColors, lColor, lThickness) => ({
    employees:     empList,
    roots:         rootList,
    expandedSet:   new Set(expSet),
    nodeColors:    { ...nColors },
    lineColor:     lColor,
    lineThickness: lThickness,
  }), []);

  const applySnapshot = useCallback((snap) => {
    setEmployees(snap.employees);
    setRoots(snap.roots);
    setExpandedSet(new Set(snap.expandedSet));
    if (snap.nodeColors   !== undefined) setNodeColors(snap.nodeColors);
    if (snap.lineColor    !== undefined) setLineColor(snap.lineColor);
    if (snap.lineThickness !== undefined) setLineThickness(snap.lineThickness);
  }, []);

  // ── Load data (UNCHANGED core; adds loading of title, line style, node colors) ──
  const loadData = useCallback(async (keepExpanded = false, currentExpanded = null) => {
    setLoading(true);
    try {
      const [empList, hier, savedState] = await Promise.all([
        api.tradOrgChart.listEmployees(),
        api.tradOrgChart.hierarchy(),
        savedStateApplied.current ? Promise.resolve(null) : api.tradOrgChart.getState(),
      ]);

      setEmployees(empList);
      setRoots(hier.roots);

      if (!keepExpanded) {
        if (!savedStateApplied.current && savedState && savedState.expandedIds !== null) {
          setExpandedSet(enforceSingleLevelExpanded(hier.roots, savedState.expandedIds));
          savedStateApplied.current = true;
        } else if (!savedStateApplied.current) {
          setExpandedSet(buildDefaultExpanded(hier.roots));
          savedStateApplied.current = true;
        }
      } else if (currentExpanded !== null) {
        setExpandedSet(new Set(currentExpanded));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── NEW: Load title, line style, node colors on mount ──
  useEffect(() => {
    api.tradOrgChart.getTitle()
      .then((r) => setChartTitle(r.title || 'Traditional Org Chart'))
      .catch(() => {});
    api.tradOrgChart.getLineStyle()
      .then((r) => {
        if (r.color) setLineColor(r.color);
        if (r.thickness) setLineThickness(r.thickness);
      })
      .catch(() => {});
    api.tradOrgChart.getNodeColors()
      .then((map) => setNodeColors(map || {}))
      .catch(() => {});
  }, []);

  // ── Toggle (UNCHANGED) ──
  const getAllDescendantIds = useCallback((node) => {
    const ids = [];
    function collect(n) {
      if (!n.children) return;
      for (const child of n.children) { ids.push(child.id); collect(child); }
    }
    collect(node);
    return ids;
  }, []);

  const findNode = useCallback((id, nodeList) => {
    for (const n of nodeList) {
      if (n.id === id) return n;
      if (n.children) { const found = findNode(id, n.children); if (found) return found; }
    }
    return null;
  }, []);

  const handleToggle = useCallback((id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        const node = findNode(id, roots);
        if (node) for (const descId of getAllDescendantIds(node)) next.delete(descId);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [findNode, getAllDescendantIds, roots]);

  // ── Add employee (applies defaultNodeColor if set; C3: captures full snapshot) ──
  const handleAdd = async (data) => {
    setAdding(true);
    try {
      const before = captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness);
      const newEmp = await api.tradOrgChart.createEmployee(data);

      // F1: if a default color was pre-selected, save it immediately
      let nextNodeColors = nodeColors;
      if (defaultNodeColor && newEmp?.id) {
        await api.tradOrgChart.saveNodeColor(newEmp.id, defaultNodeColor).catch(() => {});
        nextNodeColors = { ...nodeColors, [newEmp.id]: defaultNodeColor };
        setNodeColors(nextNodeColors);
      }

      const [empList, hier] = await Promise.all([
        api.tradOrgChart.listEmployees(),
        api.tradOrgChart.hierarchy(),
      ]);
      const newExpanded = new Set(expandedSet);
      if (data.manager_id) newExpanded.add(data.manager_id);
      setEmployees(empList);
      setRoots(hier.roots);
      setExpandedSet(newExpanded);
      setHistory((h) => historyPush(h, before));
      flash('Employee added');
    } catch (err) {
      alert(err.message || 'Failed to add employee');
    } finally {
      setAdding(false);
    }
  };

  // ── Delete employee (C3: captures full snapshot) ──
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? Their direct reports will be re-assigned to their manager.`)) return;
    try {
      const before = captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness);
      await api.tradOrgChart.deleteEmployee(id);
      const [empList, hier] = await Promise.all([
        api.tradOrgChart.listEmployees(),
        api.tradOrgChart.hierarchy(),
      ]);
      setEmployees(empList);
      setRoots(hier.roots);
      setHistory((h) => historyPush(h, before));
      setNodeColors((prev) => { const n = { ...prev }; delete n[id]; return n; });
      flash('Employee deleted');
    } catch (err) {
      alert(err.message || 'Failed to delete employee');
    }
  };

  // ── CORRECTION 3: Node color change — pushes to history before changing ──
  const handleColorChange = useCallback(async (empId, color) => {
    // Capture before state
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));

    if (color) {
      setNodeColors((prev) => ({ ...prev, [empId]: color }));
      try { await api.tradOrgChart.saveNodeColor(empId, color); } catch { /* silent */ }
    } else {
      setNodeColors((prev) => { const n = { ...prev }; delete n[empId]; return n; });
      try { await api.tradOrgChart.resetNodeColor(empId); } catch { /* silent */ }
    }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, roots]);

  // ── CORRECTION 4: Line color change — pushes to history ──
  const handleLineColorChange = useCallback(async (color) => {
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));
    setLineColor(color);
    try { await api.tradOrgChart.saveLineStyle(color, lineThickness); } catch { /* silent */ }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, roots]);

  // ── CORRECTION 4: Line thickness change — pushes to history ──
  const handleLineThicknessChange = useCallback(async (thickness) => {
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));
    setLineThickness(thickness);
    try { await api.tradOrgChart.saveLineStyle(lineColor, thickness); } catch { /* silent */ }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, roots]);

  // ── F7: Save title ──
  const handleTitleSave = async () => {
    const t = titleDraft.trim() || 'Traditional Org Chart';
    setChartTitle(t);
    setEditingTitle(false);
    try { await api.tradOrgChart.saveTitle(t); } catch { /* silent */ }
  };

  // ── Undo (C3+C4: restores nodeColors, lineColor, lineThickness) ──
  const handleUndo = useCallback(() => {
    const { state: prev, hist } = historyUndo(history, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness));
    if (hist === history) return;
    setHistory(hist);
    applySnapshot(prev);
    flash('Undone');
  }, [applySnapshot, captureSnapshot, employees, expandedSet, history, lineColor, lineThickness, nodeColors, roots]);

  // ── Redo (C3+C4: restores nodeColors, lineColor, lineThickness) ──
  const handleRedo = useCallback(() => {
    const { state: next, hist } = historyRedo(history, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness));
    if (hist === history) return;
    setHistory(hist);
    applySnapshot(next);
    flash('Redone');
  }, [applySnapshot, captureSnapshot, employees, expandedSet, history, lineColor, lineThickness, nodeColors, roots]);

  // ── Save (UNCHANGED) ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tradOrgChart.saveState({ expandedIds: Array.from(expandedSet) });
      flash('Chart saved');
    } catch (err) {
      alert(err.message || 'Failed to save chart');
    } finally {
      setSaving(false);
    }
  };

  // ── Export PNG / PDF (UNCHANGED) ──
  const handleExport = async (format) => {
    if (!chartAreaRef.current) { alert('Chart area not ready.'); return; }
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (format === 'png') {
        await exportChartAsImage(chartAreaRef.current, 'traditional-org-chart.png');
      } else {
        await exportChartAsPdf(chartAreaRef.current, 'traditional-org-chart.pdf');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // ── Build chartData for share/web export (includes new fields) ──
  const buildChartData = useCallback(() => ({
    roots,
    title: chartTitle,
    employeeCount: employees.length,
    expandedIds: Array.from(expandedSet),
    nodeColors,
    lineColor,
    lineThickness,
  }), [roots, chartTitle, employees.length, expandedSet, nodeColors, lineColor, lineThickness]);

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />

      {/* F7: Editable title beside PageHeader */}
      <div className="flex items-center gap-3 mb-2">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="input-field text-xl font-bold text-blue-900 w-72"
              maxLength={80}
            />
            <button type="button" onClick={handleTitleSave} className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"><Check className="w-4 h-4" /></button>
            <button type="button" onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-2xl font-bold text-gray-900">{chartTitle}</h1>
            <button
              type="button"
              onClick={() => { setTitleDraft(chartTitle); setEditingTitle(true); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit chart title"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">Add employees with a reporting manager — the hierarchy builds itself automatically.</p>

      {/* Info banner (UNCHANGED) */}
      <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
        <GitBranch className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-0.5">How it works</p>
          <p>
            Add the root person first (no "Reports To"). Then add more people and set their "Reports To" field.
            The chart automatically places everyone in the correct position.
            Click <strong>▶</strong> on any node to reveal its direct reports one level at a time.
            Click <strong>▾</strong> to collapse the subtree.
          </p>
        </div>
      </div>

      {/* CORRECTION 2: Permanently visible Node Color toolbar */}
      <NodeColorToolbar selectedColor={defaultNodeColor} onSelect={setDefaultNodeColor} />

      <AddEmployeeForm employees={employees} onAdd={handleAdd} adding={adding} />

      {/* Import From Excel (UNCHANGED) */}
      <div className="flex items-center gap-2 mb-2 -mt-2">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
          title="Import employee hierarchy from an Excel file"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Import From Excel
        </button>
        <span className="text-xs text-gray-400">Upload .xlsx to auto-generate the full hierarchy</span>
      </div>

      {/* F2: Line style panel */}
      <LineStylePanel
        lineColor={lineColor}
        lineThickness={lineThickness}
        onColorChange={handleLineColorChange}
        onThicknessChange={handleLineThicknessChange}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Save (UNCHANGED) */}
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Save expanded/collapsed state">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Chart'}
        </button>

        {/* Undo (UNCHANGED) */}
        <button type="button" onClick={handleUndo} disabled={!canUndo} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed" title="Undo">
          <Undo2 className="w-4 h-4" /> Undo
        </button>

        {/* Redo (UNCHANGED) */}
        <button type="button" onClick={handleRedo} disabled={!canRedo} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed" title="Redo">
          <Redo2 className="w-4 h-4" /> Redo
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />

        {/* F3: Export Full Org Chart PNG */}
        <button type="button" onClick={() => handleExport('png')} disabled={!!exporting || loading} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Export full org chart as PNG">
          {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
          Export Full PNG
        </button>

        {/* F3: Export Full Org Chart PDF */}
        <button type="button" onClick={() => handleExport('pdf')} disabled={!!exporting || loading} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Export full org chart as PDF">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Export Full PDF
        </button>

        {/* F4: Export Team */}
        <button type="button" onClick={() => setShowExportTeam(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-violet-200 text-violet-700 hover:bg-violet-50" title="Export a specific team subtree">
          <Users className="w-4 h-4" />
          Export Team
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />

        {/* F5: Share Full Org Chart (was Export Web Chart — same functionality, renamed) */}
        <button type="button" onClick={() => setShowWebExport(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-blue-200 text-blue-700 hover:bg-blue-50" title="Share or export interactive web chart">
          <Globe className="w-4 h-4" />
          Share Full Chart
        </button>

        {/* F6: Share Team Link */}
        <button type="button" onClick={() => setShowShareTeam(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-teal-200 text-teal-700 hover:bg-teal-50" title="Share a team subtree as an interactive link">
          <Users className="w-4 h-4" />
          Share Team
        </button>

        {msg && <span className="text-sm text-green-700 font-medium ml-1">{msg}</span>}
      </div>

      {/* ── Chart area ── */}
      {loading ? (
        <LoadingSpinner message="Loading hierarchy..." />
      ) : roots.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No employees yet</p>
          <p className="text-sm mt-1">Add the first person above to start the hierarchy.</p>
        </div>
      ) : (
        <div id="trad-org-chart-export-area" ref={chartAreaRef} className="card overflow-auto bg-white">
          {/* Chart header — shows custom title (F7) */}
          <div className="mb-4 pb-3 border-b border-gray-100">
            <h2 className="text-xl font-bold text-blue-900">{chartTitle}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {employees.length} {employees.length === 1 ? 'employee' : 'employees'} · {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="flex justify-center min-w-0 pb-6">
            <OrgTreeCanvas
              roots={roots}
              expandedSet={expandedSet}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onColorChange={handleColorChange}
              nodeColors={nodeColors}
              lineColor={lineColor}
              lineThickness={lineThickness}
              selectedToolbarColor={defaultNodeColor}
            />
          </div>
        </div>
      )}

      {/* F5: Share Full Org Chart modal (same as before, passes enriched chartData) */}
      {showWebExport && (
        <ExportWebChartModal
          chartData={buildChartData()}
          onClose={() => setShowWebExport(false)}
        />
      )}

      {/* Import From Excel modal (UNCHANGED) */}
      {showImport && (
        <ImportExcelModal
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            savedStateApplied.current = false;
            loadData();
            flash('Import complete — chart updated');
          }}
        />
      )}

      {/* F4: Export Team modal */}
      {showExportTeam && (
        <ExportTeamModal
          employees={employees}
          roots={roots}
          nodeColors={nodeColors}
          lineColor={lineColor}
          lineThickness={lineThickness}
          chartTitle={chartTitle}
          onClose={() => setShowExportTeam(false)}
        />
      )}

      {/* F6: Share Team modal */}
      {showShareTeam && (
        <ShareTeamModal
          employees={employees}
          roots={roots}
          nodeColors={nodeColors}
          lineColor={lineColor}
          lineThickness={lineThickness}
          chartTitle={chartTitle}
          onClose={() => setShowShareTeam(false)}
        />
      )}
    </div>
  );
}
