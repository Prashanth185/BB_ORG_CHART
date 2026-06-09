import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building, MapPin, Briefcase, UserPlus, Network, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import api from '../api/client';
import { PageHeader, LoadingSpinner } from '../components/common';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#4f46e5'];

const statIcons = {
  employees: Users,
  departments: Building,
  businessUnits: Briefcase,
  locations: MapPin,
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (!stats) return <div className="text-center text-red-500 py-12">Failed to load dashboard</div>;

  const statCards = [
    { key: 'employees', label: 'Total Employees', value: stats.totalEmployees, icon: statIcons.employees, color: 'bg-blue-500' },
    { key: 'departments', label: 'Departments', value: stats.totalDepartments, icon: statIcons.departments, color: 'bg-emerald-500' },
    { key: 'businessUnits', label: 'Business Units', value: stats.totalBusinessUnits, icon: statIcons.businessUnits, color: 'bg-violet-500' },
    { key: 'locations', label: 'Locations', value: stats.totalLocations, icon: statIcons.locations, color: 'bg-amber-500' },
  ];

  const quickActions = [
    { to: '/employees/add', icon: UserPlus, label: 'Add Employee', desc: 'Create new employee profile' },
    { to: '/relationships', icon: Network, label: 'Define Relationships', desc: 'Set reporting lines' },
    { to: '/org-chart', icon: Network, label: 'View Org Chart', desc: 'Visualize structure' },
    { to: '/reports', icon: FileText, label: 'Generate Reports', desc: 'Export analytics' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your organization" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ key, label, value, icon: Icon, color }) => (
          <div key={key} className="stat-card">
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Employees by Department</h3>
          {stats.employeesByDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.employeesByDepartment}
                  dataKey="count"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {stats.employeesByDepartment.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No department data available</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {quickActions.map(({ to, icon: Icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-primary-50 hover:border-primary-200 transition-colors"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {stats.recentEmployees.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Added Employees</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 font-medium">Employee ID</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Designation</th>
                  <th className="pb-3 font-medium">Department</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-primary-600">
                      <Link to={`/employees/${emp.id}`}>{emp.employee_id}</Link>
                    </td>
                    <td className="py-3 font-medium">{emp.name}</td>
                    <td className="py-3 text-gray-600">{emp.designation}</td>
                    <td className="py-3 text-gray-600">{emp.department}</td>
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
