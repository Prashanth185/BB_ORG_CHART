import { useNavigate } from 'react-router-dom';
import { EmployeeCard } from './common';
import { getConnectorStyle, DEFAULT_LINE_SETTINGS } from '../utils/chartLineStyles';

function VerticalLine({ height = 24, relationshipType, lineSettings }) {
  const style = getConnectorStyle(relationshipType, lineSettings);
  return (
    <div
      style={{
        width: style.width,
        height,
        backgroundColor: style.color,
        margin: '0 auto',
        borderRadius: 1,
        opacity: 0.85,
      }}
    />
  );
}

function HorizontalLine({ width = 32, relationshipType, lineSettings }) {
  const style = getConnectorStyle(relationshipType, lineSettings);
  return (
    <div
      style={{
        width,
        height: style.width,
        backgroundColor: style.color,
        opacity: 0.85,
      }}
    />
  );
}

function ArrowHead({ relationshipType, lineSettings }) {
  const style = getConnectorStyle(relationshipType, lineSettings);
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent',
        borderLeft: `8px solid ${style.color}`,
      }}
    />
  );
}

function TreeNode({ node, onDrillDown, level = 0, lineSettings }) {
  const navigate = useNavigate();

  if (!node) return null;

  const relType = node.relationship_type || 'reports_to';

  const handleClick = () => {
    if (onDrillDown) onDrillDown(node);
    else navigate(`/employees/${node.id}`);
  };

  return (
    <div className="flex flex-col items-center">
      <EmployeeCard employee={node} onClick={handleClick} compact={level > 1} />
      {node.children?.length > 0 && (
        <>
          <VerticalLine relationshipType={relType} lineSettings={lineSettings} />
          <div className="relative flex gap-4 pt-0">
            {node.children.length > 1 && (
              <div
                className="absolute top-0"
                style={{
                  left: `${100 / (node.children.length * 2)}%`,
                  right: `${100 / (node.children.length * 2)}%`,
                  height: getConnectorStyle(relType, lineSettings).width,
                  backgroundColor: getConnectorStyle(relType, lineSettings).color,
                }}
              />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <VerticalLine relationshipType={child.relationship_type || 'reports_to'} lineSettings={lineSettings} />
                <TreeNode node={child} onDrillDown={onDrillDown} level={level + 1} lineSettings={lineSettings} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function HierarchyChart({ data, onDrillDown, lineSettings = DEFAULT_LINE_SETTINGS }) {
  if (!data) return <p className="text-gray-500 text-center py-8">No hierarchy data</p>;

  const trees = Array.isArray(data) ? data : [data];

  return (
    <div className="overflow-x-auto py-6 bg-white">
      <div className="flex flex-col items-center gap-12 min-w-max px-8">
        {trees.map((tree, i) => (
          <TreeNode key={tree?.id || i} node={tree} onDrillDown={onDrillDown} lineSettings={lineSettings} />
        ))}
      </div>
    </div>
  );
}

export function ChainChart({ chains, lineSettings = DEFAULT_LINE_SETTINGS }) {
  if (!chains || chains.length === 0) {
    return <p className="text-gray-500 text-center py-8">No chain data available</p>;
  }

  const chainList = Array.isArray(chains[0]) ? chains : [chains];

  return (
    <div className="space-y-8 py-6 bg-white">
      {chainList.map((chain, ci) => (
        <div key={ci} className="overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max px-4">
            {chain.map((emp, i) => (
              <div key={emp.id} className="flex items-center">
                <EmployeeCard employee={emp} compact />
                {i < chain.length - 1 && (
                  <div className="flex items-center mx-1">
                    <HorizontalLine relationshipType="reports_to" lineSettings={lineSettings} />
                    <ArrowHead relationshipType="reports_to" lineSettings={lineSettings} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MatrixChart({ data, lineSettings = DEFAULT_LINE_SETTINGS }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-8">No matrix reporting relationships found</p>;
  }

  return (
    <div className="space-y-6 py-4 bg-white">
      {data.map(({ employee, managers }) => (
        <div key={employee.id} className="border border-gray-100 rounded-xl p-4">
          <div className="flex flex-col items-center mb-4">
            <EmployeeCard employee={employee} />
          </div>
          <div className="relative">
            <div className="flex justify-center">
              <VerticalLine height={16} relationshipType="reports_to" lineSettings={lineSettings} />
            </div>
            <div className="flex justify-center gap-2 pt-0 flex-wrap">
              {managers.map((mgr) => {
                const style = getConnectorStyle(mgr.relationship_type, lineSettings);
                return (
                  <div key={mgr.id} className="flex flex-col items-center">
                    <div
                      style={{
                        width: style.width,
                        height: 16,
                        backgroundColor: style.color,
                        borderLeft: style.dash ? `${style.width}px dashed ${style.color}` : undefined,
                        background: style.dash ? 'transparent' : style.color,
                      }}
                    />
                    <EmployeeCard employee={mgr} compact />
                    <span className="text-[10px] mt-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">
                      {mgr.relationship_type?.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NetworkChart({ data, lineSettings = DEFAULT_LINE_SETTINGS }) {
  if (!data?.center) return <p className="text-gray-500 text-center py-8">No network data</p>;

  const { center, nodes, edges } = data;
  const otherNodes = nodes.filter(n => !n.isCenter);
  const angleStep = (2 * Math.PI) / Math.max(otherNodes.length, 1);
  const radius = 180;

  return (
    <div className="relative py-8 bg-white" style={{ minHeight: '450px' }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '450px' }}>
        {edges.map(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;

          const sIdx = otherNodes.findIndex(n => n.id === source.id);
          const tIdx = otherNodes.findIndex(n => n.id === edge.target);

          let sx, sy, tx, ty;

          if (source.isCenter) {
            sx = '50%'; sy = '50%';
            const angle = angleStep * tIdx - Math.PI / 2;
            tx = `${50 + Math.cos(angle) * 35}%`;
            ty = `${50 + Math.sin(angle) * 35}%`;
          } else if (target.isCenter) {
            tx = '50%'; ty = '50%';
            const angle = angleStep * sIdx - Math.PI / 2;
            sx = `${50 + Math.cos(angle) * 35}%`;
            sy = `${50 + Math.sin(angle) * 35}%`;
          } else {
            const sAngle = angleStep * sIdx - Math.PI / 2;
            const tAngle = angleStep * tIdx - Math.PI / 2;
            sx = `${50 + Math.cos(sAngle) * 35}%`;
            sy = `${50 + Math.sin(sAngle) * 35}%`;
            tx = `${50 + Math.cos(tAngle) * 35}%`;
            ty = `${50 + Math.sin(tAngle) * 35}%`;
          }

          const style = getConnectorStyle(edge.type, lineSettings);

          return (
            <line
              key={edge.id}
              x1={sx} y1={sy} x2={tx} y2={ty}
              stroke={style.color}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              opacity={0.75}
            />
          );
        })}
      </svg>

      <div className="relative flex items-center justify-center" style={{ minHeight: '450px' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="ring-4 ring-primary-200 rounded-lg">
            <EmployeeCard employee={center} />
          </div>
        </div>

        {otherNodes.map((node, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <div
              key={node.id}
              className="absolute z-10"
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, top: '50%', left: '50%' }}
            >
              <EmployeeCard employee={node} compact />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DrillDownPanel({ data, onBack, backLabel = '← Back', onDrill, lineSettings = DEFAULT_LINE_SETTINGS }) {
  if (!data) return null;

  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-4 mb-6">
        {onBack && (
          <button type="button" onClick={onBack} className="btn-secondary text-sm inline-flex items-center gap-1">
            {backLabel}
          </button>
        )}
        <div>
          <h3 className="font-semibold text-lg">{data.employee.name}</h3>
          <p className="text-sm text-gray-500">{data.employee.designation}</p>
        </div>
      </div>

      {data.managers?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Reports To</p>
          <div className="flex gap-2 flex-wrap items-end">
            {data.managers.map(m => (
              <div key={m.id} className="flex flex-col items-center">
                <VerticalLine height={12} relationshipType={m.relationship_type} lineSettings={lineSettings} />
                <EmployeeCard employee={m} onClick={() => onDrill(m.id)} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
        Direct Reports ({data.directReports?.length || 0})
      </p>
      {data.directReports?.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {data.directReports.map(r => (
            <div key={r.id} onClick={() => onDrill(r.id)} className="cursor-pointer">
              <EmployeeCard employee={r} compact />
              {r.report_count > 0 && (
                <p className="text-[10px] text-center text-primary-600 mt-1">{r.report_count} reports</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No direct reports</p>
      )}
    </div>
  );
}
