-- ============================================================
-- Enable Row Level Security (RLS) on all tables
-- ============================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- services: public read, authenticated/anon insert
-- ============================================================
CREATE POLICY "services_select_all"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "services_insert_all"
  ON services FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- ratings: public read, authenticated/anon insert
-- ============================================================
CREATE POLICY "ratings_select_all"
  ON ratings FOR SELECT
  USING (true);

CREATE POLICY "ratings_insert_all"
  ON ratings FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- categories: read-only for everyone
-- ============================================================
CREATE POLICY "categories_select_all"
  ON categories FOR SELECT
  USING (true);

-- ============================================================
-- subcategories: read-only for everyone
-- ============================================================
CREATE POLICY "subcategories_select_all"
  ON subcategories FOR SELECT
  USING (true);

-- ============================================================
-- service_embeddings: public read, service_role only for writes
-- ============================================================
CREATE POLICY "service_embeddings_select_all"
  ON service_embeddings FOR SELECT
  USING (true);

-- service_embeddings INSERT/UPDATE restricted to service_role.
-- The service_role key bypasses RLS by default in Supabase,
-- so no explicit policy is needed for writes — RLS being enabled
-- with no INSERT/UPDATE policy means anon/authenticated cannot write.

-- ============================================================
-- users: select/update own profile only (via auth.uid())
-- For anonymous users without Supabase Auth, allow insert to
-- create their profile, and select/update by matching their id.
-- ============================================================
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
