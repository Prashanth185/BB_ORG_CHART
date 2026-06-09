import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, LoadingSpinner, RELATIONSHIP_TYPES } from '../components/common';

export default function Relationships() {
  const [relationships, setRelationships] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', manager_id: '', relationship_type: 'reports_to' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    Promise.all([api.relationships.list(), api.employees.list()])
      .then(([rels, emps]) => {
        setRelationships(rels);
        setEmployees(emps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.relationships.create({
        employee_id: Number(form.employee_id),
        manager_id: Number(form.manager_id),
        relationship_type: form.relationship_type,
      });
      setForm({ employee_id: '', manager_id: '', relationship_type: 'reports_to' });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this relationship?')) return;
    try {
      await api.relationships.delete(id);
      setRelationships(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Define Relationships"
        subtitle="Manage reporting lines and organizational connections"
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Relationship
          </button>
        }
      />

      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <h3 className="font-semibold mb-4">New Relationship</h3>
          {error && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} className="input-field" required>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager / Related To</label>
              <select value={form.manager_id} onChange={e => setForm(p => ({ ...p, manager_id: e.target.value }))} className="input-field" required>
                <option value="">Select manager</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Type</label>
              <select value={form.relationship_type} onChange={e => setForm(p => ({ ...p, relationship_type: e.target.value }))} className="input-field">
                {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(RELATIONSHIP_TYPES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5" style={{ backgroundColor: val.color, borderStyle: val.dash ? 'dashed' : 'solid' }} />
            <span className="text-gray-600">{val.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-6 py-3 font-medium">Relationship</th>
                <th className="px-6 py-3 font-medium">Manager / Related To</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map(rel => (
                <tr key={rel.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium">{rel.employee_name}</p>
                    <p className="text-xs text-gray-500">{rel.employee_designation}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-400">→</td>
                  <td className="px-6 py-3">
                    <p className="font-medium">{rel.manager_name}</p>
                    <p className="text-xs text-gray-500">{rel.manager_designation}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: `${RELATIONSHIP_TYPES[rel.relationship_type]?.color}15`,
                        color: RELATIONSHIP_TYPES[rel.relationship_type]?.color,
                      }}
                    >
                      {RELATIONSHIP_TYPES[rel.relationship_type]?.label || rel.relationship_type}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => handleDelete(rel.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
