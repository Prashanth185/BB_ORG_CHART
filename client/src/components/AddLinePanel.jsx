import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import { RELATIONSHIP_TYPES } from './common';

export default function AddLinePanel({ employees, onCreate, onCancel, connectingFrom }) {
  const [fromId, setFromId] = useState(connectingFrom || '');
  const [toId, setToId] = useState('');
  const [relType, setRelType] = useState('reports_to');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!fromId || !toId) {
      setError('Select both manager (from) and employee (to)');
      return;
    }
    if (fromId === toId) {
      setError('Cannot connect employee to themselves');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onCreate({
        employee_id: Number(toId),
        manager_id: Number(fromId),
        relationship_type: relType,
      });
      setFromId('');
      setToId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mb-4 border-2 border-primary-200 bg-primary-50/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-primary-900 flex items-center gap-2">
          <Link2 className="w-5 h-5" /> Add Connection Line
        </h4>
        <button type="button" onClick={onCancel} className="p-1 hover:bg-white rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        Connect two people: <strong>From (manager)</strong> → <strong>To (reports to them)</strong>
        {connectingFrom && ' — or click another box on the chart as "To".'}
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">From (manager)</label>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="input-field mt-1">
            <option value="">Select person</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">To (employee)</label>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="input-field mt-1">
            <option value="">Select person</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={String(e.id) === String(fromId)}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Line type</label>
          <select value={relType} onChange={(e) => setRelType(e.target.value)} className="input-field mt-1">
            {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button type="button" onClick={handleCreate} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Adding...' : 'Add Line'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
