import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { LINE_TYPES, LINE_WIDTHS, LINE_COLOR_PRESETS } from '../utils/chartLineStyles';
import { RELATIONSHIP_TYPES } from './common';

export default function LineEditModal({ line, lineStyle, onSave, onDelete, onClose }) {
  const [color, setColor] = useState('#2563eb');
  const [width, setWidth] = useState(2);
  const [lineType, setLineType] = useState('solid');
  const [relType, setRelType] = useState('reports_to');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!line) return;
    setColor(lineStyle?.color || '#2563eb');
    setWidth(lineStyle?.width ?? 2);
    setLineType(lineStyle?.line_type || 'solid');
    setRelType(line.relationship_type || 'reports_to');
  }, [line, lineStyle]);

  if (!line) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ color, width, line_type: lineType, relationship_type: relType });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Edit Line</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
          <strong>{line.manager_name}</strong>
          <span className="text-gray-400 mx-2">→</span>
          <strong>{line.employee_name}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Line color</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LINE_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-900 scale-110' : 'border-gray-200'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 w-full h-9 rounded cursor-pointer" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Thickness</label>
            <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="input-field mt-1">
              {LINE_WIDTHS.map((w) => (
                <option key={w} value={w}>{w}px</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Line style</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {LINE_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLineType(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    lineType === id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Relationship type</label>
            <select value={relType} onChange={(e) => setRelType(e.target.value)} className="input-field mt-1">
              {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="btn-secondary text-red-600 flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Tip: You can also pick a line from the list below the chart</p>
      </div>
    </div>
  );
}
