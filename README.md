# ORMS - Organizational Relationship Management System

A full-stack web application for managing organizational structures, employee relationships, and interactive org chart visualizations.

## Features

- **Admin Login** — Secure JWT-based authentication
- **Dashboard** — Key metrics, department analytics, quick actions
- **Employee Management** — Full CRUD with profiles, projects, and documents
- **Relationship Mapping** — Multiple relationship types (Reports To, Functional, Project, Collaboration)
- **Org Chart Visualizations** — Vertical Hierarchy, Horizontal Chain, Matrix, Network, Drill-Down
- **Advanced Search** — Filter by department, location, designation
- **Reports & Analytics** — Span of control, matrix reports, export to CSV/JSON

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, React Router
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Auth:** JWT with bcrypt password hashing

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
npm run install:all
```

### Run Development Server

```bash
npm run dev
```

Then open **http://localhost:3001** in your browser (UI + API on one port).

Optional: `npm run dev:full` runs a separate Vite dev server at `http://localhost:5173` with hot reload.

### Demo Login

- **Username:** `admin`
- **Password:** `admin123`

## Project Structure

```
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/       # All application pages
│       ├── components/  # Reusable UI components
│       └── api/         # API client
├── server/          # Express backend
│   ├── routes/      # API route handlers
│   ├── db.js        # SQLite database setup
│   └── seed.js      # Sample data seeder
└── package.json     # Root scripts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET/POST | `/api/employees` | List/create employees |
| GET/PUT/DELETE | `/api/employees/:id` | Employee CRUD |
| GET/POST | `/api/relationships` | Manage relationships |
| GET | `/api/org-chart/hierarchy` | Hierarchy tree |
| GET | `/api/org-chart/chain` | Horizontal chains |
| GET | `/api/org-chart/matrix` | Matrix reporting |
| GET | `/api/org-chart/network` | Network map |
| GET | `/api/reports/*` | Analytics reports |

## Production Build

```bash
npm run build
npm start
```
