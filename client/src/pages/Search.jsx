import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import api from '../api/client';
import { BackButton, PageHeader, Avatar, LoadingSpinner } from '../components/common';

export default function Search() {
  const [filters, setFilters] = useState({ departments: [], locations: [], designations: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState({
    search: '', department: '', location: '', designation: '',
  });

  useEffect(() => {
    api.employees.filters().then(setFilters).catch(console.error);
    performSearch({});
  }, []);

  const performSearch = async (params) => {
    setLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v)
      );
      const data = await api.employees.list(cleanParams);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const updated = { ...query, [e.target.name]: e.target.value };
    setQuery(updated);
    performSearch(updated);
  };

  const handleReset = () => {
    const empty = { search: '', department: '', location: '', designation: '' };
    setQuery(empty);
    performSearch(empty);
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Advanced Search & Filter"
        subtitle="Find employees across your organization"
      />

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                name="search"
                value={query.search}
                onChange={handleChange}
                placeholder="Name, ID, email, designation..."
                className="input-field pl-9"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select name="department" value={query.department} onChange={handleChange} className="input-field">
              <option value="">All Departments</option>
              {filters.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select name="location" value={query.location} onChange={handleChange} className="input-field">
              <option value="">All Locations</option>
              {filters.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <select name="designation" value={query.designation} onChange={handleChange} className="input-field">
              <option value="">All Designations</option>
              {filters.designations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleReset} className="btn-secondary text-sm">Reset Filters</button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Results</h3>
          <span className="text-sm text-gray-500">{results.length} employee{results.length !== 1 ? 's' : ''} found</span>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : results.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No employees match your search criteria</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(emp => (
              <Link
                key={emp.id}
                to={`/employees/${emp.id}`}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
              >
                <Avatar name={emp.name} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                  <p className="text-sm text-gray-500 truncate">{emp.designation}</p>
                  <div className="flex gap-2 mt-1">
                    {emp.department && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{emp.department}</span>
                    )}
                    {emp.location && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{emp.location}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
