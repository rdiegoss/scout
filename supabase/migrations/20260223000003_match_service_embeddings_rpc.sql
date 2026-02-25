-- RPC function for vector similarity search with optional filters.
-- Uses cosine distance operator (<=>) on the pgvector column.
-- Called by VectorDatabaseClient.searchSimilar().
CREATE OR REPLACE FUNCTION match_service_embeddings(
  query_embedding vector(384),
  match_count INT DEFAULT 10,
  filter_category TEXT DEFAULT NULL,
  filter_min_rating DOUBLE PRECISION DEFAULT NULL,
  filter_has_whatsapp BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  service_id UUID,
  similarity DOUBLE PRECISION,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.service_id,
    1 - (se.embedding <=> query_embedding)::DOUBLE PRECISION AS similarity,
    se.metadata
  FROM service_embeddings se
  JOIN services s ON s.id = se.service_id AND s.is_active = true
  WHERE
    (filter_category IS NULL OR s.category::TEXT = filter_category)
    AND (filter_min_rating IS NULL OR s.average_rating >= filter_min_rating)
    AND (filter_has_whatsapp IS NULL OR s.has_whatsapp = filter_has_whatsapp)
  ORDER BY se.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
