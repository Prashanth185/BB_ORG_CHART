/**
 * ProjectManualOrgChart.jsx
 *
 * Project-scoped manual (free-form) org chart.
 * Nodes are stored in proj_chart_nodes (project-scoped, not tied to employees table).
 * This page is ADDITIVE — does not modify FreeformOrgChart or OrgChart.jsx.
 *
 * Features:
 *  - Add named boxes (name, designation, department)
 *  - Drag and drop boxes on a grid canvas
 *  - Draw connections between boxes
 *  - Color per box (border accent color)
 *  - Delete boxes and connections
 *  - Export PNG / PDF
 *  - Save/load from project-scoped API
 *  - Undo / Redo
 *  - Zoom and pan
 *  - Share full chart snapshot
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Undo2, Redo2,
  Image, FileText, Loader2, Globe, ZoomIn, ZoomOut,
  MousePointer2, Move, Check, X, Pencil, Palette,
  Link2, LocateFixed,
} from 'lucide-react';
import { projects as projectsApi } from '../api/client';
import { exportChartAsImage, exportChartAsPdf } from '../utils/orgChartExport';
import { LoadingSpinner } from '../components/common';

// ── Constants ─────────────────────────────────────────────────────────────────
const CARD_W  = 180;
const CARD_H  = 88;
const GRID    = 20;
const DEFAULT_BG_TOP    = '#1e3a5f';
const DEFAULT_BG_BOTTOM = '#2a3140';
const DEFAULT_NAME_COLOR = '#facc15';
const DEFAULT_TITLE_COLOR = '#ffffff';
const DEFAULT_DEPT_COLOR  = '#f87171';

const ACCENT_COLORS = [
  { name: 'Yellow', value: '#facc15' },
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Red',    value: '#ef4444' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Teal',   value: '#14b8a6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'White',  value: '#ffffff' },
];

const CONN_COLORS = ['#94a3b8', '#3b82f6', '#22c55e', '#ef4444', '#f97316', '#a855f7', '#facc15', '#000000'];

function snap(v) { return Math.round(v / GRID) * GRID; }
function genKey() { return `n${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
function genConnKey(from, to) { return `${from}__${to}`; }

// ── Undo/Redo ─────────────────────────────────────────────────────────────────
function createHistory()         { return { past: [], future: [] }; }
function historyPush(h, snap)    { return { past: [...h.past, snap], future: [] }; }
function historyUndo(h, cur)     {
  if (!h.past.length) return { state: cur, hist: h };
  const prev = h.past[h.past.length - 1];
  return { state: prev, hist: { past: h.past.slice(0, -1), future: [cur, ...h.future] } };
}
function historyRedo(h, cur)     {
  if (!h.future.length) return { state: cur, hist: h };
  const next = h.future[0];
  return { state: next, hist: { past: [...h.past, cur], future: h.future.slice(1) } };
}

// ── Node Card ─────────────────────────────────────────────────────────────────
function OrgNodeCard({ node, selected, onSelect, onDragStart, onDelete, onColorChange, zoom }) {
  const accentColor = node.name_color || DEFAULT_NAME_COLOR;

  return (
    <div
      className="absolute select-none cursor-move group"
      style={{
        left: node.pos_x,
        top: node.pos_y,
        width: CARD_W,
        height: CARD_H,
        zIndex: selected ? 20 : 10,
      }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e, node.node_key); onSelect(node.node_key); }}
    >
      {/* Selection ring */}
      {selected && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-400 pointer-events-none" style={{ zIndex: 21 }} />
      )}

      <div
        className="w-full h-full rounded-xl overflow-hidden shadow-lg flex flex-col"
        style={{
          background: `linear-gradient(135deg, ${node.bg_color_top || DEFAULT_BG_TOP}, ${node.bg_color_bottom || DEFAULT_BG_BOTTOM})`,
          border: selected ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 4, background: accentColor, flexShrink: 0 }} />

        <div className="flex-1 px-3 py-2 flex flex-col justify-center min-w-0">
          <p className="font-bold text-sm leading-tight truncate" style={{ color: node.name_color || DEFAULT_NAME_COLOR }}>
            {node.name || node.label || 'Unnamed'}
          </p>
          {node.designation && (
            <p className="text-xs truncate mt-0.5" style={{ color: node.title_color || DEFAULT_TITLE_COLOR }}>
              {node.designation}
            </p>
          )}
          {node.department && (
            <p className="text-xs truncate mt-0.5" style={{ color: node.dept_color || DEFAULT_DEPT_COLOR }}>
              {node.department}
            </p>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(node.node_key); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        title="Delete node"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Color button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onColorChange(node.node_key); }}
        className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        title="Change accent color"
      >
        <Palette className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ── Add Node Panel ────────────────────────────────────────────────────────────
