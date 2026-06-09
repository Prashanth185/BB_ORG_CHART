const API_ORIGIN = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

function getToken() {
  return localStorage.getItem('orms_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export const api = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    me: () => request('/auth/me'),
  },
  dashboard: {
    stats: () => request('/dashboard/stats'),
  },
  departments: {
    list: () => request('/departments'),
    create: (name) => request('/departments', { method: 'POST', body: JSON.stringify({ name }) }),
  },
  employees: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/employees${query ? `?${query}` : ''}`);
    },
    get: (id) => request(`/employees/${id}`),
    create: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
    filters: () => request('/employees/filters'),
    uploadPhoto: (id, file) => {
      const form = new FormData();
      form.append('photo', file);
      return request(`/upload/employees/${id}/photo`, { method: 'POST', body: form });
    },
  },
  chartLayout: {
    canvas: () => request('/chart-layout/canvas'),
    savePositions: (positions) => request('/chart-layout/positions', {
      method: 'PUT',
      body: JSON.stringify({ positions }),
    }),
    autoArrange: () => request('/chart-layout/auto-arrange', { method: 'POST' }),
    saveLineStyle: (relationshipId, style) => request(`/chart-layout/line-styles/${relationshipId}`, {
      method: 'PUT',
      body: JSON.stringify(style),
    }),
    saveLineWaypoints: (relationshipId, waypoints) => request(`/chart-layout/line-waypoints/${relationshipId}`, {
      method: 'PUT',
      body: JSON.stringify({ waypoints }),
    }),
    createRoutingSegment: (data) => request('/chart-layout/routing-segments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    splitRoutingSegment: (segmentId, point) => request(`/chart-layout/routing-segments/${segmentId}/split`, {
      method: 'POST',
      body: JSON.stringify({ point }),
    }),
    moveRoutingBreakpoint: (breakpointId, point) => request(`/chart-layout/routing-breakpoints/${breakpointId}`, {
      method: 'PUT',
      body: JSON.stringify(point),
    }),
    deleteRoutingBreakpoint: (breakpointId) => request(`/chart-layout/routing-breakpoints/${breakpointId}`, {
      method: 'DELETE',
    }),
    deleteRoutingSegment: (segmentId) => request(`/chart-layout/routing-segments/${segmentId}`, {
      method: 'DELETE',
    }),
    saveRoutingNetwork: (routingNetwork) => request('/chart-layout/routing-network', {
      method: 'PUT',
      body: JSON.stringify(routingNetwork),
    }),
    saveRoutingSegmentStyle: (segmentId, style) => request(`/chart-layout/routing-segments/${segmentId}/style`, {
      method: 'PUT',
      body: JSON.stringify(style),
    }),
    resetLineStyle: (relationshipId) => request(`/chart-layout/line-styles/${relationshipId}`, {
      method: 'DELETE',
    }),
    saveBoxStyle: (employeeId, style) => request(`/chart-layout/box-styles/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(style),
    }),
    resetBoxStyle: (employeeId) => request(`/chart-layout/box-styles/${employeeId}`, {
      method: 'DELETE',
    }),
    setCollapsed: (employeeId, collapsed) => request(`/chart-layout/collapsed/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ collapsed }),
    }),
    getSettings: () => request('/chart-layout/settings'),
    saveSettings: (settings) => request('/chart-layout/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  },
  relationships: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/relationships${query ? `?${query}` : ''}`);
    },
    create: (data) => request('/relationships', { method: 'POST', body: JSON.stringify(data) }),
    bulk: (relationships) => request('/relationships/bulk', { method: 'POST', body: JSON.stringify({ relationships }) }),
    update: (id, data) => request(`/relationships/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/relationships/${id}`, { method: 'DELETE' }),
  },
  orgChart: {
    hierarchy: (rootId) => request(`/org-chart/hierarchy${rootId ? `?root_id=${rootId}` : ''}`),
    chain: (startId) => request(`/org-chart/chain${startId ? `?start_id=${startId}` : ''}`),
    matrix: (employeeId) => request(`/org-chart/matrix${employeeId ? `?employee_id=${employeeId}` : ''}`),
    network: (centerId) => request(`/org-chart/network${centerId ? `?center_id=${centerId}` : ''}`),
    drillDown: (id) => request(`/org-chart/drill-down/${id}`),
  },
  reports: {
    spanOfControl: () => request('/reports/span-of-control'),
    departmentDistribution: () => request('/reports/department-distribution'),
    matrixReport: () => request('/reports/matrix-report'),
    locationReport: () => request('/reports/location-report'),
    export: (type) => request(`/reports/export?type=${type}`),
  },
  tradOrgChart: {
    listEmployees: () => request('/trad-org-chart/employees'),
    createEmployee: (data) => request('/trad-org-chart/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    deleteEmployee: (id) => request(`/trad-org-chart/employees/${id}`, { method: 'DELETE' }),
    hierarchy: () => request('/trad-org-chart/hierarchy'),
    getState: () => request('/trad-org-chart/state'),
    saveState: (state) => request('/trad-org-chart/state', {
      method: 'PUT',
      body: JSON.stringify(state),
    }),
    shareChart: (chartData) => request('/trad-org-chart/share', {
      method: 'POST',
      body: JSON.stringify({ chartData }),
    }),
    getSharedChart: (id) => request(`/trad-org-chart/share/${id}`),

    // ── Excel Import ──────────────────────────────────────────────────────
    importValidate: (file) => {
      const form = new FormData();
      form.append('file', file);
      return request('/trad-org-chart/import/validate', { method: 'POST', body: form });
    },
    importExecute: (file, mode = 'replace') => {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);
      return request('/trad-org-chart/import/execute', { method: 'POST', body: form });
    },
    importHistory: () => request('/trad-org-chart/import/history'),
    importRegenerate: (historyId) => request(`/trad-org-chart/import/regenerate/${historyId}`, { method: 'POST' }),

    // ── Chart Title ───────────────────────────────────────────────────────
    getTitle: () => request('/trad-org-chart/title'),
    saveTitle: (title) => request('/trad-org-chart/title', {
      method: 'PUT',
      body: JSON.stringify({ title }),
    }),

    // ── Line Style ────────────────────────────────────────────────────────
    getLineStyle: () => request('/trad-org-chart/line-style'),
    saveLineStyle: (color, thickness) => request('/trad-org-chart/line-style', {
      method: 'PUT',
      body: JSON.stringify({ color, thickness }),
    }),

    // ── Node Colors ───────────────────────────────────────────────────────
    getNodeColors: () => request('/trad-org-chart/node-colors'),
    saveNodeColor: (empId, color) => request(`/trad-org-chart/node-colors/${empId}`, {
      method: 'PUT',
      body: JSON.stringify({ color }),
    }),
    resetNodeColor: (empId) => request(`/trad-org-chart/node-colors/${empId}`, { method: 'DELETE' }),
  },
};

