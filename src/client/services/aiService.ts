import * as tf from '@tensorflow/tfjs';
import type { ServiceProvider, GeoPosition } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import { EmbeddingGenerator } from './embeddingGenerator';
import { LocalVectorStore } from './localVectorStore';
import {
  RecommendationEngine,
  type RecommendedService,
} from './recommendationEngine';
import { db } from './database';

export interface AIStatus {
  initialized: boolean;
  embeddingsReady: boolean;
  serviceCount: number;
  embeddingCount: number;
  usingFullModel: boolean;
}

class AIServiceImpl {
  private embeddingGenerator: EmbeddingGenerator;
  private vectorStore: LocalVectorStore;
  private engine: RecommendationEngine;

  private _initialized = false;
  private _embeddingsReady = false;
  private _initPromise: Promise<void> | null = null;
  private _indexPromise: Promise<void> | null = null;

  constructor() {
    this.embeddingGenerator = new EmbeddingGenerator();
    this.vectorStore = new LocalVectorStore();
    this.engine = new RecommendationEngine(
      this.embeddingGenerator,
      this.vectorStore,
    );
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[AIService] Initializing TensorFlow.js...');
      await this.embeddingGenerator.initialize();
      this._initialized = true;

      const modelType = this.embeddingGenerator.isUsingFullModel()
        ? 'Sentence Transformer'
        : 'TF.js fallback embedding layer';
      console.log(`[AIService] Ready — using ${modelType}`);
    } catch (err) {
      console.error('[AIService] Initialization failed:', err);
      throw err;
    }
  }

  async indexServices(): Promise<void> {
    if (this._indexPromise) return this._indexPromise;
    this._indexPromise = this._doIndexServices();
    return this._indexPromise;
  }

  private async _doIndexServices(): Promise<void> {
    await this.initialize();

    try {
      const allServices = await db.services
        .filter((s) => s.isActive)
        .toArray();

      if (allServices.length === 0) {
        this._embeddingsReady = true;
        return;
      }

      const existingCount = await this.vectorStore.getEmbeddingCount();

      if (existingCount >= allServices.length) {
        console.log(
          `[AIService] All ${allServices.length} services already indexed`,
        );
        this._embeddingsReady = true;
        return;
      }

      console.log(
        `[AIService] Indexing ${allServices.length} services (${existingCount} already done)...`,
      );

      let indexed = 0;
      for (const service of allServices) {
        try {
          const existing = await db.cachedEmbeddings.get(
            `emb-service-${service.id}`,
          );
          if (existing) {
            indexed++;
            continue;
          }

          const embedding =
            await this.embeddingGenerator.generateServiceEmbedding(service);

          await this.vectorStore.upsertServiceEmbedding(
            service.id,
            embedding,
            {
              category: service.category,
              latitude: service.location.latitude,
              longitude: service.location.longitude,
              rating: service.averageRating,
              hasWhatsApp: service.hasWhatsApp,
              name: service.name,
              description: service.description,
            },
          );

          indexed++;

          if (indexed % 5 === 0) {
            console.log(
              `[AIService] Indexed ${indexed}/${allServices.length} services`,
            );
          }
        } catch (err) {
          console.warn(
            `[AIService] Failed to index service ${service.id}:`,
            err,
          );
        }
      }

      console.log(
        `[AIService] Indexing complete: ${indexed}/${allServices.length} services`,
      );
      this._embeddingsReady = true;
    } catch (err) {
      console.error('[AIService] Indexing failed:', err);
      this._embeddingsReady = true;
    }
  }

  async getRecommendations(
    userProfile: UserProfile,
    location: GeoPosition,
    limit = 10,
  ): Promise<RecommendedService[]> {
    if (!this._initialized || !this._embeddingsReady) {
      return [];
    }

    try {
      const recs = await this.engine.getRecommendations(userProfile, location, limit);

      const enriched = await Promise.all(
        recs.map(async (rec) => {
          const svc = await db.services.get(rec.service.id);
          return svc ? { ...rec, service: svc } : rec;
        }),
      );

      return enriched.filter((r) => r.service.name && r.service.name.trim().length > 0);
    } catch (err) {
      console.warn('[AIService] Recommendation failed, returning empty:', err);
      return [];
    }
  }

  async semanticSearch(
    query: string,
    limit = 10,
    filters?: { userLatitude?: number; userLongitude?: number },
  ): Promise<
    Array<{
      service: ServiceProvider;
      similarity: number;
      distanceKm: number;
    }>
  > {
    if (!this._initialized || !this._embeddingsReady) {
      return [];
    }

    try {
      const queryEmbedding =
        await this.embeddingGenerator.generateQueryEmbedding(query);

      const vectorResults = await this.vectorStore.searchSimilar(
        queryEmbedding,
        limit * 3, // fetch more so hybrid scoring can rerank
        {
          userLatitude: filters?.userLatitude,
          userLongitude: filters?.userLongitude,
        },
      );

      const enriched: Array<{
        service: ServiceProvider;
        vectorSimilarity: number;
        distanceKm: number;
      }> = [];

      for (const vr of vectorResults) {
        const service = await db.services.get(vr.serviceId);
        if (service && service.isActive) {
          let distanceKm = 0;
          if (
            filters?.userLatitude != null &&
            filters?.userLongitude != null
          ) {
            const { haversineDistanceKm } = await import(
              './vectorDatabaseClient'
            );
            distanceKm = haversineDistanceKm(
              filters.userLatitude,
              filters.userLongitude,
              service.location.latitude,
              service.location.longitude,
            );
          }
          enriched.push({ service, vectorSimilarity: vr.similarity, distanceKm });
        }
      }

      const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const scored = enriched.map((item) => {
        const name = item.service.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const desc = (item.service.description ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cat = item.service.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const subcat = (item.service.subcategory ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const haystack = `${name} ${desc} ${cat} ${subcat}`;

        let textScore = 0;
        if (name.includes(q)) {
          textScore = 0.9; // direct name match — strongest signal
        } else if (subcat.includes(q)) {
          textScore = 0.7;
        } else if (cat.includes(q)) {
          textScore = 0.6;
        } else if (desc.includes(q)) {
          textScore = 0.5;
        } else {
          const queryWords = q.split(/\s+/).filter(w => w.length >= 3);
          if (queryWords.length > 0) {
            const matchCount = queryWords.filter(w => haystack.includes(w)).length;
            textScore = (matchCount / queryWords.length) * 0.5;
          }
        }

        const textWeight = 0.8;
        const vectorWeight = 0.2;
        const combined = textScore * textWeight + item.vectorSimilarity * vectorWeight;

        return {
          service: item.service,
          similarity: combined,
          distanceKm: item.distanceKm,
          _textScore: textScore, // for debugging/filtering
        };
      });

      const meaningful = scored.filter(r => r._textScore > 0 || r.similarity > 0.6);

      meaningful.sort((a, b) => b.similarity - a.similarity);

      return meaningful.slice(0, limit).map(({ _textScore, ...rest }) => rest);
    } catch (err) {
      console.warn('[AIService] Semantic search failed:', err);
      return [];
    }
  }

  async indexSingleService(service: ServiceProvider): Promise<void> {
    if (!this._initialized) return;

    try {
      const embedding =
        await this.embeddingGenerator.generateServiceEmbedding(service);

      await this.vectorStore.upsertServiceEmbedding(service.id, embedding, {
        category: service.category,
        latitude: service.location.latitude,
        longitude: service.location.longitude,
        rating: service.averageRating,
        hasWhatsApp: service.hasWhatsApp,
        name: service.name,
        description: service.description,
      });

      console.log(`[AIService] Indexed new service: ${service.name}`);
    } catch (err) {
      console.warn(`[AIService] Failed to index service ${service.id}:`, err);
    }
  }

  async getStatus(): Promise<AIStatus> {
    const serviceCount = await db.services.count();
    const embeddingCount = await this.vectorStore.getEmbeddingCount();

    return {
      initialized: this._initialized,
      embeddingsReady: this._embeddingsReady,
      serviceCount,
      embeddingCount,
      usingFullModel: this.embeddingGenerator.isUsingFullModel(),
    };
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  get isReady(): boolean {
    return this._initialized && this._embeddingsReady;
  }

  getMemoryStats(): { numTensors: number; numDataBuffers: number; numBytes: number } {
    return tf.memory();
  }

  dispose(): void {
    this.embeddingGenerator.dispose();
    this._initialized = false;
    this._embeddingsReady = false;
    this._initPromise = null;
    this._indexPromise = null;
  }
}

export const aiService = new AIServiceImpl();
