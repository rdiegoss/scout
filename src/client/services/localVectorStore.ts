import * as tf from '@tensorflow/tfjs';
import type { EmbeddingRecord } from '@shared/types';
import type {
  VectorDatabaseClient,
  VectorSearchResult,
  SearchFilters,
  ServiceMetadata,
} from './vectorDatabaseClient';
import { haversineDistanceKm } from './vectorDatabaseClient';
import { db } from './database';
import { supabase } from './supabaseClient';
import { isValidUuid } from './supabaseSyncExecutor';
import type { ServiceProvider } from '@shared/types';

async function ensureServiceInCloud(serviceId: string): Promise<boolean> {
  const { data } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .maybeSingle();

  if (data) return true;

  const svc = await db.services.get(serviceId) as ServiceProvider | undefined;
  if (!svc) return false;

  const { error } = await supabase.from('services').upsert(
    {
      id: svc.id,
      name: svc.name,
      description: svc.description,
      category: svc.category,
      subcategory: svc.subcategory,
      phone: svc.phone,
      has_whatsapp: svc.hasWhatsApp,
      whatsapp_confirmed: svc.whatsAppConfirmed ?? false,
      address: svc.address,
      latitude: svc.location.latitude,
      longitude: svc.location.longitude,
      average_rating: svc.averageRating,
      total_ratings: svc.totalRatings,
      neighborhood_score: svc.neighborhoodScore,
      data_source: svc.dataSource,
      verified_by_users: svc.verifiedByUsers,
      is_active: svc.isActive,
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn(`[LocalVectorStore] ensureServiceInCloud(${serviceId}) failed:`, error.message);
    return false;
  }
  return true;
}

function batchCosineSimilarity(
  queryVec: number[],
  matrix: number[][],
): number[] {
  if (matrix.length === 0) return [];

  return tf.tidy(() => {
    const q = tf.tensor1d(queryVec);
    const m = tf.tensor2d(matrix);

    const qNorm = q.div(q.norm().add(tf.scalar(1e-8)));

    const mNorms = m.norm('euclidean', 1, true).add(tf.scalar(1e-8));
    const mNormalized = m.div(mNorms);

    const similarities = mNormalized.matMul(qNorm.expandDims(1)).squeeze([1]);

    return Array.from(similarities.dataSync());
  });
}

export class LocalVectorStore implements VectorDatabaseClient {

  async searchSimilar(
    embedding: number[],
    limit: number,
    filters?: SearchFilters,
  ): Promise<VectorSearchResult[]> {
    const records = await db.cachedEmbeddings
      .where('entityType')
      .equals('service')
      .toArray();

    if (records.length === 0) return [];

    const validRecords: EmbeddingRecord[] = [];
    const vectors: number[][] = [];

    for (const rec of records) {
      if (rec.vector && rec.vector.length > 0) {
        validRecords.push(rec);
        vectors.push(rec.vector);
      }
    }

    if (validRecords.length === 0) return [];

    const similarities = batchCosineSimilarity(embedding, vectors);
    console.log('[LocalVectorStore] tf.memory() after batch cosine similarity:', tf.memory());

    let results: VectorSearchResult[] = validRecords.map((rec, i) => ({
      serviceId: rec.entityId,
      similarity: similarities[i],
      metadata: {
        category: rec.metadata.category,
        latitude: rec.metadata.location?.latitude,
        longitude: rec.metadata.location?.longitude,
        rating: rec.metadata.rating,
        hasWhatsApp: rec.metadata.hasWhatsApp,
        name: undefined, // will be filled from service data
        description: undefined,
      },
    }));

    if (filters?.category) {
      results = results.filter((r) => r.metadata.category === filters.category);
    }
    if (filters?.minRating != null) {
      results = results.filter(
        (r) => (r.metadata.rating ?? 0) >= filters.minRating!,
      );
    }
    if (filters?.hasWhatsApp != null) {
      results = results.filter(
        (r) => r.metadata.hasWhatsApp === filters.hasWhatsApp,
      );
    }
    if (
      filters?.maxDistanceKm != null &&
      filters.userLatitude != null &&
      filters.userLongitude != null
    ) {
      results = results.filter((r) => {
        if (r.metadata.latitude == null || r.metadata.longitude == null) return true;
        const dist = haversineDistanceKm(
          filters.userLatitude!,
          filters.userLongitude!,
          r.metadata.latitude,
          r.metadata.longitude,
        );
        return dist <= filters.maxDistanceKm!;
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async upsertServiceEmbedding(
    serviceId: string,
    embedding: number[],
    metadata: ServiceMetadata,
  ): Promise<void> {
    const record: EmbeddingRecord = {
      id: `emb-service-${serviceId}`,
      entityType: 'service',
      entityId: serviceId,
      vector: embedding,
      metadata: {
        category: metadata.category,
        location:
          metadata.latitude != null && metadata.longitude != null
            ? {
                latitude: metadata.latitude,
                longitude: metadata.longitude,
                accuracy: 0,
                timestamp: Date.now(),
              }
            : undefined,
        rating: metadata.rating,
        hasWhatsApp: metadata.hasWhatsApp,
        updatedAt: Date.now(),
      },
    };

    await db.cachedEmbeddings.put(record);

    if (isValidUuid(serviceId)) {
      ensureServiceInCloud(serviceId)
        .then((exists) => {
          if (!exists) return;
          return supabase
            .from('service_embeddings')
            .upsert(
              {
                service_id: serviceId,
                embedding: JSON.stringify(embedding),
                metadata,
              },
              { onConflict: 'service_id' },
            )
            .then(({ error }) => {
              if (error) {
                console.warn(`[LocalVectorStore] Embedding cloud sync failed for ${serviceId}:`, error.message);
              }
            });
        })
        .catch(() => { /* offline — will retry on next indexing */ });
    }
  }

  async deleteServiceEmbedding(serviceId: string): Promise<void> {
    await db.cachedEmbeddings.delete(`emb-service-${serviceId}`);
  }

  async getEmbeddingCount(): Promise<number> {
    return db.cachedEmbeddings.where('entityType').equals('service').count();
  }
}
