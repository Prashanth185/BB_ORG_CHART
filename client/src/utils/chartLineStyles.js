import { RELATIONSHIP_TYPES } from '../components/common';

export const LINE_TYPES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

export const LINE_WIDTHS = [1, 2, 3, 4, 5, 6];

export const DRAW_LINE_COLORS = [
  { id: 'blue', label: 'Blue', value: '#2563eb' },
  { id: 'green', label: 'Green', value: '#059669' },
  { id: 'red', label: 'Red', value: '#dc2626' },
  { id: 'orange', label: 'Orange', value: '#ea580c' },
  { id: 'purple', label: 'Purple', value: '#7c3aed' },
  { id: 'black', label: 'Black', value: '#0f172a' },
  { id: 'gray', label: 'Gray', value: '#64748b' },
];

export const DRAW_LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10];

export const DEFAULT_DRAW_LINE_COLOR = '#2563eb';
export const DEFAULT_DRAW_LINE_WIDTH = 2;
export const DEFAULT_ROUTING_SEGMENT_COLOR = '#d7dbe0';
export const DEFAULT_ROUTING_SEGMENT_WIDTH = 1.4;

export const LINE_COLOR_PRESETS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#64748b', '#0f172a',
];

export const DEFAULT_LINE_SETTINGS = {
  color: '#2563eb',
  width: 2,
  lineType: 'solid',
  useTypeColors: true,
  routingType: 'orthogonal',
};

export function getDashArray(lineType) {
  if (lineType === 'dashed') return '8,4';
  if (lineType === 'dotted') return '2,3';
  return undefined;
}

export function getConnectorStyle(relationshipType, settings = DEFAULT_LINE_SETTINGS) {
  const color = settings.useTypeColors && relationshipType
    ? (RELATIONSHIP_TYPES[relationshipType]?.color ?? settings.color)
    : settings.color;

  return {
    color,
    width: settings.width,
    dash: getDashArray(settings.lineType),
    backgroundColor: color,
  };
}

export function connectorClass(settings) {
  return {
    backgroundColor: settings.useTypeColors ? undefined : settings.color,
    width: settings.lineType === 'solid' ? undefined : undefined,
  };
}
