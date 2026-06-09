import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './db.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import departmentRoutes from './routes/departments.js';
import relationshipRoutes from './routes/relationships.js';
import dashboardRoutes from './routes/dashboard.js';
import orgChartRoutes from './routes/orgChart.js';
import reportRoutes from './routes/reports.js';
import chartLayoutRoutes from './routes/chartLayout.js';
import uploadRoutes from './routes/upload.js';
import tradOrgChartRoutes from './routes/tradOrgChart.js';
import projectRoutes from './routes/projects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');
const indexHtml = path.join(clientDist, 'index.html');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/org-chart', orgChartRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chart-layout', chartLayoutRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/trad-org-chart', tradOrgChartRoutes);
app.use('/api/projects', projectRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.status(503).send(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h1>ORMS</h1>
        <p>Frontend not built yet. In the project folder run:</p>
        <pre>npm run build</pre>
        <p>Then restart: <pre>npm run dev</pre></p>
      </body></html>
    `);
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

try {
  await import('./seed.js');
} catch (err) {
  console.warn('Seed skipped:', err.message);
}

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ORMS is ready!');
  console.log(`  Open in browser:  http://localhost:${PORT}`);
  console.log(`  Login: admin / admin123`);
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Run this first:`);
    console.error(`  Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    console.error('Then run: npm run dev\n');
    process.exit(1);
  }
  throw err;
});

export default app;
