import { X, MousePointer2, GitBranch, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * NewProjectModal
 * Shown when user clicks "New Project" in the sidebar.
 * Options:
 *   A) Go to My Projects → navigate to /projects (full project management)
 *   B) Manual Org Chart  → navigate to /org-chart (existing singleton, unchanged)
 *   C) Traditional Org Chart → navigate to /traditional-org-chart (unchanged)
 */
export default function NewProjectModal({ onClose }) {
  const navigate = useNavigate();

  const handleGoToProjects = () => {
    onClose();
    navigate('/projects');
  };

  const handleManual = () => {
    onClose();
    navigate('/org-chart');
  };

  const handleTraditional = () => {
    onClose();
    navigate('/traditional-org-chart');
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">New Project</h2>
        <p className="text-sm text-gray-500 mb-6">Create a new org chart project or manage all your existing ones.</p>

        {/* Go to My Projects */}
        <button
          type="button"
          onClick={handleGoToProjects}
          className="group flex items-center gap-4 w-full p-5 rounded-xl border-2 border-primary-200 bg-primary-50 hover:border-primary-500 hover:bg-primary-100 transition-all text-left mb-4"
        >
          <div className="w-12 h-12 bg-primary-200 group-hover:bg-primary-300 rounded-xl flex items-center justify-center transition-colors shrink-0">
            <FolderOpen className="w-6 h-6 text-primary-700" />
          </div>
          <div>
            <p className="font-semibold text-primary-900 text-base mb-0.5">My Projects (Recommended)</p>
            <p className="text-xs text-primary-600 leading-relaxed">
              Create and manage unlimited named projects — GCC May 2026, EDC Team, HR Department, etc. Full project dashboard with search, duplicate, archive and more.
            </p>
          </div>
        </button>

        <p className="text-xs text-gray-400 text-center mb-3">— or open the single legacy chart directly —</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A – Manual Org Chart (legacy singleton) */}
          <button
            type="button"
            onClick={handleManual}
            className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
          >
            <div className="w-10 h-10 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center transition-colors">
              <MousePointer2 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5">Manual Org Chart</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Drag &amp; drop canvas (single chart)
              </p>
            </div>
          </button>

          {/* Option B – Traditional Org Chart (legacy singleton) */}
          <button
            type="button"
            onClick={handleTraditional}
            className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left"
          >
            <div className="w-10 h-10 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center transition-colors">
              <GitBranch className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5">Traditional Org Chart</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Auto hierarchy (single chart)
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
