#!/usr/bin/env bash
# ============================================================
# Supabase Production Deployment Script
# ============================================================
#
# Prerequisites:
#   - Node.js 20+ installed
#   - Supabase CLI installed (npx supabase)
#   - A Supabase project created at https://supabase.com/dashboard
#   - Your project ref (found in Project Settings > General)
#
# Usage:
#   ./scripts/deploy-supabase.sh <project-ref>
#
# Example:
#   ./scripts/deploy-supabase.sh abcdefghijklmnop
#
# What this script does:
#   1. Links local project to remote Supabase project
#   2. Pushes all migrations (including pgvector + RLS)
#   3. Provides instructions for seeding initial data
# ============================================================

set -euo pipefail

PROJECT_REF="${1:-}"

if [ -z "$PROJECT_REF" ]; then
  echo "Error: Project ref is required."
  echo ""
  echo "Usage: ./scripts/deploy-supabase.sh <project-ref>"
  echo ""
  echo "Find your project ref at:"
  echo "  https://supabase.com/dashboard → Project Settings → General"
  exit 1
fi

echo "============================================"
echo " Supabase Production Deployment"
echo "============================================"
echo ""

# Step 1: Link to remote project
echo "→ Step 1: Linking to Supabase project ${PROJECT_REF}..."
echo "  You will be prompted for your database password."
echo ""
npx supabase link --project-ref "$PROJECT_REF"
echo ""
echo "  ✓ Project linked successfully."
echo ""

# Step 2: Push migrations
echo "→ Step 2: Pushing migrations to production..."
echo "  This will run all migrations in supabase/migrations/ including:"
echo "    - pgvector extension"
echo "    - Table creation (users, services, ratings, etc.)"
echo "    - Vector similarity search RPC"
echo "    - Row Level Security (RLS) policies"
echo ""
npx supabase db push
echo ""
echo "  ✓ Migrations applied successfully."
echo ""

# Step 3: Seed data instructions
echo "→ Step 3: Seed initial data"
echo ""
echo "  Option A — Reset with seed (WARNING: drops all data):"
echo "    npx supabase db reset --linked"
echo ""
echo "  Option B — Run seed manually via SQL Editor:"
echo "    1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo "    2. Paste the contents of supabase/seed.sql"
echo "    3. Click 'Run'"
echo ""
echo "  Option C — Use psql directly:"
echo "    psql \"\$(npx supabase db url --linked)\" -f supabase/seed.sql"
echo ""

# Step 4: Verify pgvector
echo "→ Step 4: Verify pgvector is enabled"
echo "  Run this query in the SQL Editor to confirm:"
echo "    SELECT * FROM pg_extension WHERE extname = 'vector';"
echo ""

# Step 5: Environment variables reminder
echo "→ Step 5: Update environment variables"
echo "  Set these in your backend deployment (Render/Railway):"
echo "    SUPABASE_URL=https://${PROJECT_REF}.supabase.co"
echo "    SUPABASE_SERVICE_KEY=<your-service-role-key>"
echo ""
echo "  Set these in your frontend deployment (Vercel):"
echo "    VITE_SUPABASE_URL=https://${PROJECT_REF}.supabase.co"
echo "    VITE_SUPABASE_ANON_KEY=<your-anon-key>"
echo ""
echo "  Find your keys at:"
echo "    https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo ""

echo "============================================"
echo " ✓ Deployment complete!"
echo "============================================"
