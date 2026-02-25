# Scout

AI-powered local service discovery. A PWA that uses TensorFlow.js to generate semantic embeddings on-device and recommend nearby service providers (electricians, plumbers, mechanics, etc.) based on your profile and location.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (recommended: latest LTS)
- [Docker](https://www.docker.com/get-started/) (required for the local database via Supabase CLI)
- npm (included with Node.js)

> **Important:** Docker must be running before starting the local database. The Supabase CLI uses Docker to spin up PostgreSQL + pgvector in containers.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local database (PostgreSQL + pgvector via Docker)
npm run db:start

# 3. Run the frontend
npm run dev
```

The app will be available at:
- **Frontend:** http://localhost:5173
- **Supabase Studio:** http://localhost:54323
- **Supabase API:** http://localhost:54321

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Start the frontend dev server |
| `npm run db:start` | `npx supabase start` | Start PostgreSQL + pgvector in Docker |
| `npm run db:stop` | `npx supabase stop` | Stop the Supabase containers |
| `npm run db:reset` | `npx supabase db reset` | Reset the database, re-apply migrations and seed |
| `npm run db:migrate` | `npx supabase migration up` | Apply pending migrations |
| `npm run build` | `vite build` | Production build |
| `npm run test` | `vitest run` | Run all tests |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
| `npm run test:property` | `vitest run` | Run property-based tests |
| `npm run test:unit` | `vitest run` | Run unit tests |

## Database

The project uses [Supabase](https://supabase.com/) with PostgreSQL and the [pgvector](https://github.com/pgvector/pgvector) extension for vector search.

### Structure

```
supabase/
├── config.toml          # Local Supabase configuration
├── migrations/
│   ├── ..._enable_pgvector.sql   # Enables the pgvector extension
│   └── ..._create_tables.sql     # Creates tables: users, services, ratings, service_embeddings, categories, subcategories
└── seed.sql             # Initial data (service categories and subcategories)
```

### Main Tables

- **users** — User profiles (anonymous or authenticated)
- **services** — Registered service providers
- **ratings** — Service ratings (1–5 stars)
- **service_embeddings** — Vector embeddings for semantic search (pgvector)
- **categories** / **subcategories** — Service categories and subcategories

### Useful Database Commands

```bash
# Start the local database (first run may take a while to pull Docker images)
npm run db:start

# Reset the database (drops everything, re-applies migrations and seed)
npm run db:reset

# Stop the database
npm run db:stop

# Apply only pending migrations
npm run db:migrate
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

The local Supabase keys are printed when you run `npm run db:start`. For production, set variables in your Vercel dashboard — never commit real keys.

## Tech Stack

- **Frontend:** TypeScript, React, Vite, PWA (Service Workers, Workbox)
- **ML:** TensorFlow.js (on-device embeddings and recommendations)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Local Persistence:** IndexedDB via Dexie.js
- **Styling:** SCSS Modules
- **Testing:** Vitest, fast-check (property-based testing)

## Project Structure

```
├── src/
│   ├── client/           # Frontend React app
│   │   ├── pages/        # Page components
│   │   ├── services/     # AI, database, sync services
│   │   └── styles/       # SCSS modules and global styles
│   ├── shared/           # Types and utilities shared across the app
│   └── __tests__/        # Tests (unit/ and property/)
├── supabase/             # Supabase configuration and migrations
├── scripts/
│   └── deploy-supabase.sh  # Supabase production deployment script
├── public/               # Static assets
├── index.html            # Vite entry point
├── vite.config.ts        # Vite configuration
├── vitest.config.ts      # Vitest configuration
├── vercel.json           # Vercel deployment configuration
└── package.json          # Dependencies and scripts
```

## Deploy

### Frontend — Vercel

The frontend (PWA) is deployed to [Vercel](https://vercel.com/) using `vercel.json`.

```bash
# Deploy via CLI
npx vercel --prod

# Or connect the GitHub repository in the Vercel dashboard for automatic deploys
```

**`vercel.json` configuration:**
- Framework: Vite
- Build: `npm run build`
- Output: `dist/client`
- SPA rewrites (all routes → `index.html`)
- Immutable cache for static assets
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)

**Environment variables in Vercel:**

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Database — Supabase

Use the `scripts/deploy-supabase.sh` script to set up the production database:

```bash
# Make executable (first time only)
chmod +x scripts/deploy-supabase.sh

# Run with your Supabase project ref
./scripts/deploy-supabase.sh <project-ref>
```

The script:
1. Links the local project to the remote Supabase project (`supabase link`)
2. Applies all migrations (pgvector, tables, RLS)
3. Displays instructions for seeding initial data

**Prerequisites:**
- Project created at [supabase.com/dashboard](https://supabase.com/dashboard)
- Project ref (found in Project Settings → General)
- Database password

**Find your keys at:**
`https://supabase.com/dashboard/project/<ref>/settings/api`
