import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import { BackButton, PageHeader, LoadingSpinner } from '../components/common';

const REPORT_TYPES = [
  { id: 'span', label: 'Span of Control', fetch: () => api.reports.spanOfControl() },
  { id: 'department', label: 'Department Distribution', fetch: () => api.reports.departmentDistribution() },
  { id: 'matrix', label: 'Matrix Report', fetch: () => api.reports.matrixReport() },
  { id: 'location', label: 'Location Report', fetch: () => api.reports.locationReport() },
];

function exportCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState('span');
  const [data, setData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const report = REPORT_TYPES.find(r => r.id === activeReport);
    report.fetch()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeReport]);

  useEffect(() => {
    api.reports.departmentDistribution().then(setDeptData).catch(console.error);
  }, []);

  const handleExport = async (format) => {
    const exportData = await api.reports.export(activeReport === 'matrix' ? 'relationships' : 'employees');
    if (format === 'csv') exportCSV(exportData, `orms-${activeReport}-report.csv`);
    else exportJSON(exportData, `orms-${activeReport}-report.json`);
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Reports & Analytics"
        subtitle="Data-driven insights for organizational decision making"
        action={
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => handleExport('json')} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export JSON
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card lg:col-span-1 p-3">
          <nav className="space-y-1">
            {REPORT_TYPES.map(r => (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeReport === r.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {deptData.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4">Department Distribution Overview</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold mb-4">
              {REPORT_TYPES.find(r => r.id === activeReport)?.label}
            </h3>

            {loading ? (
              <LoadingSpinner />
            ) : data.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available for this report</p>
            ) : activeReport === 'span' ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="direct_reports" fill="#059669" radius={[0, 4, 4, 0]} name="Direct Reports" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      {Object.keys(data[0]).map(key => (
                        <th key={key} className="px-4 py-2 font-medium capitalize">{key.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-2">{val ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
