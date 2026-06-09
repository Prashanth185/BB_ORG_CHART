import { Link, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import api from '../api/client';
import PhotoUpload from '../components/PhotoUpload';
import { BackButton } from '../components/common';

export default function Success() {
  const location = useLocation();
  const { employeeId, employeeName } = location.state || {};

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 p-4">
      <div className="max-w-md w-full mx-auto">
        <BackButton to="/dashboard" label="Back to Dashboard" />
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="card max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Saved Successfully!</h2>
        <p className="text-gray-500 mb-6">
          {employeeName ? `"${employeeName}" has been added to the system.` : 'Employee data has been saved.'}
        </p>
        {employeeId && (
          <div className="mb-6 pb-6 border-b border-gray-100">
            <PhotoUpload
              name={employeeName}
              onUpload={async (file) => {
                const res = await api.employees.uploadPhoto(employeeId, file);
                return res.photo_url;
              }}
            />
          </div>
        )}
        <div className="flex flex-col gap-3">
          {employeeId && (
            <Link to={`/employees/${employeeId}`} className="btn-primary">
              View Employee Profile
            </Link>
          )}
          <Link to="/employees/add" className="btn-secondary">Add Another Employee</Link>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:text-primary-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
