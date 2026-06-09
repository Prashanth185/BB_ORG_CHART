import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackButton({ to = '/dashboard', label = 'Back' }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-700 mb-4 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

export function Avatar({ name, size = 'md', className = '' }) {
  const initials = name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const colorIndex = name ? name.charCodeAt(0) % COLORS.length : 0;
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' };

  return (
    <div className={`${sizes[size]} ${COLORS[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

export function EmployeePhoto({ employee, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  if (employee?.photo_url) {
    return (
      <img
        src={employee.photo_url}
        alt={employee.name}
        className={`${sizes[size]} rounded-full object-cover border-2 border-white shadow-sm`}
      />
    );
  }
  return <Avatar name={employee?.name} size={size} />;
}

const LEVEL_ACCENTS = [
  '#AC193D',
  '#2672EC',
  '#8C0095',
  '#5133AB',
  '#008299',
  '#D24726',
  '#008A00',
  '#094AB2',
];

function OrgTemplateCard({ employee, onClick, compact, customStyle, level = 0 }) {
  const s = customStyle || {};
  const accent = s.accent_color || LEVEL_ACCENTS[level % LEVEL_ACCENTS.length];
  const dept = employee.department || 'Dept';
  const title = employee.designation || 'Title';

  return (
    <div
      onClick={onClick}
      className={`h-full w-full overflow-hidden rounded-lg bg-white text-left shadow-lg border border-gray-200 select-none ${onClick ? 'cursor-pointer hover:shadow-xl' : ''} ${compact ? 'min-w-[220px]' : 'min-w-[240px]'}`}
      style={{
        background: s.bg_color_top || '#ffffff',
        borderColor: s.bg_color_bottom || '#e5e7eb',
      }}
    >
      <div className="flex h-full">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} />
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{
                    color: s.name_color || '#111827',
                    fontSize: s.name_font_size || 13,
                    fontWeight: s.name_font_weight || 600,
                  }}
                  title={employee.name}
                >
                  {employee.name}
                </p>
                <span
                  className="max-w-[64px] truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: s.dept_color || '#15803d',
                    backgroundColor: '#f0fdf4',
                    borderColor: '#bbf7d0',
                  }}
                  title={dept}
                >
                  {dept}
                </span>
              </div>
              <p
                className="mt-1 line-clamp-2 text-xs leading-snug"
                style={{ color: s.title_color || '#6b7280', fontSize: s.title_font_size || 12 }}
                title={title}
              >
                {title}
              </p>
              {employee.employee_id && (
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {employee.employee_id}
                </p>
              )}
            </div>
            <EmployeePhoto employee={employee} size="md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeCard({ employee, onClick, compact = false, variant = 'standard', customStyle = null, level = 0 }) {
  if (variant === 'professional') {
    return (
      <OrgTemplateCard
        employee={employee}
        onClick={onClick}
        compact={compact}
        customStyle={customStyle}
        level={level}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''} ${compact ? 'min-w-[140px]' : 'min-w-[180px]'}`}
    >
      <div className="flex justify-center mb-2">
        <EmployeePhoto employee={employee} size={compact ? 'sm' : 'md'} />
      </div>
      <p className="font-semibold text-sm text-gray-900 truncate">{employee.name}</p>
      <p className="text-xs text-gray-500 truncate">{employee.designation}</p>
      {employee.department && (
        <p className="text-xs text-primary-600 mt-1 truncate">{employee.department}</p>
      )}
    </div>
  );
}

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const RELATIONSHIP_TYPES = {
  reports_to: { label: 'Reports To', color: '#2563eb', dash: false },
  functional: { label: 'Functional Reporting', color: '#059669', dash: true },
  project: { label: 'Project Reporting', color: '#d97706', dash: true },
  collaboration: { label: 'Collaboration', color: '#7c3aed', dash: true },
};
