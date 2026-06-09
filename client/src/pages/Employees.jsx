import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Trash2, Edit, Users } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, Avatar, LoadingSpinner, EmptyState } from '../components/common';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.employees.list()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete employee "${name}"? This cannot be undone.`)) return;
    try {
      await api.employees.delete(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Employee Management"
        subtitle={`${employees.length} employees in the system`}
        action={
          <Link to="/employees/add" className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Employee
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Start by adding your first employee to the system."
          action={<Link to="/employees/add" className="btn-primary">Add Employee</Link>}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">ID</th>
                  <th className="px-6 py-3 font-medium">Designation</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <Link to={`/employees/${emp.id}`} className="flex items-center gap-3">
                        <Avatar name={emp.name} size="sm" />
                        <span className="font-medium text-gray-900 hover:text-primary-600">{emp.name}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{emp.employee_id}</td>
                    <td className="px-6 py-3 text-gray-600">{emp.designation}</td>
                    <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-6 py-3 text-gray-600">{emp.location}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/employees/${emp.id}/edit`} className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(emp.id, emp.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
