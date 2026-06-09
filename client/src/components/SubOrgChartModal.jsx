import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Loader2,
  Users,
  X,
} from 'lucide-react';
import api from '../api/client';

// ─── tiny avatar helper ──────────────────────────────────────────────────────
function Avatar({ employee, size = 40 }) {
  const initials = (employee.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // deterministic hue from id
  const hue = ((employee.id || 0) * 47 + 200) % 360;

  if (employee.photo_url) {
    return (
      <img
        src={employee.photo_url}
        alt={employee.name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue},55%,45%)`,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  );
}

// ─── single employee card inside the modal ───────────────────────────────────
function DrillCard({ emp, onClick, isFocused = false, reportCount = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all duration-150 p-3 flex items-center gap-3 group
        ${isFocused
          ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-300'
          : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm hover:bg-primary-50/40'}
      `}
    >
      <Avatar employee={emp} size={42} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-gray-900 truncate">{emp.name}</p>
        <p className="text-xs text-gray-500 truncate">{emp.designation || '—'}</p>
        {emp.department && (
          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700">
            {emp.department}
          </span>
        )}
        {reportCount > 0 && (
          <span className="inline-block mt-0.5 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
            {reportCount} report{reportCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {(reportCount > 0 || onClick) && (
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 shrink-0 transition-colors" />
      )}
    </button>
  );
}

// ─── main modal component ────────────────────────────────────────────────────
export default function SubOrgChartModal({ rootEmployee, onClose }) {
  const [stack, setStack] = useState([]); // history for back navigation
  const [currentId, setCurrentId] = useState(rootEmployee?.id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);

  // fetch drill-down data whenever currentId changes
  useEffect(() => {
    if (!currentId) return;
    setLoading(true);
    setError(null);
    api.orgChart
      .drillDown(currentId)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load chart data');
        setLoading(false);
      });
  }, [currentId]);

  const drillInto = useCallback((id) => {
    setStack((prev) => [...prev, currentId]);
    setCurrentId(id);
  }, [currentId]);

  const goBack = useCallback(() => {
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setCurrentId(prev);
  }, [stack]);

  const goHome = useCallback(() => {
    setStack([]);
    setCurrentId(rootEmployee?.id);
  }, [rootEmployee?.id]);

  // close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '100%', maxWidth: 780, maxHeight: '88vh' }}
      >
        {/* ── header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {stack.length > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-700 transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {stack.length > 1 && (
              <button
                type="button"
                onClick={goHome}
                className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-700 transition-colors"
                title={`Back to ${rootEmployee?.name}`}
              >
                <Home className="w-4 h-4" />
              </button>
            )}

            {/* breadcrumb */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Users className="w-4 h-4 text-primary-400 shrink-0" />
              <span className="text-sm font-semibold text-primary-800 truncate">
                {rootEmployee?.name}
              </span>
              {stack.length > 0 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <span className="text-xs text-gray-500 truncate">
                    {stack.length > 1 ? `…${stack.length - 1} level${stack.length > 2 ? 's' : ''} deep ›` : ''}
                    {data?.employee?.name}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-primary-400" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-10 text-red-500">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                className="mt-3 btn-secondary text-sm"
                onClick={() => setCurrentId((id) => id)} // re-trigger effect
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* focused employee */}
              <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-primary-50 border border-primary-100">
                <Avatar employee={data.employee} size={56} />
                <div>
                  <h3 className="text-lg font-bold text-primary-900">{data.employee.name}</h3>
                  <p className="text-sm text-gray-600">{data.employee.designation}</p>
                  {data.employee.department && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-primary-200 text-primary-700">
                      {data.employee.department}
                    </span>
                  )}
                  {data.employee.employee_id && (
                    <span className="ml-2 inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                      {data.employee.employee_id}
                    </span>
                  )}
                </div>
              </div>

              {/* reports to */}
              {data.managers?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    Reports To
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.managers.map((m) => (
                      <DrillCard
                        key={m.id}
                        emp={m}
                        onClick={() => drillInto(m.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* separator */}
              {data.managers?.length > 0 && data.directReports?.length > 0 && (
                <div className="border-t border-dashed border-gray-200 my-4" />
              )}

              {/* direct reports */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Direct Reports
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 normal-case text-[10px]">
                    {data.directReports?.length || 0}
                  </span>
                </p>

                {data.directReports?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.directReports.map((r) => (
                      <DrillCard
                        key={r.id}
                        emp={r}
                        reportCount={r.report_count || 0}
                        onClick={r.report_count > 0 ? () => drillInto(r.id) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">No direct reports</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── footer ── */}
        {stack.length > 0 && !loading && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50 shrink-0">
            <span className="text-xs text-gray-500">
              {stack.length} level{stack.length !== 1 ? 's' : ''} deep from{' '}
              <span className="font-medium text-gray-700">{rootEmployee?.name}</span>
            </span>
            <button
              type="button"
              onClick={goHome}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <Home className="w-3 h-3" /> Back to {rootEmployee?.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
