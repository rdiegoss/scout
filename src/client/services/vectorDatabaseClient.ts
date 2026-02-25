import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@shared/utils/config';

export interface ServiceMetadata {
  category?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  hasWhatsApp?: boolean;
  name?: string;
  description?: string;
}

export interface SearchFilters {
  category?: string;
  maxDistanceKm?: number;
  minRating?: number;
  hasWhatsApp?: boolean;
  userLatitude?: number;
  userLongitude?: number;
}

export interface VectorSearchResult {
  serviceId: string;
  similarity: number;
  metadata: ServiceMetadata;
}

export interface VectorDatabaseClient {
  searchSimilar(
    embedding: number[],
    limit: number,
    filters?: SearchFilters,
  ): Promise<VectorSearchResult[]>;

  upsertServiceEmbedding(
    serviceId: string,
    embedding: number[],
    metadata: ServiceMetadata,
  ): Promise<void>;

  deleteServiceEmbedding(serviceId: string): Promise<void>;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface EmbeddingRow {
  id: string;
  service_id: string;
  embedding: string; // pgvector returns as string representation
  metadata: ServiceMetadata | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseVectorClient implements VectorDatabaseClient {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase =
      supabaseClient ??
      createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async searchSimilar(
    embedding: number[],
    limit: number,
    filters?: SearchFilters,
  ): Promise<VectorSearchResult[]> {
    const { data, error } = await this.supabase.rpc(
      'match_service_embeddings',
      {
        query_embedding: JSON.stringify(embedding),
        match_count: limit,
        filter_category: filters?.category ?? null,
        filter_min_rating: filters?.minRating ?? null,
        filter_has_whatsapp: filters?.hasWhatsApp ?? null,
      },
    );

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    let results: VectorSearchResult[] = data.map(
      (row: {
        service_id: string;
        similarity: number;
        metadata: ServiceMetadata | null;
      }) => ({
        serviceId: row.service_id,
        similarity: row.similarity,
        metadata: row.metadata ?? {},
      }),
    );

    if (
      filters?.maxDistanceKm != null &&
      filters.userLatitude != null &&
      filters.userLongitude != null
    ) {
      results = results.filter((r) => {
        if (r.metadata.latitude == null || r.metadata.longitude == null) {
          return true; // keep results without location data
        }
        const dist = haversineDistanceKm(
          filters.userLatitude!,
          filters.userLongitude!,
          r.metadata.latitude,
          r.metadata.longitude,
        );
        return dist <= filters.maxDistanceKm!;
      });
    }

    return results;
  }

  async upsertServiceEmbedding(
    serviceId: string,
    embedding: number[],
    metadata: ServiceMetadata,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('service_embeddings')
      .upsert(
        {
          service_id: serviceId,
          embedding: JSON.stringify(embedding),
          metadata,
        },
        { onConflict: 'service_id' },
      );

    if (error) {
      throw new Error(`Upsert embedding failed: ${error.message}`);
    }
  }

  async deleteServiceEmbedding(serviceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('service_embeddings')
      .delete()
      .eq('service_id', serviceId);

    if (error) {
      throw new Error(`Delete embedding failed: ${error.message}`);
    }
  }
}
