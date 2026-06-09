/**
 * ProjectTraditionalOrgChart.jsx
 *
 * Project-scoped version of TraditionalOrgChart.
 * All chart logic is IDENTICAL to TraditionalOrgChart.jsx.
 * The only difference: API calls use /api/projects/:pid/trad/* endpoints.
 *
 * The original TraditionalOrgChart.jsx is NOT modified.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserPlus, Trash2, ChevronDown, ChevronRight,
  GitBranch, Save, Undo2, Redo2, Image, FileText, Loader2, Globe, FileSpreadsheet,
  Pencil, Check, X, Palette, Minus, Users, ArrowLeft,
} from 'lucide-react';
import { projects as projectsApi } from '../api/client';
import { LoadingSpinner } from '../components/common';
import { exportChartAsImage, exportChartAsPdf } from '../utils/orgChartExport';

// ─── Layout constants (same as TraditionalOrgChart) ──────────────────────────
const CARD_W    = 176;
const CARD_H    = 80;
const H_GAP     = 36;
const V_GAP     = 60;

// ─── Node color palette (same as TraditionalOrgChart) ────────────────────────
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
const DEFAULT_NODE_COLOR  = '#2563eb';
const LINE_THICKNESSES    = [1, 2, 3, 4, 5, 6, 8, 10];
const DEFAULT_LINE_COLOR  = '#94a3b8';
const DEFAULT_LINE_THICKNESS = 2;

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

// ─── Measure subtree width ────────────────────────────────────────────────────
function subtreeWidth(node, expandedSet) {
  const isExpanded = expandedSet.has(node.id);
  if (!isExpanded || !node.children || node.children.length === 0) return CARD_W;
  const childWidths = node.children.map((c) => subtreeWidth(c, expandedSet));
  const total = childWidths.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1);
  return Math.max(CARD_W, total);
}

// ─── Render tree ─────────────────────────────────────────────────────────────
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
    lines.push({ key: `stub-${node.id}`,  x1: parentBottomX,              y1: parentBottomY, x2: parentBottomX,                            y2: elbowY });
    lines.push({ key: `hbar-${node.id}`,  x1: childCentres[0],            y1: elbowY,        x2: childCentres[childCentres.length - 1],    y2: elbowY });
    for (let i = 0; i < node.children.length; i++) {
      lines.push({ key: `drop-${node.id}-${i}`, x1: childCentres[i], y1: elbowY, x2: childCentres[i], y2: childY });
    }
  }

  for (let i = 0; i < node.children.length; i++) {
    renderTree(node.children[i], childCentres[i], childY, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lineColor, lineThickness, selectedToolbarColor, cards, lines);
  }
}

// ─── Canvas size ──────────────────────────────────────────────────────────────
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

// ─── Node Card ────────────────────────────────────────────────────────────────
function NodeCard({ node, x, y, isExpanded, hasChildren, onToggle, onDelete, onColorChange, nodeColor, selectedToolbarColor }) {
  const accentColor = nodeColor || deptColor(node.department);
  return (
    <div className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H, zIndex: 10 }}>
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors"
          data-export-exclude
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}
      <div className="w-full h-full rounded-lg overflow-hidden flex shadow-md" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div style={{ width: 5, flexShrink: 0, background: accentColor }} />
        <div className="flex-1 px-2.5 py-2 min-w-0 relative">
          <p className="font-bold text-sm leading-tight truncate" style={{ color: '#1e3a5f' }}>{node.name}</p>
          {node.designation && <p className="text-xs truncate mt-0.5" style={{ color: '#475569' }}>{node.designation}</p>}
          {node.department  && <p className="text-xs truncate mt-0.5" style={{ color: accentColor, fontWeight: 500 }}>{node.department}</p>}
          <p className="text-xs truncate mt-0.5" style={{ color: '#94a3b8' }}>{node.employee_id}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onColorChange(node.id, selectedToolbarColor || null); }}
            className="absolute top-1 right-6 w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100"
            data-export-exclude
          >
            <Palette className="w-3 h-3 text-gray-400" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id, node.name)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-100"
            data-export-exclude
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrgTreeCanvas ────────────────────────────────────────────────────────────
function OrgTreeCanvas({ roots, expandedSet, onToggle, onDelete, onColorChange, nodeColors, lineColor, lineThickness, selectedToolbarColor }) {
  const cards = []; const lines = [];
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
      <svg className="absolute top-0 left-0 pointer-events-none" width={canvasW + padding * 2} height={canvasH + padding * 2} style={{ zIndex: 1 }}>
        {lines.map((l) => (
          <line key={l.key}
            x1={l.x1 + canvasW / 2 + padding} y1={l.y1 + padding}
            x2={l.x2 + canvasW / 2 + padding} y2={l.y2 + padding}
            stroke={lc} strokeWidth={lt} strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute" style={{ left: canvasW / 2 + padding, top: padding, width: 0, height: 0 }}>
        {cards}
      </div>
    </div>
  );
}

// ─── Add Employee Form ────────────────────────────────────────────────────────
function AddEmployeeForm({ employees, onAdd, adding }) {
  const [form, setForm] = useState({ employee_id: '', name: '', designation: '', department: '', manager_id: '' });
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
        <UserPlus className="w-4 h-4 text-primary-600" /> Add Employee
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

// ─── Undo/Redo helpers ────────────────────────────────────────────────────────
function createHistory()         { return { past: [], future: [] }; }
function historyPush(hist, snap) { return { past: [...hist.past, snap], future: [] }; }
function historyUndo(hist, cur)  {
  if (hist.past.length === 0) return { state: cur, hist };
  const prev = hist.past[hist.past.length - 1];
  return { state: prev, hist: { past: hist.past.slice(0, -1), future: [cur, ...hist.future] } };
}
function historyRedo(hist, cur)  {
  if (hist.future.length === 0) return { state: cur, hist };
  const next = hist.future[0];
  return { state: next, hist: { past: [...hist.past, cur], future: hist.future.slice(1) } };
}

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

function buildFullyExpanded(node) {
  const ids = new Set();
  function walk(n) { ids.add(n.id); (n.children || []).forEach(walk); }
  walk(node);
  return ids;
}

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

function countSubtreeNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + countSubtreeNodes(c), 0);
}

// ─── Line Style Panel ─────────────────────────────────────────────────────────
function LineStylePanel({ lineColor, lineThickness, onColorChange, onThicknessChange }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
        <Minus className="w-3.5 h-3.5" /> Line Style
      </span>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Color:</label>
        <input type="color" value={lineColor} onChange={(e) => onColorChange(e.target.value)} className="w-8 h-6 rounded cursor-pointer border border-gray-200" />
        <div className="w-12 h-1 rounded-full" style={{ background: lineColor }} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Thickness:</label>
        <div className="flex gap-1">
          {LINE_THICKNESSES.map((t) => (
            <button key={t} type="button" onClick={() => onThicknessChange(t)}
              className={`w-7 h-6 rounded text-xs font-medium transition-colors ${lineThickness === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Node Color Toolbar ───────────────────────────────────────────────────────
function NodeColorToolbar({ selectedColor, onSelect }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 shrink-0">
        <Palette className="w-3.5 h-3.5" /> Node Color:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {NODE_COLORS.map((c) => (
          <button key={c.value} type="button" onClick={() => onSelect(c.value)}
            className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 focus:outline-none flex items-center justify-center"
            style={{ background: c.value, borderColor: selectedColor === c.value ? '#1e293b' : 'transparent', boxShadow: selectedColor === c.value ? '0 0 0 2px #fff, 0 0 0 3px #1e293b' : 'none' }}
          >
            {selectedColor === c.value && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
          </button>
        ))}
        <input type="color" value={selectedColor || '#2563eb'} onChange={(e) => onSelect(e.target.value)}
          className="w-7 h-7 rounded-lg cursor-pointer border-2 border-gray-200 hover:border-gray-400" />
        <button type="button" onClick={() => onSelect(null)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${!selectedColor ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}
        >Reset</button>
      </div>
      <span className="text-xs text-gray-400 italic">
        {selectedColor ? `Armed: ${selectedColor} — click 🎨 on a node` : 'Select a color, then click 🎨 on any node'}
      </span>
    </div>
  );
}

// ─── Export Team Modal ────────────────────────────────────────────────────────
function ExportTeamModal({ employees, roots, nodeColors, lineColor, lineThickness, chartTitle, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [exporting, setExporting] = useState(null);
  const exportRef = useRef(null);
  const selectedNode = selectedId ? buildSubtree(Number(selectedId), roots) : null;
  const nodeCount    = selectedNode ? countSubtreeNodes(selectedNode) : 0;
  const subtreeExpanded = selectedNode ? buildFullyExpanded(selectedNode) : new Set();

  const handleExport = async (format) => {
    if (!selectedNode || !exportRef.current) return;
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const name = selectedNode.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      if (format === 'png') await exportChartAsImage(exportRef.current, `team-${name}.png`);
      else await exportChartAsPdf(exportRef.current, `team-${name}.pdf`);
    } catch (err) { alert(err.message || 'Export failed.'); }
    finally { setExporting(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <Users className="w-5 h-5 text-violet-600 shrink-0" />
          <div className="flex-1"><h2 className="text-lg font-bold text-gray-900">Export Team</h2></div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input-field w-full">
            <option value="">— Choose employee —</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}{emp.designation ? ` — ${emp.designation}` : ''}</option>)}
          </select>
          {selectedNode && (
            <div className="bg-violet-50 rounded-xl p-3 border border-violet-100 text-sm text-violet-800">
              <p className="font-semibold">{selectedNode.name}</p>
              <p className="text-xs text-violet-600 mt-0.5">{nodeCount} employee{nodeCount !== 1 ? 's' : ''}</p>
            </div>
          )}
          {selectedNode && (
            <div className="flex gap-3">
              <button type="button" onClick={() => handleExport('png')} disabled={!!exporting}
                className="flex-1 py-2.5 px-4 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Export PNG
              </button>
              <button type="button" onClick={() => handleExport('pdf')} disabled={!!exporting}
                className="flex-1 py-2.5 px-4 bg-violet-700 text-white text-sm font-semibold rounded-xl hover:bg-violet-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export PDF
              </button>
            </div>
          )}
          {selectedNode && (
            <div ref={exportRef} id="proj-trad-export-area" style={{ position: 'fixed', left: -9999, top: 0, background: '#ffffff', padding: 32, zIndex: -1, pointerEvents: 'none' }}>
              <div className="mb-4 pb-3 border-b border-gray-100">
                <h2 className="text-xl font-bold text-blue-900">{chartTitle} — {selectedNode.name}'s Team</h2>
                <p className="text-xs text-gray-400 mt-0.5">{nodeCount} employees · {new Date().toLocaleDateString()}</p>
              </div>
              <OrgTreeCanvas roots={[selectedNode]} expandedSet={subtreeExpanded} onToggle={() => {}} onDelete={() => {}} onColorChange={() => {}} nodeColors={nodeColors} lineColor={lineColor} lineThickness={lineThickness} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Share Team Modal ─────────────────────────────────────────────────────────
function ShareTeamModal({ pid, employees, roots, nodeColors, lineColor, lineThickness, chartTitle, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const selectedNode = selectedId ? buildSubtree(Number(selectedId), roots) : null;
  const nodeCount    = selectedNode ? countSubtreeNodes(selectedNode) : 0;

  const handleGenerate = async () => {
    if (!selectedNode) return;
    setGenerating(true); setError('');
    try {
      const subtreeExpanded = buildFullyExpanded(selectedNode);
      const chartData = { roots: [selectedNode], title: `${chartTitle} — ${selectedNode.name}'s Team`, employeeCount: nodeCount, expandedIds: Array.from(subtreeExpanded), nodeColors, lineColor, lineThickness };
      const result = await projectsApi.trad.shareChart(pid, chartData);
      setShareUrl(`${window.location.origin}/shared-chart/${result.id}`);
    } catch (err) { setError(err.message || 'Failed.'); }
    finally { setGenerating(false); }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {
      const el = document.createElement('textarea'); el.value = shareUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <Globe className="w-5 h-5 text-teal-600" />
          <div className="flex-1"><h2 className="text-lg font-bold text-gray-900">Share Team Link</h2></div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setShareUrl(''); }} className="input-field w-full">
            <option value="">— Choose employee —</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}{emp.designation ? ` — ${emp.designation}` : ''}</option>)}
          </select>
          {selectedNode && !shareUrl && (
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="w-full py-2.5 px-4 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Link'}
            </button>
          )}
          {shareUrl && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-2">
              <span className="flex-1 text-xs text-teal-700 font-mono truncate select-all">{shareUrl}</span>
              <button type="button" onClick={handleCopy} className="shrink-0 p-1.5 rounded-md hover:bg-gray-200">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Globe className="w-4 h-4 text-gray-600" />}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Share Full Chart Modal ───────────────────────────────────────────────────
function ShareFullChartModal({ pid, chartData, onClose }) {
  const [shareUrl, setShareUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await projectsApi.trad.shareChart(pid, chartData);
      setShareUrl(`${window.location.origin}/shared-chart/${result.id}`);
    } catch (err) { alert(err.message || 'Failed'); }
    finally { setGenerating(false); }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {
      const el = document.createElement('textarea'); el.value = shareUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <Globe className="w-5 h-5 text-blue-600" />
          <div className="flex-1"><h2 className="text-lg font-bold text-gray-900">Share Full Chart</h2></div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {!shareUrl ? (
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Share Link'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-2">
                <span className="flex-1 text-xs text-blue-700 font-mono truncate select-all">{shareUrl}</span>
                <button type="button" onClick={handleCopy} className="shrink-0 p-1.5 rounded-md hover:bg-gray-200">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Globe className="w-4 h-4 text-gray-600" />}
                </button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-md hover:bg-gray-200"><Globe className="w-4 h-4 text-gray-600" /></a>
              </div>
              {copied && <p className="text-xs text-green-600 font-medium">Copied!</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Import Excel Modal (simplified) ─────────────────────────────────────────
function ImportModal({ pid, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('replace');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!file) return;
    setImporting(true); setError('');
    try {
      await projectsApi.trad.importExcel(pid, file, mode);
      onDone();
      onClose();
    } catch (err) { setError(err.message || 'Import failed'); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <div className="flex-1"><h2 className="text-lg font-bold text-gray-900">Import from Excel</h2></div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Upload an .xlsx file with columns: Employee ID, Employee Name, Designation, Department, Reports To Employee ID</p>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace existing
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="mode" value="append" checked={mode === 'append'} onChange={() => setMode('append')} /> Append
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleImport} disabled={!file || importing}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProjectTraditionalOrgChart() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [msg, setMsg] = useState('');
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [history, setHistory] = useState(createHistory());
  const chartAreaRef = useRef(null);
  const savedStateApplied = useRef(false);

  const [nodeColors, setNodeColors] = useState({});
  const [defaultNodeColor, setDefaultNodeColor] = useState(null);
  const [lineColor, setLineColor] = useState(DEFAULT_LINE_COLOR);
  const [lineThickness, setLineThickness] = useState(DEFAULT_LINE_THICKNESS);
  const [chartTitle, setChartTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showExportTeam, setShowExportTeam] = useState(false);
  const [showShareTeam, setShowShareTeam] = useState(false);
  const [showShareFull, setShowShareFull] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const captureSnapshot = useCallback((empList, rootList, expSet, nColors, lColor, lThickness) => ({
    employees: empList, roots: rootList, expandedSet: new Set(expSet),
    nodeColors: { ...nColors }, lineColor: lColor, lineThickness: lThickness,
  }), []);

  const applySnapshot = useCallback((snap) => {
    setEmployees(snap.employees); setRoots(snap.roots); setExpandedSet(new Set(snap.expandedSet));
    if (snap.nodeColors    !== undefined) setNodeColors(snap.nodeColors);
    if (snap.lineColor     !== undefined) setLineColor(snap.lineColor);
    if (snap.lineThickness !== undefined) setLineThickness(snap.lineThickness);
  }, []);

  const loadData = useCallback(async (keepExpanded = false, currentExpanded = null) => {
    setLoading(true);
    try {
      const [empList, hier, savedState] = await Promise.all([
        projectsApi.trad.listEmployees(pid),
        projectsApi.trad.hierarchy(pid),
        savedStateApplied.current ? Promise.resolve(null) : projectsApi.trad.getState(pid),
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [pid]);

  useEffect(() => {
    if (!pid) return;
    // Load project info
    projectsApi.get(pid).then(setProject).catch(console.error);
    loadData();
    projectsApi.trad.getTitle(pid).then((r) => setChartTitle(r.title || '')).catch(() => {});
    projectsApi.trad.getLineStyle(pid).then((r) => {
      if (r.color) setLineColor(r.color);
      if (r.thickness) setLineThickness(r.thickness);
    }).catch(() => {});
    projectsApi.trad.getNodeColors(pid).then((m) => setNodeColors(m || {})).catch(() => {});
  }, [pid, loadData]);

  const getAllDescendantIds = useCallback((node) => {
    const ids = [];
    function collect(n) { if (!n.children) return; for (const c of n.children) { ids.push(c.id); collect(c); } }
    collect(node);
    return ids;
  }, []);

  const findNode = useCallback((id, list) => {
    for (const n of list) { if (n.id === id) return n; if (n.children) { const f = findNode(id, n.children); if (f) return f; } }
    return null;
  }, []);

  const handleToggle = useCallback((id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); const node = findNode(id, roots); if (node) for (const d of getAllDescendantIds(node)) next.delete(d); }
      else next.add(id);
      return next;
    });
  }, [findNode, getAllDescendantIds, roots]);

  const handleAdd = async (data) => {
    setAdding(true);
    try {
      const before = captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness);
      const newEmp = await projectsApi.trad.createEmployee(pid, data);
      let nextNodeColors = nodeColors;
      if (defaultNodeColor && newEmp?.id) {
        await projectsApi.trad.saveNodeColor(pid, newEmp.id, defaultNodeColor).catch(() => {});
        nextNodeColors = { ...nodeColors, [newEmp.id]: defaultNodeColor };
        setNodeColors(nextNodeColors);
      }
      const [empList, hier] = await Promise.all([
        projectsApi.trad.listEmployees(pid),
        projectsApi.trad.hierarchy(pid),
      ]);
      const newExpanded = new Set(expandedSet);
      if (data.manager_id) newExpanded.add(data.manager_id);
      setEmployees(empList); setRoots(hier.roots); setExpandedSet(newExpanded);
      setHistory((h) => historyPush(h, before));
      flash('Employee added');
    } catch (err) { alert(err.message || 'Failed to add employee'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? Their direct reports will be re-assigned to their manager.`)) return;
    try {
      const before = captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness);
      await projectsApi.trad.deleteEmployee(pid, id);
      const [empList, hier] = await Promise.all([
        projectsApi.trad.listEmployees(pid),
        projectsApi.trad.hierarchy(pid),
      ]);
      setEmployees(empList); setRoots(hier.roots);
      setHistory((h) => historyPush(h, before));
      setNodeColors((prev) => { const n = { ...prev }; delete n[id]; return n; });
      flash('Employee deleted');
    } catch (err) { alert(err.message || 'Failed'); }
  };

  const handleColorChange = useCallback(async (empId, color) => {
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));
    if (color) {
      setNodeColors((prev) => ({ ...prev, [empId]: color }));
      try { await projectsApi.trad.saveNodeColor(pid, empId, color); } catch { /* silent */ }
    } else {
      setNodeColors((prev) => { const n = { ...prev }; delete n[empId]; return n; });
      try { await projectsApi.trad.resetNodeColor(pid, empId); } catch { /* silent */ }
    }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, pid, roots]);

  const handleLineColorChange = useCallback(async (color) => {
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));
    setLineColor(color);
    try { await projectsApi.trad.saveLineStyle(pid, color, lineThickness); } catch { /* silent */ }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, pid, roots]);

  const handleLineThicknessChange = useCallback(async (thickness) => {
    setHistory((h) => historyPush(h, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness)));
    setLineThickness(thickness);
    try { await projectsApi.trad.saveLineStyle(pid, lineColor, thickness); } catch { /* silent */ }
  }, [captureSnapshot, employees, expandedSet, lineColor, lineThickness, nodeColors, pid, roots]);

  const handleTitleSave = async () => {
    const t = titleDraft.trim() || project?.name || 'Traditional Org Chart';
    setChartTitle(t); setEditingTitle(false);
    try { await projectsApi.trad.saveTitle(pid, t); } catch { /* silent */ }
  };

  const handleUndo = useCallback(() => {
    const { state: prev, hist } = historyUndo(history, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness));
    if (hist === history) return;
    setHistory(hist); applySnapshot(prev); flash('Undone');
  }, [applySnapshot, captureSnapshot, employees, expandedSet, history, lineColor, lineThickness, nodeColors, roots]);

  const handleRedo = useCallback(() => {
    const { state: next, hist } = historyRedo(history, captureSnapshot(employees, roots, expandedSet, nodeColors, lineColor, lineThickness));
    if (hist === history) return;
    setHistory(hist); applySnapshot(next); flash('Redone');
  }, [applySnapshot, captureSnapshot, employees, expandedSet, history, lineColor, lineThickness, nodeColors, roots]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.trad.saveState(pid, { expandedIds: Array.from(expandedSet) });
      flash('Chart saved');
    } catch (err) { alert(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleExport = async (format) => {
    if (!chartAreaRef.current) { alert('Chart area not ready.'); return; }
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const safeName = (project?.name || 'chart').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      if (format === 'png') await exportChartAsImage(chartAreaRef.current, `${safeName}.png`);
      else await exportChartAsPdf(chartAreaRef.current, `${safeName}.pdf`);
    } catch (err) { alert(err.message || 'Export failed.'); }
    finally { setExporting(null); }
  };

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const buildChartData = useCallback(() => ({
    roots, title: chartTitle || project?.name, employeeCount: employees.length,
    expandedIds: Array.from(expandedSet), nodeColors, lineColor, lineThickness,
  }), [roots, chartTitle, project, employees.length, expandedSet, nodeColors, lineColor, lineThickness]);

  const displayTitle = chartTitle || project?.name || 'Traditional Org Chart';

  return (
    <div>
      {/* Back to projects */}
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Editable title */}
      <div className="flex items-center gap-3 mb-2">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input autoFocus type="text" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="input-field text-xl font-bold text-blue-900 w-72" maxLength={80}
            />
            <button type="button" onClick={handleTitleSave} className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"><Check className="w-4 h-4" /></button>
            <button type="button" onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-2xl font-bold text-gray-900">{displayTitle}</h1>
            <button type="button" onClick={() => { setTitleDraft(displayTitle); setEditingTitle(true); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">Traditional org chart — auto hierarchy from employee data.</p>

      {/* Info banner */}
      <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
        <GitBranch className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Add the root person first (no "Reports To"). Then add people and set their manager. Click <strong>▶</strong> to reveal direct reports. Click <strong>▾</strong> to collapse.
        </p>
      </div>

      <NodeColorToolbar selectedColor={defaultNodeColor} onSelect={setDefaultNodeColor} />
      <AddEmployeeForm employees={employees} onAdd={handleAdd} adding={adding} />

      <div className="flex items-center gap-2 mb-2 -mt-2">
        <button type="button" onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100">
          <FileSpreadsheet className="w-4 h-4" /> Import From Excel
        </button>
        <span className="text-xs text-gray-400">Upload .xlsx to auto-generate hierarchy</span>
      </div>

      <LineStylePanel lineColor={lineColor} lineThickness={lineThickness} onColorChange={handleLineColorChange} onThicknessChange={handleLineThicknessChange} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Chart'}
        </button>
        <button type="button" onClick={handleUndo} disabled={!canUndo} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40">
          <Undo2 className="w-4 h-4" /> Undo
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40">
          <Redo2 className="w-4 h-4" /> Redo
        </button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={() => handleExport('png')} disabled={!!exporting || loading} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
          {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Export PNG
        </button>
        <button type="button" onClick={() => handleExport('pdf')} disabled={!!exporting || loading} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export PDF
        </button>
        <button type="button" onClick={() => setShowExportTeam(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 border-violet-200 text-violet-700 hover:bg-violet-50">
          <Users className="w-4 h-4" /> Export Team
        </button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={() => setShowShareFull(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 border-blue-200 text-blue-700 hover:bg-blue-50">
          <Globe className="w-4 h-4" /> Share Full Chart
        </button>
        <button type="button" onClick={() => setShowShareTeam(true)} disabled={loading || roots.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 border-teal-200 text-teal-700 hover:bg-teal-50">
          <Users className="w-4 h-4" /> Share Team
        </button>
        {msg && <span className="text-sm text-green-700 font-medium ml-1">{msg}</span>}
      </div>

      {/* Chart area */}
      {loading ? (
        <LoadingSpinner message="Loading hierarchy..." />
      ) : roots.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No employees yet</p>
          <p className="text-sm mt-1">Add the first person above to start the hierarchy.</p>
        </div>
      ) : (
        <div id="proj-trad-chart-export-area" ref={chartAreaRef} className="card overflow-auto bg-white">
          <div className="mb-4 pb-3 border-b border-gray-100">
            <h2 className="text-xl font-bold text-blue-900">{displayTitle}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{employees.length} {employees.length === 1 ? 'employee' : 'employees'} · {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex justify-center min-w-0 pb-6">
            <OrgTreeCanvas
              roots={roots} expandedSet={expandedSet}
              onToggle={handleToggle} onDelete={handleDelete} onColorChange={handleColorChange}
              nodeColors={nodeColors} lineColor={lineColor} lineThickness={lineThickness}
              selectedToolbarColor={defaultNodeColor}
            />
          </div>
        </div>
      )}

      {showImport && <ImportModal pid={pid} onClose={() => setShowImport(false)} onDone={() => { savedStateApplied.current = false; loadData(); flash('Import complete'); }} />}
      {showExportTeam && <ExportTeamModal employees={employees} roots={roots} nodeColors={nodeColors} lineColor={lineColor} lineThickness={lineThickness} chartTitle={displayTitle} onClose={() => setShowExportTeam(false)} />}
      {showShareTeam && <ShareTeamModal pid={pid} employees={employees} roots={roots} nodeColors={nodeColors} lineColor={lineColor} lineThickness={lineThickness} chartTitle={displayTitle} onClose={() => setShowShareTeam(false)} />}
      {showShareFull && <ShareFullChartModal pid={pid} chartData={buildChartData()} onClose={() => setShowShareFull(false)} />}
    </div>
  );
}
