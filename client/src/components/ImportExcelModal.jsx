/**
 * ImportExcelModal.jsx
 *
 * Full Excel import workflow for Traditional Org Chart.
 *
 * Screens:
 *   1. Upload  — drag-and-drop or click to select .xlsx / .xls
 *   2. Validate — calls /import/validate, shows summary + errors
 *   3. Execute  — calls /import/execute on confirmation, then closes
 *   4. History  — tab showing past import records + regenerate button
 *
 * Does NOT touch any existing functionality.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  AlertTriangle, Download, RefreshCw, Clock, ChevronRight,
  Loader2, Users, GitBranch, TriangleAlert,
} from 'lucide-react';
import api from '../api/client';
import { downloadExcelTemplate } from '../utils/excelTemplate';

// ─── Small reusable badge ─────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-emerald-100 text-emerald-700',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    gray:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Upload', 'Validate', 'Import'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors
            ${i < current ? 'bg-emerald-100 text-emerald-700' : i === current ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
            {s}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function ImportExcelModal({ onClose, onImportComplete }) {
  const [tab,        setTab]        = useState('import'); // 'import' | 'history'
  const [step,       setStep]       = useState(0);        // 0=upload 1=validate 2=confirm
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing,  setExecuting]  = useState(false);
  const [validation, setValidation] = useState(null);    // server response
  const [mode,       setMode]       = useState('replace');// 'replace' | 'append'
  const [history,    setHistory]    = useState([]);
  const [loadingHist,setLoadingHist]= useState(false);
  const [error,      setError]      = useState('');

  const fileInputRef = useRef(null);

  // ── Load history when switching to history tab ──
  useEffect(() => {
    if (tab !== 'history') return;
    setLoadingHist(true);
    api.tradOrgChart.importHistory()
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingHist(false));
  }, [tab]);

  // ── File selection ──
  const handleFileSelect = useCallback((selected) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setError('Please select a .xlsx or .xls file.');
      return;
    }
    setError('');
    setFile(selected);
    setValidation(null);
    setStep(0);
  }, []);

  // ── Drag-and-drop ──
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  // ── Validate ──
  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setError('');
    try {
      const result = await api.tradOrgChart.importValidate(file);
      setValidation(result);
      setStep(1);
    } catch (e) {
      setError(e.message || 'Validation failed. Check the file format.');
    } finally {
      setValidating(false);
    }
  };

  // ── Execute import ──
  const handleExecute = async () => {
    if (!file || !validation?.valid) return;
    setExecuting(true);
    setError('');
    try {
      await api.tradOrgChart.importExecute(file, mode);
      setStep(2);
      // Notify parent to reload chart data
      onImportComplete?.();
    } catch (e) {
      setError(e.message || 'Import failed. Please try again.');
    } finally {
      setExecuting(false);
    }
  };

  // ── Regenerate from history ──
  const handleRegenerate = async (id) => {
    try {
      await api.tradOrgChart.importRegenerate(id);
      onImportComplete?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to regenerate chart.');
    }
  };

  const reset = () => { setFile(null); setValidation(null); setStep(0); setError(''); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Import From Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Generate the complete Traditional Org Chart hierarchy from an Excel file
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {[
            { id: 'import',  label: 'Import' },
            { id: 'history', label: 'Import History' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); if (t.id === 'import') reset(); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ════════════════ IMPORT TAB ════════════════ */}
          {tab === 'import' && (
            <>
              {/* Step indicator */}
              <Steps current={step} />

              {/* ── Step 0: Upload ── */}
              {step === 0 && (
                <div className="space-y-4">
                  {/* Download template */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Need a template?</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Download the Excel template with sample data and instructions.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadExcelTemplate()}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shrink-0 ml-3"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Template
                    </button>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
                      ${dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                    {file ? (
                      <>
                        <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                        <p className="font-semibold text-emerald-700 text-sm">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB · Click to change file
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-gray-300" />
                        <p className="font-semibold text-gray-600 text-sm">
                          Drag & drop your Excel file here
                        </p>
                        <p className="text-xs text-gray-400">or click to browse · .xlsx and .xls supported</p>
                      </>
                    )}
                  </div>

                  {/* Expected columns info */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Expected columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {['Employee ID', 'Employee Name', 'Designation', 'Department', 'Reports To Employee ID'].map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-xs text-gray-600 font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Leave "Reports To Employee ID" blank for root employees (CEO / top-level directors).
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!file || validating}
                    className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {validating ? 'Validating…' : 'Validate File'}
                  </button>
                </div>
              )}

              {/* ── Step 1: Validation result ── */}
              {step === 1 && validation && (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Employees', value: validation.total,      icon: Users,      color: 'blue'  },
                      { label: 'Root Nodes',       value: validation.rootCount,  icon: GitBranch,  color: 'green' },
                      { label: 'Relationships',    value: validation.relCount,   icon: GitBranch,  color: 'blue'  },
                      { label: 'Errors Found',     value: validation.errorCount, icon: AlertCircle,color: validation.errorCount > 0 ? 'red' : 'green' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Validation status banner */}
                  {validation.valid ? (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Validation passed</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          All {validation.total} employees are valid. Ready to import.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">
                          Validation failed — {validation.errorCount} {validation.errorCount === 1 ? 'error' : 'errors'} found
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Fix the errors below and re-upload the file.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error list */}
                  {validation.errors.length > 0 && (
                    <div className="border border-red-100 rounded-xl overflow-hidden">
                      <div className="bg-red-50 px-4 py-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-semibold text-red-700">
                          Errors ({validation.errors.length})
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-red-50">
                        {validation.errors.map((e, i) => (
                          <div key={i} className="px-4 py-2 flex items-start gap-2 bg-white">
                            <span className="text-xs font-medium text-red-500 shrink-0 mt-0.5">Row {e.row}</span>
                            <span className="text-xs text-gray-600">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {validation.preview?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Preview (first 5 rows):</p>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500">
                              <th className="px-3 py-2 text-left font-medium">ID</th>
                              <th className="px-3 py-2 text-left font-medium">Name</th>
                              <th className="px-3 py-2 text-left font-medium">Designation</th>
                              <th className="px-3 py-2 text-left font-medium">Department</th>
                              <th className="px-3 py-2 text-left font-medium">Reports To</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {validation.preview.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5 font-mono text-blue-600">{r.empId}</td>
                                <td className="px-3 py-1.5 font-medium text-gray-800">{r.name}</td>
                                <td className="px-3 py-1.5 text-gray-500">{r.desig || '—'}</td>
                                <td className="px-3 py-1.5 text-gray-500">{r.dept || '—'}</td>
                                <td className="px-3 py-1.5 font-mono text-gray-400">{r.reportsTo || <span className="text-emerald-500">ROOT</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Import mode */}
                  {validation.valid && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                        <TriangleAlert className="w-3.5 h-3.5" />
                        Import Mode
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="replace"
                            checked={mode === 'replace'}
                            onChange={() => setMode('replace')}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">Replace existing data</p>
                            <p className="text-xs text-gray-500">
                              Clears all current Traditional Org Chart employees and replaces with imported data.
                            </p>
                          </div>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="append"
                            checked={mode === 'append'}
                            onChange={() => setMode('append')}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">Append to existing data</p>
                            <p className="text-xs text-gray-500">
                              Adds imported employees alongside any existing employees. Skips duplicates.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      ← Upload Different File
                    </button>
                    {validation.valid && (
                      <button
                        type="button"
                        onClick={handleExecute}
                        disabled={executing}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {executing
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                          : <><CheckCircle2 className="w-4 h-4" /> Generate Org Chart</>}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Success ── */}
              {step === 2 && (
                <div className="flex flex-col items-center gap-5 py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900">Import Successful!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {validation?.total} employees have been imported and the Traditional Org Chart has been updated.
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 w-full border border-gray-100 text-sm text-gray-600 space-y-1">
                    <p>✓ Hierarchy generated automatically from reporting relationships</p>
                    <p>✓ All existing Traditional Org Chart features are available</p>
                    <p>✓ Expand/Collapse, Save, Undo/Redo, Export PDF/PNG/Web all work</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-8 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    View Org Chart
                  </button>
                </div>
              )}
            </>
          )}

          {/* ════════════════ HISTORY TAB ════════════════ */}
          {tab === 'history' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Past imports are listed below. Click <strong>Regenerate</strong> to reset the chart view
                to the state from that import (employees stay in database).
              </p>

              {loadingHist ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading history…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
                  <Clock className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No imports yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-8 h-8 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{h.file_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge color="blue">{h.total_employees} employees</Badge>
                          <Badge color="green">{h.root_count} roots</Badge>
                          <Badge color="gray">{h.relationship_count} relationships</Badge>
                          {h.error_count > 0 && <Badge color="red">{h.error_count} errors</Badge>}
                          <span className="text-xs text-gray-400">
                            by {h.imported_by} · {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(h.id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Regenerate chart from this import"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
