import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import PhotoUpload from '../components/PhotoUpload';
import { BackButton, PageHeader, LoadingSpinner } from '../components/common';

export default function AddEmployee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [filters, setFilters] = useState({ departments: [], locations: [], businessUnits: [] });
  const [departments, setDepartments] = useState([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [otherDepartment, setOtherDepartment] = useState('');
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);

  const loadDepartments = useCallback(() => (
    api.departments.list()
      .then(setDepartments)
      .catch(console.error)
  ), []);

  const [form, setForm] = useState({
    employee_id: '', name: '', designation: '', department: '',
    business_unit: '', location: '', email: '', phone: '', bio: '', reporting_to: '',
  });

  const isOtherDepartment = form.department === 'Other';

  useEffect(() => {
    Promise.all([api.employees.filters(), api.employees.list()])
      .then(([f, emps]) => {
        setFilters(f);
        setManagers(emps);
      })
      .catch(console.error);
    loadDepartments();
  }, [loadDepartments]);

  const handleAddDepartment = async () => {
    const name = newDepartment.trim();
    if (!name) {
      setDeptError('Enter a department name');
      return;
    }
    setDeptError('');
    setAddingDepartment(true);
    try {
      const created = await api.departments.create(name);
      await loadDepartments();
      setForm((prev) => ({ ...prev, department: created.name || name }));
      setNewDepartment('');
    } catch (err) {
      setDeptError(err.message);
    } finally {
      setAddingDepartment(false);
    }
  };

  useEffect(() => {
    if (isEdit) {
      api.employees.get(id)
        .then((emp) => {
          setForm({
            employee_id: emp.employee_id || '',
            name: emp.name || '',
            designation: emp.designation || '',
            department: emp.department || '',
            business_unit: emp.business_unit || '',
            location: emp.location || '',
            email: emp.email || '',
            phone: emp.phone || '',
            bio: emp.bio || '',
            reporting_to: '',
          });
          setPhotoUrl(emp.photo_url || null);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = { ...form };
    if (payload.department === 'Other') {
      const custom = otherDepartment.trim();
      if (!custom) {
        setError('Please enter a department name under Other');
        setSubmitting(false);
        return;
      }
      payload.department = custom;
    }
    if (payload.reporting_to) {
      payload.reporting_to = Number(payload.reporting_to);
    } else {
      delete payload.reporting_to;
    }

    try {
      if (isEdit) {
        await api.employees.update(id, payload);
        navigate(`/employees/${id}`);
      } else {
        const result = await api.employees.create(payload);
        navigate('/success', { state: { employeeId: result.id, employeeName: result.name } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <BackButton to={isEdit ? `/employees/${id}` : '/employees'} label={isEdit ? 'Back to Profile' : 'Back to Employees'} />

      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        subtitle={isEdit ? 'Update employee information' : 'Create a new employee profile'}
      />

      <div className="card max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isEdit && (
            <PhotoUpload
              name={form.name}
              photoUrl={photoUrl}
              onUpload={async (file) => {
                const res = await api.employees.uploadPhoto(id, file);
                setPhotoUrl(res.photo_url);
                return res.photo_url;
              }}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
              <input name="employee_id" value={form.employee_id} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input name="name" value={form.name} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
              <input name="designation" value={form.designation} onChange={handleChange} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
                {form.department && !departments.some((d) => d.name === form.department) && (
                  <option value={form.department}>{form.department}</option>
                )}
              </select>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Add new department to your list"
                  className="input-field flex-1 min-w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDepartment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  disabled={addingDepartment}
                  className="btn-secondary text-sm whitespace-nowrap"
                >
                  {addingDepartment ? 'Adding...' : 'Add to list'}
                </button>
              </div>
              {isOtherDepartment && (
                <input
                  type="text"
                  value={otherDepartment}
                  onChange={(e) => setOtherDepartment(e.target.value)}
                  placeholder="Type your department name"
                  className="input-field mt-2"
                />
              )}
              {deptError && <p className="text-xs text-red-600 mt-1">{deptError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Unit</label>
              <input name="business_unit" value={form.business_unit} onChange={handleChange} className="input-field" list="businessUnits" />
              <datalist id="businessUnits">
                {filters.businessUnits.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input name="location" value={form.location} onChange={handleChange} className="input-field" list="locations" />
              <datalist id="locations">
                {filters.locations.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporting To</label>
              <select name="reporting_to" value={form.reporting_to} onChange={handleChange} className="input-field">
                <option value="">Select manager (optional)</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.designation}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className="input-field" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : isEdit ? 'Update Employee' : 'Save Employee'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
