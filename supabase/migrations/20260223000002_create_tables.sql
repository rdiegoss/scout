-- Create enum types
CREATE TYPE service_category AS ENUM (
  'reparos_domesticos',
  'servicos_pessoais',
  'automotivo',
  'construcao',
  'outros'
);

CREATE TYPE data_source AS ENUM (
  'manual',
  'kaggle',
  'web_scraping',
  'api',
  'partnership'
);

-- ============================================================
-- Users table (anonymous profiles synced from client)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  manual_address TEXT,
  favorite_categories service_category[] DEFAULT '{}',
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Services table (service providers)
-- ============================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category service_category NOT NULL,
  subcategory TEXT,
  phone TEXT NOT NULL,
  has_whatsapp BOOLEAN DEFAULT false,
  whatsapp_confirmed BOOLEAN DEFAULT false,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  service_radius DOUBLE PRECISION,
  average_rating DOUBLE PRECISION DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  neighborhood_score DOUBLE PRECISION DEFAULT 0,
  data_source data_source DEFAULT 'manual',
  source_id TEXT,
  source_url TEXT,
  imported_at TIMESTAMPTZ,
  verified_by_users INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering services by category and active status
CREATE INDEX idx_services_category ON services (category) WHERE is_active = true;
CREATE INDEX idx_services_location ON services (latitude, longitude) WHERE is_active = true;

-- ============================================================
-- Ratings table
-- ============================================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT CHECK (char_length(comment) <= 500),
  user_latitude DOUBLE PRECISION,
  user_longitude DOUBLE PRECISION,
  is_neighbor BOOLEAN DEFAULT false,
  helpful INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_service ON ratings (service_id, created_at DESC);
CREATE INDEX idx_ratings_user ON ratings (user_id);

-- ============================================================
-- Service embeddings table (pgvector)
-- ============================================================
CREATE TABLE service_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_service_embedding UNIQUE (service_id)
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX idx_service_embeddings_vector
  ON service_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- Categories reference table (for seed data and lookups)
-- ============================================================
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subcategories_category ON subcategories (category_id);

-- ============================================================
-- Function to auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_service_embeddings_updated_at
  BEFORE UPDATE ON service_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
