import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Network, Search, BarChart3,
  LogOut, Menu, X, Building2, UserPlus, FolderPlus, FolderOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NewProjectModal from './NewProjectModal';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'My Projects' },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/employees/add', icon: UserPlus, label: 'Add Employee' },
  { to: '/relationships', icon: GitBranch, label: 'Relationships' },
  { to: '/org-chart', icon: Network, label: 'Org Chart' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-primary-900 text-white transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-800">
          <Building2 className="w-8 h-8 text-primary-300" />
          <div>
            <h1 className="font-bold text-lg leading-tight">ORMS</h1>
            <p className="text-xs text-primary-300">Org Relationship Management</p>
          </div>
          <button className="lg:hidden ml-auto" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {/* New Project button — opens project type selector */}
          <button
            type="button"
            onClick={() => { setSidebarOpen(false); setShowNewProjectModal(true); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold w-full transition-colors bg-primary-600 text-white hover:bg-primary-500 mb-3"
          >
            <FolderPlus className="w-5 h-5" />
            New Project
          </button>

          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-800">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="font-medium">{user?.username}</p>
              <p className="text-primary-300 text-xs capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary-200 hover:text-white hover:bg-primary-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="font-semibold text-gray-800">ORMS</h2>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* New Project type-selector modal */}
      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}
    </div>
  );
}
