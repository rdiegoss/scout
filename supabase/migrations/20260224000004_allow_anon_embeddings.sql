-- ============================================================
-- Allow anon INSERT/UPDATE on service_embeddings
-- ============================================================
-- Previously restricted to service_role only. Now the browser
-- generates embeddings client-side via TF.js and syncs them.
-- ============================================================

CREATE POLICY "service_embeddings_insert_all"
  ON service_embeddings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_embeddings_update_all"
  ON service_embeddings FOR UPDATE
  USING (true)
  WITH CHECK (true);
