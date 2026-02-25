-- ============================================================
-- Add UPDATE/DELETE policies for services and ratings
-- ============================================================
-- The Supabase JS client uses upsert (INSERT … ON CONFLICT UPDATE)
-- which requires an UPDATE policy. Rating deletion also needs DELETE.
-- ============================================================

-- services: allow update and soft-delete
CREATE POLICY "services_update_all"
  ON services FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ratings: allow update and hard-delete
CREATE POLICY "ratings_update_all"
  ON ratings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ratings_delete_all"
  ON ratings FOR DELETE
  USING (true);
