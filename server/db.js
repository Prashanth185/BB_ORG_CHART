import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'orms.db');

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS business_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    city TEXT,
    country TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    designation TEXT,
    department_id INTEGER REFERENCES departments(id),
    business_unit_id INTEGER REFERENCES business_units(id),
    location_id INTEGER REFERENCES locations(id),
    email TEXT,
    phone TEXT,
    photo_url TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'reports_to',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, manager_id, relationship_type)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS employee_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT,
    UNIQUE(employee_id, project_id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT,
    doc_type TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chart_positions (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    pos_x REAL NOT NULL DEFAULT 0,
    pos_y REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chart_line_edits (
    relationship_id INTEGER PRIMARY KEY REFERENCES relationships(id) ON DELETE CASCADE,
    color TEXT,
    width INTEGER,
    line_type TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chart_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chart_box_styles (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    name_color TEXT DEFAULT '#facc15',
    title_color TEXT DEFAULT '#ffffff',
    dept_color TEXT DEFAULT '#f87171',
    name_font_size INTEGER DEFAULT 14,
    title_font_size INTEGER DEFAULT 12,
    name_font_weight TEXT DEFAULT 'bold',
    bg_color_top TEXT DEFAULT '#5a6578',
    bg_color_bottom TEXT DEFAULT '#2a3140',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chart_collapsed (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    collapsed INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS chart_breakpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pos_x REAL NOT NULL,
    pos_y REAL NOT NULL,
    parent_breakpoint_id INTEGER REFERENCES chart_breakpoints(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'breakpoint',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chart_line_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_breakpoint_id INTEGER REFERENCES chart_breakpoints(id) ON DELETE CASCADE,
    from_employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    from_anchor TEXT,
    from_x REAL,
    from_y REAL,
    to_breakpoint_id INTEGER NOT NULL REFERENCES chart_breakpoints(id) ON DELETE CASCADE,
    parent_breakpoint_id INTEGER REFERENCES chart_breakpoints(id) ON DELETE SET NULL,
    direction TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (from_breakpoint_id IS NOT NULL OR from_employee_id IS NOT NULL OR (from_x IS NOT NULL AND from_y IS NOT NULL))
  );
`);

// ── Traditional Org Chart tables (completely isolated from manual chart) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS trad_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    manager_id INTEGER REFERENCES trad_employees(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_chart_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_shared_charts (
    id TEXT PRIMARY KEY,
    chart_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_import_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    imported_by TEXT,
    total_employees INTEGER NOT NULL DEFAULT 0,
    root_count INTEGER NOT NULL DEFAULT 0,
    relationship_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_node_colors (
    employee_id INTEGER PRIMARY KEY REFERENCES trad_employees(id) ON DELETE CASCADE,
    color TEXT NOT NULL DEFAULT '#2563eb',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_line_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    color TEXT NOT NULL DEFAULT '#94a3b8',
    thickness INTEGER NOT NULL DEFAULT 2,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trad_chart_title (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    title TEXT NOT NULL DEFAULT 'Traditional Org Chart',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Multi-Project Management Tables ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS org_chart_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('manual', 'traditional')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Manual Org Chart project-scoped tables
  CREATE TABLE IF NOT EXISTS proj_chart_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    employee_label TEXT NOT NULL,
    pos_x REAL NOT NULL DEFAULT 0,
    pos_y REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, employee_label)
  );

  CREATE TABLE IF NOT EXISTS proj_chart_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    label TEXT NOT NULL,
    pos_x REAL NOT NULL DEFAULT 0,
    pos_y REAL NOT NULL DEFAULT 0,
    bg_color_top TEXT DEFAULT '#5a6578',
    bg_color_bottom TEXT DEFAULT '#2a3140',
    name_color TEXT DEFAULT '#facc15',
    title_color TEXT DEFAULT '#ffffff',
    dept_color TEXT DEFAULT '#f87171',
    name_font_size INTEGER DEFAULT 14,
    title_font_size INTEGER DEFAULT 12,
    name_font_weight TEXT DEFAULT 'bold',
    name TEXT DEFAULT '',
    designation TEXT DEFAULT '',
    department TEXT DEFAULT '',
    photo_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, node_key)
  );

  CREATE TABLE IF NOT EXISTS proj_chart_settings (
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (project_id, key)
  );

  CREATE TABLE IF NOT EXISTS proj_chart_breakpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    pos_x REAL NOT NULL,
    pos_y REAL NOT NULL,
    parent_breakpoint_id INTEGER REFERENCES proj_chart_breakpoints(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'breakpoint',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proj_chart_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    from_breakpoint_id INTEGER REFERENCES proj_chart_breakpoints(id) ON DELETE CASCADE,
    from_node_key TEXT,
    from_anchor TEXT,
    from_x REAL,
    from_y REAL,
    to_breakpoint_id INTEGER NOT NULL REFERENCES proj_chart_breakpoints(id) ON DELETE CASCADE,
    parent_breakpoint_id INTEGER REFERENCES proj_chart_breakpoints(id) ON DELETE SET NULL,
    direction TEXT,
    color TEXT,
    width REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proj_chart_line_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    connection_key TEXT NOT NULL,
    color TEXT,
    width INTEGER,
    line_type TEXT,
    waypoints TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, connection_key)
  );

  CREATE TABLE IF NOT EXISTS proj_chart_collapsed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    collapsed INTEGER NOT NULL DEFAULT 1,
    UNIQUE(project_id, node_key)
  );

  -- Traditional Org Chart project-scoped tables
  CREATE TABLE IF NOT EXISTS proj_trad_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    manager_id INTEGER REFERENCES proj_trad_employees(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, employee_id)
  );

  CREATE TABLE IF NOT EXISTS proj_trad_chart_state (
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, key)
  );

  CREATE TABLE IF NOT EXISTS proj_trad_shared_charts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    chart_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proj_trad_node_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    employee_db_id INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT '#2563eb',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, employee_db_id)
  );

  CREATE TABLE IF NOT EXISTS proj_trad_line_styles (
    project_id TEXT PRIMARY KEY REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    color TEXT NOT NULL DEFAULT '#94a3b8',
    thickness INTEGER NOT NULL DEFAULT 2,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proj_trad_chart_title (
    project_id TEXT PRIMARY KEY REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Traditional Org Chart',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proj_trad_import_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES org_chart_projects(project_id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    imported_by TEXT,
    total_employees INTEGER NOT NULL DEFAULT 0,
    root_count INTEGER NOT NULL DEFAULT 0,
    relationship_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE chart_line_edits ADD COLUMN waypoints TEXT');
} catch {
  /* column already exists */
}

try {
  db.exec('ALTER TABLE chart_line_segments ADD COLUMN color TEXT');
} catch {
  /* column already exists */
}

try {
  db.exec('ALTER TABLE chart_line_segments ADD COLUMN width REAL');
} catch {
  /* column already exists */
}

db.transaction = function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
};

export default db;
