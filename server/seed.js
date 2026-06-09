import bcrypt from 'bcryptjs';
import db from './db.js';

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Created admin user (username: admin, password: admin123)');
  }

  const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
  const defaultDepts = [
    'Executive', 'Engineering', 'Operations', 'Finance', 'HR',
    'Academics', 'Training', 'IT', 'Other',
  ];
  defaultDepts.forEach((d) => insertDept.run(d));

  const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get().c;
  if (empCount > 0) {
    console.log('Database already seeded');
    return;
  }

  const insertBu = db.prepare('INSERT OR IGNORE INTO business_units (name) VALUES (?)');
  const insertLoc = db.prepare('INSERT OR IGNORE INTO locations (name, city, country) VALUES (?, ?, ?)');

  const bus = ['Corporate', 'Technology', 'Education', 'Infrastructure'];
  bus.forEach(b => insertBu.run(b));

  const locs = [
    ['London HQ', 'London', 'UK'],
    ['Manchester', 'Manchester', 'UK'],
    ['Birmingham', 'Birmingham', 'UK'],
    ['Edinburgh', 'Edinburgh', 'UK'],
  ];
  locs.forEach(l => insertLoc.run(...l));

  const getDept = (name) => db.prepare('SELECT id FROM departments WHERE name = ?').get(name).id;
  const getBu = (name) => db.prepare('SELECT id FROM business_units WHERE name = ?').get(name).id;
  const getLoc = (name) => db.prepare('SELECT id FROM locations WHERE name = ?').get(name).id;

  const insertEmp = db.prepare(`
    INSERT INTO employees (employee_id, name, designation, department_id, business_unit_id, location_id, email, phone, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const employees = [
    ['EMP001', 'James Richardson', 'CEO', 'Executive', 'Corporate', 'London HQ', 'j.richardson@company.com', '+44 20 1234 5678', 'Chief Executive Officer leading global operations.'],
    ['EMP002', 'Sarah Mitchell', 'VP Engineering', 'Engineering', 'Technology', 'London HQ', 's.mitchell@company.com', '+44 20 1234 5679', 'Oversees all engineering divisions.'],
    ['EMP003', 'David Chen', 'VP Operations', 'Operations', 'Corporate', 'Manchester', 'd.chen@company.com', '+44 161 1234 5678', 'Manages operational excellence.'],
    ['EMP004', 'Emily Watson', 'VP Finance', 'Finance', 'Corporate', 'London HQ', 'e.watson@company.com', '+44 20 1234 5680', 'Head of financial strategy.'],
    ['EMP005', 'Michael Brown', 'Engineering Manager', 'Engineering', 'Technology', 'London HQ', 'm.brown@company.com', '+44 20 1234 5681', 'Leads software development teams.'],
    ['EMP006', 'Lisa Anderson', 'Engineering Manager', 'Engineering', 'Technology', 'Birmingham', 'l.anderson@company.com', '+44 121 1234 5678', 'Manages infrastructure engineering.'],
    ['EMP007', 'Robert Taylor', 'Senior Developer', 'Engineering', 'Technology', 'London HQ', 'r.taylor@company.com', '+44 20 1234 5682', 'Full-stack developer.'],
    ['EMP008', 'Jennifer Lee', 'Senior Developer', 'Engineering', 'Technology', 'London HQ', 'j.lee@company.com', '+44 20 1234 5683', 'Backend specialist.'],
    ['EMP009', 'Academic Head', 'Academic Head', 'Academics', 'Education', 'Edinburgh', 'academic.head@company.com', '+44 131 1234 5678', 'Head of academic programs.'],
    ['EMP010', 'Training Head', 'Training Head', 'Training', 'Education', 'Edinburgh', 'training.head@company.com', '+44 131 1234 5679', 'Head of training initiatives.'],
    ['EMP011', 'Coordinator', 'Academic Coordinator', 'Academics', 'Education', 'Edinburgh', 'coordinator@company.com', '+44 131 1234 5680', 'Coordinates academic activities.'],
    ['EMP012', 'Teacher', 'Senior Teacher', 'Academics', 'Education', 'Edinburgh', 'teacher@company.com', '+44 131 1234 5681', 'Senior teaching staff.'],
    ['EMP013', 'Assistant', 'Teaching Assistant', 'Academics', 'Education', 'Edinburgh', 'assistant@company.com', '+44 131 1234 5682', 'Supports teaching activities.'],
    ['EMP014', 'HR Director', 'HR Director', 'HR', 'Corporate', 'London HQ', 'hr.director@company.com', '+44 20 1234 5684', 'Leads human resources.'],
    ['EMP015', 'Ops Manager', 'Operations Manager', 'Operations', 'Infrastructure', 'Manchester', 'ops.manager@company.com', '+44 161 1234 5679', 'Manages daily operations.'],
  ];

  const empIds = {};
  for (const [code, name, desig, dept, bu, loc, email, phone, bio] of employees) {
    const result = insertEmp.run(code, name, desig, getDept(dept), getBu(bu), getLoc(loc), email, phone, bio);
    empIds[code] = result.lastInsertRowid;
  }

  const insertRel = db.prepare(`
    INSERT INTO relationships (employee_id, manager_id, relationship_type) VALUES (?, ?, ?)
  `);

  const relationships = [
    ['EMP002', 'EMP001', 'reports_to'],
    ['EMP003', 'EMP001', 'reports_to'],
    ['EMP004', 'EMP001', 'reports_to'],
    ['EMP014', 'EMP001', 'reports_to'],
    ['EMP005', 'EMP002', 'reports_to'],
    ['EMP006', 'EMP002', 'reports_to'],
    ['EMP007', 'EMP005', 'reports_to'],
    ['EMP008', 'EMP005', 'reports_to'],
    ['EMP015', 'EMP003', 'reports_to'],
    ['EMP011', 'EMP009', 'reports_to'],
    ['EMP011', 'EMP010', 'functional'],
    ['EMP012', 'EMP011', 'reports_to'],
    ['EMP013', 'EMP012', 'reports_to'],
    ['EMP007', 'EMP006', 'collaboration'],
    ['EMP008', 'EMP003', 'project'],
  ];

  for (const [emp, mgr, type] of relationships) {
    insertRel.run(empIds[emp], empIds[mgr], type);
  }

  const insertProject = db.prepare('INSERT INTO projects (name, description, status) VALUES (?, ?, ?)');
  const projects = [
    ['Digital Transformation', 'Company-wide digital initiative', 'active'],
    ['Platform Modernization', 'Legacy system upgrade', 'active'],
    ['Academic Excellence Program', 'Education quality improvement', 'active'],
  ];
  const projIds = projects.map(p => insertProject.run(...p).lastInsertRowid);

  const insertEP = db.prepare('INSERT INTO employee_projects (employee_id, project_id, role) VALUES (?, ?, ?)');
  insertEP.run(empIds['EMP007'], projIds[1], 'Lead Developer');
  insertEP.run(empIds['EMP008'], projIds[1], 'Developer');
  insertEP.run(empIds['EMP011'], projIds[2], 'Coordinator');
  insertEP.run(empIds['EMP002'], projIds[0], 'Executive Sponsor');

  console.log('Database seeded successfully with sample data');
}

seed();