export const projects = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/projects${q ? `?${q}` : ''}`);
  },
  get: (pid) => request(`/projects/${pid}`),
  create: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  rename: (pid, name) => request(`/projects/${pid}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (pid) => request(`/projects/${pid}`, { method: 'DELETE' }),
  archive: (pid) => request(`/projects/${pid}/archive`, { method: 'PUT' }),
  duplicate: (pid) => request(`/projects/${pid}/duplicate`, { method: 'POST' }),

  // Manual chart (project-scoped)
  manual: {
    canvas: (pid) => request(`/projects/${pid}/manual/canvas`),
    saveNodes: (pid, nodes) => request(`/projects/${pid}/manual/nodes`, {
      method: 'PUT', body: JSON.stringify({ nodes }),
    }),
    deleteNode: (pid, nodeKey) => request(`/projects/${pid}/manual/nodes/${nodeKey}`, { method: 'DELETE' }),
    saveSettings: (pid, settings) => request(`/projects/${pid}/manual/settings`, {
      method: 'PUT', body: JSON.stringify(settings),
    }),
    saveLineStyle: (pid, ck, style) => request(`/projects/${pid}/manual/line-styles/${ck}`, {
      method: 'PUT', body: JSON.stringify(style),
    }),
    deleteLineStyle: (pid, ck) => request(`/projects/${pid}/manual/line-styles/${ck}`, { method: 'DELETE' }),
    setCollapsed: (pid, nk, collapsed) => request(`/projects/${pid}/manual/collapsed/${nk}`, {
      method: 'PUT', body: JSON.stringify({ collapsed }),
    }),
    saveRoutingNetwork: (pid, data) => request(`/projects/${pid}/manual/routing-network`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },

  // Traditional chart (project-scoped)
  trad: {
    listEmployees: (pid) => request(`/projects/${pid}/trad/employees`),
    createEmployee: (pid, data) => request(`/projects/${pid}/trad/employees`, {
      method: 'POST', body: JSON.stringify(data),
    }),
    deleteEmployee: (pid, id) => request(`/projects/${pid}/trad/employees/${id}`, { method: 'DELETE' }),
    hierarchy: (pid) => request(`/projects/${pid}/trad/hierarchy`),
    getState: (pid) => request(`/projects/${pid}/trad/state`),
    saveState: (pid, state) => request(`/projects/${pid}/trad/state`, {
      method: 'PUT', body: JSON.stringify(state),
    }),
    getTitle: (pid) => request(`/projects/${pid}/trad/title`),
    saveTitle: (pid, title) => request(`/projects/${pid}/trad/title`, {
      method: 'PUT', body: JSON.stringify({ title }),
    }),
    getLineStyle: (pid) => request(`/projects/${pid}/trad/line-style`),
    saveLineStyle: (pid, color, thickness) => request(`/projects/${pid}/trad/line-style`, {
      method: 'PUT', body: JSON.stringify({ color, thickness }),
    }),
    getNodeColors: (pid) => request(`/projects/${pid}/trad/node-colors`),
    saveNodeColor: (pid, empId, color) => request(`/projects/${pid}/trad/node-colors/${empId}`, {
      method: 'PUT', body: JSON.stringify({ color }),
    }),
    resetNodeColor: (pid, empId) => request(`/projects/${pid}/trad/node-colors/${empId}`, { method: 'DELETE' }),
    shareChart: (pid, chartData) => request(`/projects/${pid}/trad/share`, {
      method: 'POST', body: JSON.stringify({ chartData }),
    }),
    importExcel: (pid, file, mode = 'replace') => {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);
      return request(`/projects/${pid}/trad/import`, { method: 'POST', body: form });
    },
  },
};

export default api;
