/**
 * ProjectsDashboard.jsx
 *
 * The multi-project home page. Shows all org chart projects with search,
 * create, open, rename, duplicate, archive, and delete capabilities.
 *
 * This is ADDITIVE — does not touch any existing page or component.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus, Search, MousePointer2, GitBranch, MoreVertical,
  Pencil, Copy, Archive, Trash2, RefreshCw, FolderOpen,
  Clock, X, Check, FolderArchive, Plus,
} from 'lucide-react';
import { projects as projectsApi } from '../api/client';
import { LoadingSpinner } from '../components/common';

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Create Project Modal ──────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('manual');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required'); return; }
    setCreating(true); setError('');
    try {
      const proj = await projectsApi.create({ name: name.trim(), type });
      onCreate(proj);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-500 mt-0.5">Give your org chart project a name and choose a type</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. GCC May 2026, EDC Team, HR Department…"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('manual')}
                className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  type === 'manual'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  type === 'manual' ? 'bg-primary-200' : 'bg-gray-100'
                }`}>
                  <MousePointer2 className={`w-5 h-5 ${type === 'manual' ? 'text-primary-700' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${type === 'manual' ? 'text-primary-800' : 'text-gray-700'}`}>
                    Manual Org Chart
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Drag & drop canvas with free-form drawing
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('traditional')}
                className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  type === 'traditional'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  type === 'traditional' ? 'bg-emerald-200' : 'bg-gray-100'
                }`}>
                  <GitBranch className={`w-5 h-5 ${type === 'traditional' ? 'text-emerald-700' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${type === 'traditional' ? 'text-emerald-800' : 'text-gray-700'}`}>
                    Traditional Org Chart
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Auto hierarchy from employee data
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Creating…</>
              ) : (
                <><Plus className="w-4 h-4" />Create Project</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ project, onClose, onRename }) {
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const updated = await projectsApi.rename(project.project_id, name.trim());
      onRename(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Rename Project</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteModal({ project, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await projectsApi.delete(project.project_id);
      onDelete(project.project_id);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Delete Project</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{project.name}"</span>?
            All chart data, nodes, connections and share links will be permanently removed.
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleting ? 'Deleting…' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Card Action Menu ──────────────────────────────────────────────────
function ActionMenu({ project, onRename, onDuplicate, onArchive, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const isArchived = project.status === 'archived';

  const actions = [
    { icon: Pencil, label: 'Rename', onClick: () => { onRename(); onClose(); }, color: 'text-gray-700' },
    { icon: Copy, label: 'Duplicate', onClick: () => { onDuplicate(); onClose(); }, color: 'text-gray-700' },
    {
      icon: isArchived ? RefreshCw : Archive,
      label: isArchived ? 'Restore' : 'Archive',
      onClick: () => { onArchive(); onClose(); },
      color: isArchived ? 'text-emerald-600' : 'text-amber-600',
    },
    { icon: Trash2, label: 'Delete', onClick: () => { onDelete(); onClose(); }, color: 'text-red-600' },
  ];

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 overflow-hidden"
    >
      {actions.map(({ icon: Icon, label, onClick, color }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${color}`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onRename, onDuplicate, onArchive, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isManual = project.type === 'manual';
  const isArchived = project.status === 'archived';

  return (
    <div className={`relative bg-white rounded-2xl border transition-all group ${
      isArchived
        ? 'border-gray-200 opacity-70'
        : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
    }`}>
      {/* Clickable area */}
      <button
        type="button"
        onClick={() => !isArchived && onOpen(project)}
        className={`w-full text-left p-5 ${isArchived ? 'cursor-default' : 'cursor-pointer'}`}
        disabled={isArchived}
      >
        {/* Type badge */}
        <div className="flex items-start justify-between mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            isManual ? 'bg-primary-100 text-primary-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isManual
              ? <MousePointer2 className="w-3.5 h-3.5" />
              : <GitBranch className="w-3.5 h-3.5" />}
            {isManual ? 'Manual' : 'Traditional'}
          </div>
          {isArchived && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
              <Archive className="w-3 h-3" />Archived
            </span>
          )}
        </div>

        {/* Name */}
        <p className="font-bold text-gray-900 text-base mb-1 leading-snug truncate pr-6">{project.name}</p>

        {/* Project ID */}
        <p className="text-xs text-gray-400 font-mono mb-3">{project.project_id}</p>

        {/* Updated time */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {relativeTime(project.updated_at)}</span>
        </div>
      </button>

      {/* Action menu button */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Project actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <ActionMenu
            project={project}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onDelete={onDelete}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* Open button (hover) */}
      {!isArchived && (
        <div className="px-5 pb-5 pt-0">
          <button
            type="button"
            onClick={() => onOpen(project)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-gray-500 text-sm font-medium transition-colors border border-gray-100 hover:border-primary-200"
          >
            <FolderOpen className="w-4 h-4" />
            Open Project
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsDashboard() {
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [duplicating, setDuplicating] = useState(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.list({ status: showArchived ? 'archived' : 'active' });
      setProjectList(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, [showArchived]);

  // Filter by search
  const filtered = searchQuery.trim()
    ? projectList.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project_id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projectList;

  const handleOpen = (project) => {
    if (project.type === 'manual') {
      navigate(`/projects/${project.project_id}/org-chart`);
    } else {
      navigate(`/projects/${project.project_id}/traditional-org-chart`);
    }
  };

  const handleDuplicate = async (project) => {
    setDuplicating(project.project_id);
    try {
      const copy = await projectsApi.duplicate(project.project_id);
      setProjectList((prev) => [copy, ...prev]);
    } catch (err) {
      alert(err.message || 'Failed to duplicate project');
    } finally {
      setDuplicating(null);
    }
  };

  const handleArchive = async (project) => {
    try {
      await projectsApi.archive(project.project_id);
      setProjectList((prev) => prev.filter((p) => p.project_id !== project.project_id));
    } catch (err) {
      alert(err.message || 'Failed to archive project');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your org chart projects</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by name or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            showArchived
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading projects…" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          {searchQuery ? (
            <>
              <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No projects match "{searchQuery}"</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </>
          ) : showArchived ? (
            <>
              <FolderArchive className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No archived projects</p>
            </>
          ) : (
            <>
              <FolderPlus className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No projects yet</p>
              <p className="text-sm text-gray-400 mt-1 mb-6">Create your first org chart project to get started</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Create First Project
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div key={project.project_id} className="relative">
              {duplicating === project.project_id && (
                <div className="absolute inset-0 z-10 bg-white/80 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              )}
              <ProjectCard
                project={project}
                onOpen={handleOpen}
                onRename={() => setRenameTarget(project)}
                onDuplicate={() => handleDuplicate(project)}
                onArchive={() => handleArchive(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-6">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </p>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(proj) => setProjectList((prev) => [proj, ...prev])}
        />
      )}
      {renameTarget && (
        <RenameModal
          project={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={(updated) => {
            setProjectList((prev) => prev.map((p) => p.project_id === updated.project_id ? updated : p));
          }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDelete={(pid) => setProjectList((prev) => prev.filter((p) => p.project_id !== pid))}
        />
      )}
    </div>
  );
}
