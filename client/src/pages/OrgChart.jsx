import { useEffect, useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Search, Image, FileText, Loader2 } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, LoadingSpinner, RELATIONSHIP_TYPES } from '../components/common';
import LineStylePanel from '../components/LineStylePanel';
import { HierarchyChart, ChainChart, MatrixChart, NetworkChart, DrillDownPanel } from '../components/OrgChartViews';
import FreeformOrgChart from '../components/FreeformOrgChart';
import { DEFAULT_LINE_SETTINGS } from '../utils/chartLineStyles';
import { exportChartAsImage, exportChartAsPdf } from '../utils/orgChartExport';

const LAYOUTS = [
  { id: 'custom', label: 'Custom (Drag & Edit)' },
  { id: 'hierarchy', label: 'Vertical Hierarchy' },
  { id: 'chain', label: 'Horizontal Chain' },
  { id: 'matrix', label: 'Matrix Layout' },
  { id: 'network', label: 'Network Layout' },
  { id: 'drill-down', label: 'Drill Down' },
];

export default function OrgChart() {
  const chartRef = useRef(null);
  const [layout, setLayout] = useState('custom');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [drillStack, setDrillStack] = useState([]);
  const [lineSettings, setLineSettings] = useState(DEFAULT_LINE_SETTINGS);
  const [exporting, setExporting] = useState(null);
  const [chartTitle, setChartTitle] = useState('GCC – May 2026');
  const [chartTheme, setChartTheme] = useState('professional');
  const [orthogonalLines, setOrthogonalLines] = useState(true);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(console.error);
    api.chartLayout.getSettings().then((s) => {
      if (s.title) setChartTitle(s.title);
      if (s.theme) setChartTheme(s.theme);
      if (s.orthogonalLines !== undefined) setOrthogonalLines(s.orthogonalLines);
      if (s.routingType) setLineSettings((prev) => ({ ...prev, routingType: s.routingType }));
    }).catch(console.error);
  }, []);

  const saveChartSettings = (overrides = {}) => {
    api.chartLayout.saveSettings({
      title: chartTitle,
      theme: chartTheme,
      orthogonalLines,
      routingType: lineSettings.routingType,
      ...overrides,
    }).catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    setData(null);

    const fetchers = {
      hierarchy: () => api.orgChart.hierarchy(selectedId),
      chain: () => api.orgChart.chain(selectedId),
      matrix: () => api.orgChart.matrix(selectedId),
      network: () => api.orgChart.network(selectedId),
      'drill-down': () => selectedId
        ? api.orgChart.drillDown(selectedId)
        : api.orgChart.drillDown(
            employees.find(e => e.designation === 'CEO')?.id || employees[0]?.id
          ),
    };

    const fetcher = fetchers[layout];
    if (!fetcher) return;
    if (layout === 'drill-down' && !selectedId && employees.length === 0) return;
    if (layout === 'custom') {
      setLoading(false);
      return;
    }

    fetcher()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [layout, selectedId, employees]);

  const handleDrillDown = (node) => {
    if (layout === 'drill-down') {
      setDrillStack(prev => [...prev, selectedId]);
      setSelectedId(node.id);
    } else {
      setLayout('drill-down');
      setSelectedId(node.id);
      setDrillStack([]);
    }
  };

  const handleDrill = (id) => {
    setDrillStack(prev => [...prev, selectedId]);
    setSelectedId(id);
  };

  const handleDrillBack = () => {
    const prev = drillStack[drillStack.length - 1];
    setDrillStack(s => s.slice(0, -1));
    setSelectedId(prev ?? null);
  };

  const handleExport = async (format) => {
    if (!chartRef.current) {
      alert('Chart area not ready. Open a chart layout and try again.');
      return;
    }
    if (layout !== 'custom' && loading) return;
    setExporting(format);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const layoutLabel = LAYOUTS.find(l => l.id === layout)?.label || layout;
      const base = `orms-${layoutLabel.toLowerCase().replace(/\s+/g, '-')}`;
      if (format === 'png') {
        await exportChartAsImage(chartRef.current, `${base}.png`);
      } else {
        await exportChartAsPdf(chartRef.current, `${base}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const filteredEmployees = searchTerm
    ? employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.designation?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const layoutLabel = LAYOUTS.find(l => l.id === layout)?.label || 'Org Chart';

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />

      <PageHeader
        title="Organization Chart"
        subtitle="Build GCC-style charts: add people, set reporting lines, arrange, export"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={(layout !== 'custom' && loading) || !!exporting}
              onClick={() => handleExport('png')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
              Export PNG
            </button>
            <button
              type="button"
              disabled={(layout !== 'custom' && loading) || !!exporting}
              onClick={() => handleExport('pdf')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Export PDF
            </button>
          </div>
        }
      />

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Chart title (like your slide)</label>
            <input
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              onBlur={saveChartSettings}
              className="input-field text-lg font-bold text-primary-900"
              placeholder="GCC – May 2026"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chartTheme === 'professional'}
                onChange={(e) => {
                  setChartTheme(e.target.checked ? 'professional' : 'standard');
                  setTimeout(saveChartSettings, 0);
                }}
              />
              Professional dark boxes (GCC style)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={orthogonalLines}
                onChange={(e) => {
                  setOrthogonalLines(e.target.checked);
                  setTimeout(saveChartSettings, 0);
                }}
              />
              Orthogonal blue connectors
            </label>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setLayout(l.id); setSelectedId(null); setDrillStack([]); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  layout === l.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9 w-48"
              />
              {filteredEmployees.length > 0 && searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {filteredEmployees.map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { setSelectedId(e.id); setSearchTerm(''); setLayout('drill-down'); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {e.name} — {e.designation}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="input-field w-48"
            >
              <option value="">All / Default Root</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 rounded-lg hover:bg-gray-100">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 rounded-lg hover:bg-gray-100">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <LineStylePanel
          settings={lineSettings}
          onChange={(next) => {
            setLineSettings(next);
            if (next.routingType !== lineSettings.routingType) {
              saveChartSettings({ routingType: next.routingType });
            }
          }}
        />

        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="inline-block w-6 border-t-2"
                style={{
                  borderColor: lineSettings.useTypeColors ? val.color : lineSettings.color,
                  borderStyle: lineSettings.lineType === 'dashed' ? 'dashed' : lineSettings.lineType === 'dotted' ? 'dotted' : 'solid',
                  borderWidth: lineSettings.width,
                }}
              />
              {val.label}
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {layout === 'custom' ? (
          <div id="org-chart-export-area" ref={chartRef} className="p-4 bg-white">
            <h2 className="text-2xl font-bold text-primary-900 border-b-2 border-primary-600 pb-2 mb-6 inline-block">
              {chartTitle}
            </h2>
            <FreeformOrgChart
              globalLineSettings={lineSettings}
              theme={chartTheme}
              orthogonalLines={orthogonalLines}
              routingType={lineSettings.routingType}
            />
          </div>
        ) : loading ? (
          <LoadingSpinner message="Generating org chart..." />
        ) : (
          <div
            id="org-chart-export-area"
            ref={chartRef}
            className="p-4 bg-white"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}
          >
            <p className="text-center text-xs text-gray-400 mb-4">{layoutLabel} — {new Date().toLocaleDateString()}</p>
            {layout === 'hierarchy' && <HierarchyChart data={data} onDrillDown={handleDrillDown} lineSettings={lineSettings} />}
            {layout === 'chain' && <ChainChart chains={data} lineSettings={lineSettings} />}
            {layout === 'matrix' && <MatrixChart data={data} lineSettings={lineSettings} />}
            {layout === 'network' && <NetworkChart data={data} lineSettings={lineSettings} />}
            {layout === 'drill-down' && (
              <DrillDownPanel
                data={data}
                onBack={drillStack.length > 0 ? handleDrillBack : () => setLayout('hierarchy')}
                backLabel={drillStack.length > 0 ? '← Back' : '← Back to Hierarchy View'}
                onDrill={handleDrill}
                lineSettings={lineSettings}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
