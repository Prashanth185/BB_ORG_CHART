import { Settings2 } from 'lucide-react';
import { LINE_TYPES, LINE_WIDTHS, LINE_COLOR_PRESETS } from '../utils/chartLineStyles';
import { RELATIONSHIP_TYPES } from './common';
import { CONNECTOR_ROUTING_OPTIONS } from '../utils/connectorRouting';

export default function LineStylePanel({ settings, onChange }) {
  const update = (key, value) => onChange({ ...settings, [key]: value });

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-800">Line Style Options</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Line color</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {LINE_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => update('color', c)}
                className={`w-6 h-6 rounded-full border-2 ${settings.color === c ? 'border-gray-800 scale-110' : 'border-white shadow'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="color"
            value={settings.color}
            onChange={(e) => update('color', e.target.value)}
            className="w-full h-8 rounded cursor-pointer border border-gray-200"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Line thickness</label>
          <select
            value={settings.width}
            onChange={(e) => update('width', Number(e.target.value))}
            className="input-field"
          >
            {LINE_WIDTHS.map((w) => (
              <option key={w} value={w}>{w}px</option>
            ))}
          </select>
          <div className="mt-2 h-2 rounded" style={{ height: settings.width, backgroundColor: settings.color }} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Line type</label>
          <div className="flex flex-wrap gap-2">
            {LINE_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => update('lineType', id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  settings.lineType === id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <svg className="w-full mt-2" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
            <line
              x1="0" y1="10" x2="200" y2="10"
              stroke={settings.color}
              strokeWidth={settings.width}
              strokeDasharray={idToDash(settings.lineType)}
            />
          </svg>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Color mode</label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useTypeColors}
              onChange={(e) => update('useTypeColors', e.target.checked)}
              className="rounded border-gray-300 text-primary-600"
            />
            Use relationship type colors
          </label>
          {settings.useTypeColors && (
            <div className="mt-2 space-y-1">
              {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="inline-block w-8 border-t-2" style={{ borderColor: val.color, borderStyle: settings.lineType === 'dashed' ? 'dashed' : settings.lineType === 'dotted' ? 'dotted' : 'solid', borderWidth: settings.width }} />
                  {val.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Connector routing</label>
          <select
            value={settings.routingType || 'orthogonal'}
            onChange={(e) => update('routingType', e.target.value)}
            className="input-field"
          >
            {CONNECTOR_ROUTING_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <svg className="w-full mt-2" height="28" viewBox="0 0 180 28" preserveAspectRatio="none">
            <path
              d={previewPath(settings.routingType)}
              fill="none"
              stroke={settings.color}
              strokeWidth={settings.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function idToDash(lineType) {
  if (lineType === 'dashed') return '8,4';
  if (lineType === 'dotted') return '2,3';
  return undefined;
}

function previewPath(routingType = 'orthogonal') {
  if (routingType === 'straight') return 'M 8 22 L 172 6';
  if (routingType === 'curved') return 'M 8 22 C 70 0, 110 30, 172 6';
  if (routingType === 'polygon') return 'M 8 22 L 70 8 L 120 20 L 172 6';
  if (routingType === 'curvedConnector') return 'M 8 22 C 82 22, 92 6, 172 6';
  return 'M 8 22 L 82 22 L 82 6 L 172 6';
}
