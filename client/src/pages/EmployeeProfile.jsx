import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, Phone, MapPin, Building, Briefcase, Edit } from 'lucide-react';
import api from '../api/client';
import PhotoUpload from '../components/PhotoUpload';
import { BackButton, EmployeePhoto, LoadingSpinner, RELATIONSHIP_TYPES } from '../components/common';

export default function EmployeeProfile() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    api.employees.get(id)
      .then(setEmployee)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!employee) return <div className="text-center text-red-500 py-12">Employee not found</div>;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'projects', label: 'Projects' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div>
      <BackButton to="/employees" label="Back to Employees" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card text-center">
            <PhotoUpload
              name={employee.name}
              photoUrl={employee.photo_url}
              onUpload={async (file) => {
                const res = await api.employees.uploadPhoto(id, file);
                setEmployee((prev) => ({ ...prev, photo_url: res.photo_url }));
                return res.photo_url;
              }}
            />
            <h2 className="text-xl font-bold text-gray-900 mt-4">{employee.name}</h2>
            <p className="text-sm text-primary-600 font-medium">{employee.designation}</p>
            <p className="text-xs text-gray-500 mt-1">{employee.employee_id}</p>

            <Link to={`/employees/${id}/edit`} className="btn-secondary w-full mt-4 flex items-center justify-center gap-2">
              <Edit className="w-4 h-4" /> Edit Profile
            </Link>

            <nav className="mt-6 space-y-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          {tab === 'profile' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Personal & Professional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem icon={Mail} label="Email" value={employee.email} />
                <InfoItem icon={Phone} label="Phone" value={employee.phone} />
                <InfoItem icon={Building} label="Department" value={employee.department} />
                <InfoItem icon={Briefcase} label="Business Unit" value={employee.business_unit} />
                <InfoItem icon={MapPin} label="Location" value={employee.location} />
              </div>
              {employee.bio && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Bio</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{employee.bio}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'relationships' && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Reports To</h3>
                {employee.managers?.length > 0 ? (
                  <div className="space-y-3">
                    {employee.managers.map(m => (
                      <Link key={m.id} to={`/employees/${m.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                        <EmployeePhoto employee={m} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.designation}</p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                          {RELATIONSHIP_TYPES[m.relationship_type]?.label || m.relationship_type}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No managers assigned</p>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Direct Reports</h3>
                {employee.directReports?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {employee.directReports.map(r => (
                      <Link key={r.id} to={`/employees/${r.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                        <EmployeePhoto employee={r} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{r.name}</p>
                          <p className="text-xs text-gray-500">{r.designation}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No direct reports</p>
                )}
              </div>
            </div>
          )}

          {tab === 'projects' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Projects</h3>
              {employee.projects?.length > 0 ? (
                <div className="space-y-3">
                  {employee.projects.map(p => (
                    <div key={p.id} className="p-4 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{p.name}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.role && <p className="text-sm text-gray-500 mt-1">Role: {p.role}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No projects assigned</p>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              {employee.documents?.length > 0 ? (
                <div className="space-y-2">
                  {employee.documents.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <p className="text-sm font-medium">{d.title}</p>
                      <span className="text-xs text-gray-500">{d.doc_type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No documents uploaded</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
      </div>
    </div>
  );
}
