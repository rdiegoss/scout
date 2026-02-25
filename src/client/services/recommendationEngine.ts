import type { ServiceProvider, GeoPosition } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import { EmbeddingGenerator } from './embeddingGenerator';
import type { VectorDatabaseClient, VectorSearchResult } from './vectorDatabaseClient';
import { haversineDistanceKm } from './vectorDatabaseClient';

export interface RecommendedService {
  service: ServiceProvider;
  relevanceScore: number;
  distanceKm: number;
  matchReasons: string[];
}

const RECOMMENDATION_TIMEOUT_MS = 2000;

const DEFAULT_LIMIT = 10;

const SIMILARITY_WEIGHT = 0.4;

const PROXIMITY_WEIGHT = 0.35;

const COMPATIBILITY_WEIGHT = 0.25;

const MAX_DISTANCE_KM = 50;

export function calculateSimilarity(
  userEmbedding: number[],
  serviceEmbedding: number[],
): number {
  if (userEmbedding.length === 0 || serviceEmbedding.length === 0) {
    return 0;
  }

  const minLen = Math.min(userEmbedding.length, serviceEmbedding.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < minLen; i++) {
    dotProduct += userEmbedding[i] * serviceEmbedding[i];
    normA += userEmbedding[i] * userEmbedding[i];
    normB += serviceEmbedding[i] * serviceEmbedding[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

function proximityScore(distanceKm: number): number {
  if (distanceKm <= 0) return 1;
  if (distanceKm >= MAX_DISTANCE_KM) return 0;
  return 1 - distanceKm / MAX_DISTANCE_KM;
}

function ratingScore(averageRating: number): number {
  return Math.max(0, Math.min(1, (averageRating - 1) / 4));
}

function hasSearchHistory(profile: UserProfile): boolean {
  return profile.searchHistory.length > 0;
}

function getHistoryCategories(profile: UserProfile): Set<string> {
  const categories = new Set<string>();

  for (const entry of profile.searchHistory) {
    const q = entry.query.toLowerCase();
    if (q.includes('reparo') || q.includes('doméstico') || q.includes('domestico')) {
      categories.add('reparos_domesticos');
    }
    if (q.includes('pessoal') || q.includes('pessoais')) {
      categories.add('servicos_pessoais');
    }
    if (q.includes('auto') || q.includes('carro') || q.includes('mecânico') || q.includes('mecanico')) {
      categories.add('automotivo');
    }
    if (q.includes('construção') || q.includes('construcao') || q.includes('obra')) {
      categories.add('construcao');
    }
  }

  for (const cat of profile.favoriteCategories) {
    categories.add(cat);
  }

  for (const pref of profile.explicitPreferences) {
    categories.add(pref.category);
  }

  return categories;
}

function historyMatchScore(
  service: ServiceProvider,
  historyCategories: Set<string>,
): number {
  if (historyCategories.size === 0) return 0;
  return historyCategories.has(service.category) ? 1 : 0;
}

export class RecommendationEngine {
  private embeddingGenerator: EmbeddingGenerator;
  private vectorClient: VectorDatabaseClient;

  constructor(
    embeddingGenerator: EmbeddingGenerator,
    vectorClient: VectorDatabaseClient,
  ) {
    this.embeddingGenerator = embeddingGenerator;
    this.vectorClient = vectorClient;
  }

  async getRecommendations(
    userProfile: UserProfile,
    location: GeoPosition,
    limit: number = DEFAULT_LIMIT,
  ): Promise<RecommendedService[]> {
    const resultPromise = this._getRecommendationsInternal(
      userProfile,
      location,
      limit,
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Recommendation timeout: exceeded 2 seconds')),
        RECOMMENDATION_TIMEOUT_MS,
      );
    });

    return Promise.race([resultPromise, timeoutPromise]);
  }

  private async _getRecommendationsInternal(
    userProfile: UserProfile,
    location: GeoPosition,
    limit: number,
  ): Promise<RecommendedService[]> {
    const userEmbedding =
      await this.embeddingGenerator.generateUserEmbedding(userProfile);

    const searchResults = await this.vectorClient.searchSimilar(
      userEmbedding,
      limit * 2, // fetch extra to allow for filtering/ranking
      {
        userLatitude: location.latitude,
        userLongitude: location.longitude,
      },
    );

    if (searchResults.length === 0) {
      return [];
    }

    const services = this._buildServicesFromResults(searchResults);

    const ranked = this.rankByRelevance(services, userProfile, location);
    return ranked.slice(0, limit);
  }

  rankByRelevance(
    services: ServiceProvider[],
    userProfile: UserProfile,
    location: GeoPosition,
  ): RecommendedService[] {
    const isNewUser = !hasSearchHistory(userProfile);

    if (isNewUser) {
      return this._rankForNewUser(services, location);
    }

    return this._rankForExistingUser(services, userProfile, location);
  }

  private _rankForNewUser(
    services: ServiceProvider[],
    location: GeoPosition,
  ): RecommendedService[] {
    return services
      .map((service) => {
        const distanceKm = haversineDistanceKm(
          location.latitude,
          location.longitude,
          service.location.latitude,
          service.location.longitude,
        );

        const matchReasons: string[] = [];
        if (service.averageRating >= 4) {
          matchReasons.push('Highly rated in the area');
        }
        if (distanceKm <= 5) {
          matchReasons.push('Near you');
        }

        return {
          service,
          relevanceScore: service.averageRating,
          distanceKm,
          matchReasons,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private _rankForExistingUser(
    services: ServiceProvider[],
    userProfile: UserProfile,
    location: GeoPosition,
  ): RecommendedService[] {
    const historyCategories = getHistoryCategories(userProfile);
    const userEmbedding = userProfile.embedding ?? [];

    return services
      .map((service) => {
        const distanceKm = haversineDistanceKm(
          location.latitude,
          location.longitude,
          service.location.latitude,
          service.location.longitude,
        );

        const similarity =
          userEmbedding.length > 0 && service.embedding && service.embedding.length > 0
            ? calculateSimilarity(userEmbedding, service.embedding)
            : 0;

        const proxScore = proximityScore(distanceKm);
        const ratScore = ratingScore(service.averageRating);
        const histScore = historyMatchScore(service, historyCategories);

        const compatibilityScore = (ratScore + histScore) / 2;

        const relevanceScore =
          SIMILARITY_WEIGHT * Math.max(0, similarity) +
          PROXIMITY_WEIGHT * proxScore +
          COMPATIBILITY_WEIGHT * compatibilityScore;

        const matchReasons: string[] = [];
        if (historyCategories.has(service.category)) {
          matchReasons.push('From your search history');
        }
        if (similarity > 0.5) {
          matchReasons.push('Matches your profile');
        }
        if (distanceKm <= 5) {
          matchReasons.push('Near you');
        }
        if (service.averageRating >= 4) {
          matchReasons.push('Highly rated');
        }

        return {
          service,
          relevanceScore,
          distanceKm,
          matchReasons,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private _buildServicesFromResults(
    results: VectorSearchResult[],
  ): ServiceProvider[] {
    return results.map((r) => ({
      id: r.serviceId,
      name: r.metadata.name ?? '',
      description: r.metadata.description ?? '',
      category: (r.metadata.category as ServiceProvider['category']) ?? 'outros',
      phone: '',
      hasWhatsApp: r.metadata.hasWhatsApp ?? false,
      whatsAppConfirmed: false,
      address: '',
      location: {
        latitude: r.metadata.latitude ?? 0,
        longitude: r.metadata.longitude ?? 0,
        accuracy: 0,
        timestamp: Date.now(),
      },
      averageRating: r.metadata.rating ?? 0,
      totalRatings: 0,
      recentRatings: [],
      registeredBy: '',
      neighborhoodScore: 0,
      dataSource: 'manual' as const,
      verifiedByUsers: 0,
      embedding: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    }));
  }
}
