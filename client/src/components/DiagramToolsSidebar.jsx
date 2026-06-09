import { useState } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  GitFork,
  Minus,
  MousePointer2,
  PenLine,
  Square,
  Triangle,
} from 'lucide-react';
import { CONNECTOR_ROUTING_OPTIONS } from '../utils/connectorRouting';

const SYMBOL_GROUPS = [
  {
    id: 'containers',
    label: 'Containers',
    items: [
      { label: 'Swimlane', icon: Boxes },
      { label: 'Frame', icon: Square },
      { label: 'Section', icon: MousePointer2 },
    ],
  },
  {
    id: 'flowchart',
    label: 'Flowchart Shapes',
    items: [
      { label: 'Process', icon: Square },
      { label: 'Decision', icon: GitFork },
      { label: 'Terminator', icon: Circle },
      { label: 'Data', icon: Triangle },
    ],
  },
  {
    id: 'recent',
    label: 'Recently Used Symbols',
    items: [
      { label: 'Employee Box', icon: Square },
      { label: 'Connector', icon: PenLine },
      { label: 'Divider', icon: Minus },
    ],
  },
];

export default function DiagramToolsSidebar({ collapsed, onToggle, routingType, onRoutingChange }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(['containers', 'flowchart', 'recent']));
  const selectedLabel = CONNECTOR_ROUTING_OPTIONS.find((item) => item.id === routingType)?.label || 'Shape Connector';

  const toggleGroup = (id) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-3">
        <button
          type="button"
          onClick={onToggle}
          className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:text-primary-700"
          title="Expand tools"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <PenLine className="mt-4 h-5 w-5 text-primary-600" />
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Tools</h3>
          <p className="text-[11px] text-gray-500">Diagram palette</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:text-primary-700"
          title="Collapse tools"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-700">Line</label>
          <select
            value={routingType}
            onChange={(e) => onRoutingChange(e.target.value)}
            className="input-field bg-white"
          >
            {CONNECTOR_ROUTING_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-medium text-gray-500">{selectedLabel}</p>
            <svg className="h-10 w-full" viewBox="0 0 180 40" preserveAspectRatio="none">
              <path d={previewPath(routingType)} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          {SYMBOL_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.id);
            return (
              <section key={group.id} className="rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700"
                >
                  {group.label}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-2">
                    {group.items.map(({ label, icon: Icon }) => (
                      <button
                        type="button"
                        key={label}
                        className="flex min-h-16 flex-col items-center justify-center rounded-md border border-gray-100 bg-gray-50 px-2 py-2 text-[11px] text-gray-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                        title={label}
                      >
                        <Icon className="mb-1 h-5 w-5" />
                        <span className="text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function previewPath(routingType) {
  if (routingType === 'straight') return 'M 10 30 L 170 10';
  if (routingType === 'curved') return 'M 10 30 C 70 4, 110 36, 170 10';
  if (routingType === 'polygon') return 'M 10 30 L 70 12 L 120 28 L 170 10';
  if (routingType === 'curvedConnector') return 'M 10 30 C 80 30, 90 10, 170 10';
  return 'M 10 30 L 80 30 L 80 10 L 170 10';
}