function AddNodePanel({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: '', designation: '', department: '' });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Node</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-400">*</span></label>
            <input ref={inputRef} type="text" value={form.name} onChange={set('name')} placeholder="e.g. John Smith" className="input-field w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
            <input type="text" value={form.designation} onChange={set('designation')} placeholder="e.g. Director" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
            <input type="text" value={form.department} onChange={set('department')} placeholder="e.g. Engineering" className="input-field w-full" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!form.name.trim()} className="flex-1 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
              Add Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Color Picker Modal ────────────────────────────────────────────────────────
function ColorPickerModal({ nodeKey, currentColor, onSave, onClose }) {
  const [color, setColor] = useState(currentColor || DEFAULT_NAME_COLOR);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Node Accent Color</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => (
              <button key={c.value} type="button" onClick={() => setColor(c.value)}
                className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 flex items-center justify-center"
                style={{ background: c.value, borderColor: color === c.value ? '#1e293b' : 'rgba(0,0,0,0.1)' }}>
                {color === c.value && <Check className="w-3.5 h-3.5 text-black/60" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Custom:</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={() => { onSave(nodeKey, color); onClose(); }}
              className="flex-1 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ pid, nodes, connections, chartTitle, onClose }) {
  const [shareUrl, setShareUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const chartData = { type: 'manual_project', nodes: Object.values(nodes), connections, title: chartTitle };
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
          <div className="flex-1"><h2 className="text-lg font-bold text-gray-900">Share Chart</h2></div>
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
              </div>
              {copied && <p className="text-xs text-green-600 font-medium">Copied!</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Title inline ─────────────────────────────────────────────────────────
function EditableTitle({ title, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = () => { const t = draft.trim() || title; onSave(t); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          className="input-field text-xl font-bold text-gray-900 w-72" maxLength={80}
        />
        <button type="button" onClick={handleSave} className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-lg bg-gray-200 text-gray-600"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <button type="button" onClick={() => { setDraft(title); setEditing(true); }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Connection line ───────────────────────────────────────────────────────────
function ConnectionLine({ fromNode, toNode, selected, color, onSelect, onDelete }) {
  if (!fromNode || !toNode) return null;

  const x1 = fromNode.pos_x + CARD_W / 2;
  const y1 = fromNode.pos_y + CARD_H / 2;
  const x2 = toNode.pos_x   + CARD_W / 2;
  const y2 = toNode.pos_y   + CARD_H / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lineColor = color || '#94a3b8';

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth={selected ? 3 : 2} strokeLinecap="round" />
      {/* Arrow head */}
      <defs>
        <marker id={`arrow-${fromNode.node_key}-${toNode.node_key}`} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={lineColor} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth={2}
        markerEnd={`url(#arrow-${fromNode.node_key}-${toNode.node_key})`} />
      {/* Click area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12}
        onClick={() => onSelect()} style={{ cursor: 'pointer' }} />
      {selected && (
        <g>
          <circle cx={mx} cy={my} r={10} fill="white" stroke="#ef4444" strokeWidth={1.5} style={{ cursor: 'pointer' }} onClick={onDelete} />
          <text x={mx} y={my + 4} textAnchor="middle" fontSize={12} fill="#ef4444" style={{ cursor: 'pointer' }} onClick={onDelete}>×</text>
        </g>
      )}
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProjectManualOrgChart() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const exportRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [msg, setMsg] = useState('');

  // Canvas state
  const [nodes, setNodes] = useState({}); // { nodeKey: node }
  const [connections, setConnections] = useState([]); // [{ from, to, color }]
  const [chartTitle, setChartTitle] = useState('');

  // Interaction state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [tool, setTool] = useState('select'); // 'select' | 'connect' | 'pan'
  const [dragging, setDragging] = useState(null); // { nodeKey, startX, startY, nodeStartX, nodeStartY }
  const [panning, setPanning] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedConn, setSelectedConn] = useState(null);
  const [connColor, setConnColor] = useState('#94a3b8');

  // Modals
  const [showAddNode, setShowAddNode] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [showShare, setShowShare] = useState(false);

  // History
  const [history, setHistory] = useState(createHistory());

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const captureSnap = useCallback(() => ({
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: [...connections],
  }), [nodes, connections]);

  const record = useCallback(() => {
    setHistory((h) => historyPush(h, captureSnap()));
  }, [captureSnap]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pid) return;
    projectsApi.get(pid).then(setProject).catch(console.error);

    projectsApi.manual.canvas(pid).then((data) => {
      setNodes(data.nodes || {});
      setConnections(data.lineStyles ? Object.values(data.lineStyles).map((ls) => ({
        from: ls.connection_key?.split('__')[0] || '',
        to:   ls.connection_key?.split('__')[1] || '',
        color: ls.color || '#94a3b8',
      })).filter((c) => c.from && c.to) : []);
      const title = data.settings?.title || '';
      setChartTitle(title);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pid]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.manual.saveNodes(pid, nodes);
      // Save connections as line styles
      for (const conn of connections) {
        const ck = genConnKey(conn.from, conn.to);
        await projectsApi.manual.saveLineStyle(pid, ck, { color: conn.color || '#94a3b8', width: 2 });
      }
      await projectsApi.manual.saveSettings(pid, { title: chartTitle });
      flash('Saved');
    } catch (err) { alert(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Undo/Redo ─────────────────────────────────────────────────────────────
  const handleUndo = () => {
    const cur = captureSnap();
    const { state: prev, hist } = historyUndo(history, cur);
    if (hist === history) return;
    setHistory(hist); setNodes(prev.nodes); setConnections(prev.connections); flash('Undone');
  };
  const handleRedo = () => {
    const cur = captureSnap();
    const { state: next, hist } = historyRedo(history, cur);
    if (hist === history) return;
    setHistory(hist); setNodes(next.nodes); setConnections(next.connections); flash('Redone');
  };

  // ── Add Node ──────────────────────────────────────────────────────────────
  const handleAddNode = ({ name, designation, department }) => {
    record();
    const nodeKey = genKey();
    const nodeCount = Object.keys(nodes).length;
    const col = nodeCount % 5;
    const row = Math.floor(nodeCount / 5);
    setNodes((prev) => ({
      ...prev,
      [nodeKey]: {
        node_key: nodeKey,
        label: name,
        name,
        designation: designation || '',
        department: department || '',
        pos_x: snap(60 + col * (CARD_W + 40)),
        pos_y: snap(60 + row * (CARD_H + 60)),
        bg_color_top: DEFAULT_BG_TOP,
        bg_color_bottom: DEFAULT_BG_BOTTOM,
        name_color: DEFAULT_NAME_COLOR,
        title_color: DEFAULT_TITLE_COLOR,
        dept_color: DEFAULT_DEPT_COLOR,
      },
    }));
    setSelectedNode(nodeKey);
  };

  // ── Delete Node ───────────────────────────────────────────────────────────
  const handleDeleteNode = (nodeKey) => {
    record();
    setNodes((prev) => { const n = { ...prev }; delete n[nodeKey]; return n; });
    setConnections((prev) => prev.filter((c) => c.from !== nodeKey && c.to !== nodeKey));
    if (selectedNode === nodeKey) setSelectedNode(null);
  };

  // ── Node color ────────────────────────────────────────────────────────────
  const handleColorSave = (nodeKey, color) => {
    record();
    setNodes((prev) => ({
      ...prev,
      [nodeKey]: { ...prev[nodeKey], name_color: color },
    }));
  };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleNodeDragStart = (e, nodeKey) => {
    if (tool !== 'select') return;
    e.preventDefault();
    const node = nodes[nodeKey];
    setDragging({ nodeKey, startX: e.clientX, startY: e.clientY, nodeStartX: node.pos_x, nodeStartY: node.pos_y });
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / zoom;
        const dy = (e.clientY - dragging.startY) / zoom;
        setNodes((prev) => ({
          ...prev,
          [dragging.nodeKey]: {
            ...prev[dragging.nodeKey],
            pos_x: snap(dragging.nodeStartX + dx),
            pos_y: snap(dragging.nodeStartY + dy),
          },
        }));
      }
      if (panning) {
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        setPan({ x: panning.panStartX + dx, y: panning.panStartY + dy });
      }
    };
    const onMouseUp = (e) => {
      if (dragging) { record(); setDragging(null); }
      if (panning)  { setPanning(null); }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragging, panning, zoom, record]);

  // ── Connect ───────────────────────────────────────────────────────────────
  const handleNodeClick = (nodeKey) => {
    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeKey);
      } else {
        if (connectFrom !== nodeKey) {
          const alreadyExists = connections.some(
            (c) => (c.from === connectFrom && c.to === nodeKey) || (c.from === nodeKey && c.to === connectFrom)
          );
          if (!alreadyExists) {
            record();
            setConnections((prev) => [...prev, { from: connectFrom, to: nodeKey, color: connColor }]);
          }
        }
        setConnectFrom(null);
      }
    } else {
      setSelectedNode(nodeKey);
      setSelectedConn(null);
    }
  };

  // ── Canvas pan ────────────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e) => {
    if (tool === 'pan' || e.button === 1) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, panStartX: pan.x, panStartY: pan.y });
    } else {
      setSelectedNode(null);
      setSelectedConn(null);
      if (connectFrom) setConnectFrom(null);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    if (!exportRef.current) { alert('Chart area not ready.'); return; }
    setExporting(format);
    try {
      await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const safeName = (chartTitle || project?.name || 'chart').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      if (format === 'png') await exportChartAsImage(exportRef.current, `${safeName}.png`);
      else await exportChartAsPdf(exportRef.current, `${safeName}.pdf`);
    } catch (err) { alert(err.message || 'Export failed'); }
    finally { setExporting(null); }
  };

  // ── Title save ────────────────────────────────────────────────────────────
  const handleTitleSave = async (t) => {
    setChartTitle(t);
    try { await projectsApi.manual.saveSettings(pid, { title: t }); } catch { /* silent */ }
  };

  const displayTitle = chartTitle || project?.name || 'Manual Org Chart';
  const nodeList = Object.values(nodes);
  const canvasWidth  = Math.max(1200, ...nodeList.map((n) => n.pos_x + CARD_W + 80));
  const canvasHeight = Math.max(800,  ...nodeList.map((n) => n.pos_y + CARD_H + 80));

  if (loading) return <LoadingSpinner message="Loading chart…" />;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <button type="button" onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Projects
        </button>
        <span className="text-gray-200">|</span>
        <EditableTitle title={displayTitle} onSave={handleTitleSave} />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Tool selector */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button type="button" title="Select & Move" onClick={() => setTool('select')}
              className={`p-1.5 rounded-md transition-colors ${tool === 'select' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button type="button" title="Connect nodes" onClick={() => { setTool('connect'); setConnectFrom(null); }}
              className={`p-1.5 rounded-md transition-colors ${tool === 'connect' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Link2 className="w-4 h-4" />
            </button>
            <button type="button" title="Pan canvas" onClick={() => setTool('pan')}
              className={`p-1.5 rounded-md transition-colors ${tool === 'pan' ? 'bg-white shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Move className="w-4 h-4" />
            </button>
          </div>

          {/* Connector color */}
          {tool === 'connect' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Line:</span>
              {CONN_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setConnColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: connColor === c ? '#1e293b' : 'transparent' }} />
              ))}
            </div>
          )}

          <span className="w-px h-5 bg-gray-200" />

          <button type="button" onClick={() => setShowAddNode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Node
          </button>

          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>

          <button type="button" onClick={handleUndo} disabled={!history.past.length}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40" title="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleRedo} disabled={!history.future.length}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40" title="Redo">
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-gray-200" />

          <button type="button" onClick={() => handleExport('png')} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} PNG
          </button>
          <button type="button" onClick={() => handleExport('pdf')} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </button>
          <button type="button" onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50">
            <Globe className="w-4 h-4" /> Share
          </button>

          <span className="w-px h-5 bg-gray-200" />

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} className="p-1.5 rounded-lg hover:bg-gray-100" title="Reset view">
              <LocateFixed className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      {(msg || connectFrom || tool === 'connect') && (
        <div className={`px-4 py-1.5 text-xs font-medium shrink-0 ${
          connectFrom ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100' : 'bg-blue-50 text-blue-700 border-b border-blue-100'
        }`}>
          {connectFrom
            ? `Connected from "${nodes[connectFrom]?.name}" — now click the target node. Press Escape to cancel.`
            : tool === 'connect'
            ? 'Connect mode — click a source node, then click a target node to draw a connection.'
            : msg}
          {msg && tool !== 'connect' && !connectFrom && msg}
        </div>
      )}

      {/* Canvas area */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 19px, #f1f5f9 19px, #f1f5f9 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #f1f5f9 19px, #f1f5f9 20px)',
          cursor: tool === 'pan' ? 'grab' : tool === 'connect' ? 'crosshair' : 'default',
        }}
        onMouseDown={handleCanvasMouseDown}
        onKeyDown={(e) => { if (e.key === 'Escape') { setConnectFrom(null); setSelectedNode(null); setSelectedConn(null); } }}
        tabIndex={0}
      >
        {/* Export target (hidden) */}
        <div
          ref={exportRef}
          id="proj-manual-export-area"
          style={{
            position: 'fixed', left: -9999, top: 0, background: '#f8fafc', padding: 32, zIndex: -1, pointerEvents: 'none',
            width: canvasWidth + 64, height: canvasHeight + 64,
          }}
        >
          <p className="text-lg font-bold text-gray-900 mb-4">{displayTitle}</p>
          <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
            <svg className="absolute inset-0 pointer-events-none" width={canvasWidth} height={canvasHeight} style={{ zIndex: 1 }}>
              {connections.map((conn) => {
                const fn = nodes[conn.from]; const tn = nodes[conn.to];
                if (!fn || !tn) return null;
                return <line key={`${conn.from}__${conn.to}`}
                  x1={fn.pos_x + CARD_W / 2} y1={fn.pos_y + CARD_H / 2}
                  x2={tn.pos_x + CARD_W / 2} y2={tn.pos_y + CARD_H / 2}
                  stroke={conn.color || '#94a3b8'} strokeWidth={2} strokeLinecap="round" />;
              })}
            </svg>
            {nodeList.map((node) => (
              <div key={node.node_key} className="absolute rounded-xl overflow-hidden shadow-lg flex flex-col"
                style={{
                  left: node.pos_x, top: node.pos_y, width: CARD_W, height: CARD_H,
                  background: `linear-gradient(135deg, ${node.bg_color_top || DEFAULT_BG_TOP}, ${node.bg_color_bottom || DEFAULT_BG_BOTTOM})`,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                <div style={{ height: 4, background: node.name_color || DEFAULT_NAME_COLOR, flexShrink: 0 }} />
                <div className="flex-1 px-3 py-2 flex flex-col justify-center min-w-0">
                  <p className="font-bold text-sm leading-tight truncate" style={{ color: node.name_color || DEFAULT_NAME_COLOR }}>{node.name || node.label}</p>
                  {node.designation && <p className="text-xs truncate mt-0.5" style={{ color: node.title_color || DEFAULT_TITLE_COLOR }}>{node.designation}</p>}
                  {node.department  && <p className="text-xs truncate mt-0.5" style={{ color: node.dept_color  || DEFAULT_DEPT_COLOR  }}>{node.department}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live canvas */}
        <div
          style={{
            transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            position: 'absolute',
            width: canvasWidth,
            height: canvasHeight,
          }}
        >
          {/* SVG connections */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasWidth}
            height={canvasHeight}
            style={{ zIndex: 1 }}
          >
            {connections.map((conn, i) => (
              <ConnectionLine
                key={`${conn.from}__${conn.to}__${i}`}
                fromNode={nodes[conn.from]}
                toNode={nodes[conn.to]}
                selected={selectedConn === i}
                color={conn.color}
                onSelect={() => { setSelectedConn(i); setSelectedNode(null); }}
                onDelete={() => { record(); setConnections((prev) => prev.filter((_, idx) => idx !== i)); setSelectedConn(null); }}
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodeList.map((node) => (
            <div
              key={node.node_key}
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node.node_key); }}
              style={{ position: 'absolute', left: node.pos_x, top: node.pos_y, zIndex: selectedNode === node.node_key ? 20 : 10 }}
            >
              <OrgNodeCard
                node={node}
                selected={selectedNode === node.node_key || connectFrom === node.node_key}
                onSelect={handleNodeClick}
                onDragStart={handleNodeDragStart}
                onDelete={handleDeleteNode}
                onColorChange={(nk) => setColorPickerFor(nk)}
                zoom={zoom}
              />
            </div>
          ))}

          {/* Empty state */}
          {nodeList.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <MousePointer2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Canvas is empty</p>
                <p className="text-sm text-gray-400 mt-1">Click "Add Node" to start building your chart</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddNode && <AddNodePanel onAdd={handleAddNode} onClose={() => setShowAddNode(false)} />}
      {colorPickerFor && (
        <ColorPickerModal
          nodeKey={colorPickerFor}
          currentColor={nodes[colorPickerFor]?.name_color}
          onSave={handleColorSave}
          onClose={() => setColorPickerFor(null)}
        />
      )}
      {showShare && (
        <ShareModal
          pid={pid}
          nodes={nodes}
          connections={connections}
          chartTitle={displayTitle}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
