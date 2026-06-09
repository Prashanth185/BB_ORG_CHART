import { useState } from 'react';
import { X } from 'lucide-react';
import { LINE_COLOR_PRESETS } from '../utils/chartLineStyles';

const FONT_WEIGHTS = [
  { id: 'normal', label: 'Normal' },
  { id: 'bold', label: 'Bold' },
  { id: '600', label: 'Semi-bold' },
];

export default function BoxStyleModal({ employee, style, onSave, onReset, onClose }) {
  const [form, setForm] = useState({
    name_color: style?.name_color || '#facc15',
    title_color: style?.title_color || '#ffffff',
    dept_color: style?.dept_color || '#f87171',
    name_font_size: style?.name_font_size || 14,
    title_font_size: style?.title_font_size || 12,
    name_font_weight: style?.name_font_weight || 'bold',
    bg_color_top: style?.bg_color_top || '#5a6578',
    bg_color_bottom: style?.bg_color_bottom || '#2a3140',
  });
  const [saving, setSaving] = useState(false);

  if (!employee) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Box Style — {employee.name}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="rounded-lg p-3 mb-4 text-center"
          style={{
            background: `linear-gradient(180deg, ${form.bg_color_top} 0%, ${form.bg_color_bottom} 100%)`,
          }}
        >
          <p style={{ color: form.name_color, fontSize: form.name_font_size, fontWeight: form.name_font_weight }}>
            {employee.name}
          </p>
          <p style={{ color: form.title_color, fontSize: form.title_font_size }}>
            {employee.designation}
          </p>
          {employee.department && (
            <p style={{ color: form.dept_color, fontSize: 10 }}>{employee.department}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <ColorField label="Name color" value={form.name_color} onChange={(v) => setForm(p => ({ ...p, name_color: v }))} />
          <ColorField label="Title color" value={form.title_color} onChange={(v) => setForm(p => ({ ...p, title_color: v }))} />
          <ColorField label="Dept/group color" value={form.dept_color} onChange={(v) => setForm(p => ({ ...p, dept_color: v }))} />
          <ColorField label="Box top" value={form.bg_color_top} onChange={(v) => setForm(p => ({ ...p, bg_color_top: v }))} />
          <ColorField label="Box bottom" value={form.bg_color_bottom} onChange={(v) => setForm(p => ({ ...p, bg_color_bottom: v }))} />

          <div>
            <label className="text-xs font-medium text-gray-600">Name size (px)</label>
            <input type="number" min={10} max={24} value={form.name_font_size}
              onChange={(e) => setForm(p => ({ ...p, name_font_size: Number(e.target.value) }))}
              className="input-field mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Title size (px)</label>
            <input type="number" min={8} max={20} value={form.title_font_size}
              onChange={(e) => setForm(p => ({ ...p, title_font_size: Number(e.target.value) }))}
              className="input-field mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600">Name font weight</label>
            <select value={form.name_font_weight} onChange={(e) => setForm(p => ({ ...p, name_font_weight: e.target.value }))}
              className="input-field mt-1">
              {FONT_WEIGHTS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Box Style'}
          </button>
          <button type="button" onClick={onReset} className="btn-secondary">Reset</button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Saved permanently per employee</p>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex gap-1 mt-1 flex-wrap">
        {LINE_COLOR_PRESETS.slice(0, 6).map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`w-5 h-5 rounded-full border ${value === c ? 'border-gray-800' : 'border-gray-200'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-7 mt-1 rounded" />
    </div>
  );
}
