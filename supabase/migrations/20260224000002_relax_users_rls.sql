-- ============================================================
-- Relax users RLS policies for anon / offline-first PWA
-- ============================================================
-- The app generates its own user UUIDs client-side and does not
-- use Supabase Auth, so auth.uid() is always NULL for anon keys.
-- This migration replaces the auth-gated policies with open ones
-- matching the pattern used by services and ratings.
-- ============================================================

-- Drop old auth-gated policies
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;

-- Allow anon/authenticated to read all profiles
CREATE POLICY "users_select_all"
  ON users FOR SELECT
  USING (true);

-- Allow anon/authenticated to insert profiles
CREATE POLICY "users_insert_all"
  ON users FOR INSERT
  WITH CHECK (true);

-- Allow anon/authenticated to update profiles
CREATE POLICY "users_update_all"
  ON users FOR UPDATE
  USING (true)
  WITH CHECK (true);
