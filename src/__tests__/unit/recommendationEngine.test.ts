import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RecommendationEngine,
  calculateSimilarity,
} from '@client/services/recommendationEngine';
import type { ServiceProvider, GeoPosition } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import type { EmbeddingGenerator } from '@client/services/embeddingGenerator';
import type {
  VectorDatabaseClient,
  VectorSearchResult,
} from '@client/services/vectorDatabaseClient';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLocation(lat: number, lon: number): GeoPosition {
  return { latitude: lat, longitude: lon, accuracy: 10, timestamp: Date.now() };
}

function makeService(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'svc-1',
    name: 'Eletricista João',
    description: 'Serviços elétricos residenciais',
    category: 'reparos_domesticos',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua A, 100',
    location: makeLocation(-23.55, -46.63),
    averageRating: 4.5,
    totalRatings: 10,
    recentRatings: [],
    registeredBy: 'user-1',
    neighborhoodScore: 0.8,
    dataSource: 'manual',
    verifiedByUsers: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  };
}

function makeNewUserProfile(location: GeoPosition): UserProfile {
  return {
    id: 'user-new',
    location,
    searchHistory: [],
    viewedServices: [],
    registeredServices: [],
    favoriteCategories: [],
    explicitPreferences: [],
    inferredPreferences: [],
    promptHistory: [],
    ratings: [],
    behaviorMetrics: {
      preferredAccessTimes: [],
      avgSessionDuration: 0,
      categoryClickCounts: {},
      searchToContactRatio: 0,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    sessionCount: 1,
  };
}

function makeExistingUserProfile(
  location: GeoPosition,
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    ...makeNewUserProfile(location),
    id: 'user-existing',
    searchHistory: [
      { query: 'eletricista reparo doméstico', timestamp: Date.now(), resultsCount: 5 },
      { query: 'mecânico automotivo', timestamp: Date.now(), resultsCount: 3 },
    ],
    favoriteCategories: ['reparos_domesticos'],
    ...overrides,
  };
}

function makeMockEmbeddingGenerator(): EmbeddingGenerator {
  return {
    generateUserEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    generateQueryEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    generateServiceEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    isUsingFullModel: vi.fn().mockReturnValue(false),
    dispose: vi.fn(),
  } as unknown as EmbeddingGenerator;
}

function makeMockVectorClient(
  results: VectorSearchResult[] = [],
): VectorDatabaseClient {
  return {
    searchSimilar: vi.fn().mockResolvedValue(results),
    upsertServiceEmbedding: vi.fn().mockResolvedValue(undefined),
    deleteServiceEmbedding: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('calculateSimilarity', () => {
  it('returns 1 for identical normalized vectors', () => {
    const v = [0.5, 0.5, 0.5, 0.5];
    expect(calculateSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(calculateSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(calculateSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 for empty vectors', () => {
    expect(calculateSimilarity([], [])).toBe(0);
    expect(calculateSimilarity([1], [])).toBe(0);
  });

  it('handles vectors of different lengths by using the shorter', () => {
    const a = [1, 0, 0];
    const b = [1, 0];
    // Should compute over first 2 elements
    expect(calculateSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('returns 0 for zero vectors', () => {
    expect(calculateSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockEmbedding: EmbeddingGenerator;
  let mockVector: VectorDatabaseClient;
  const userLocation = makeLocation(-23.55, -46.63);

  beforeEach(() => {
    mockEmbedding = makeMockEmbeddingGenerator();
    mockVector = makeMockVectorClient();
    engine = new RecommendationEngine(mockEmbedding, mockVector);
  });

  describe('rankByRelevance', () => {
    it('orders new users by averageRating descending', () => {
      const profile = makeNewUserProfile(userLocation);
      const services = [
        makeService({ id: 'a', averageRating: 3.0 }),
        makeService({ id: 'b', averageRating: 5.0 }),
        makeService({ id: 'c', averageRating: 4.0 }),
      ];

      const ranked = engine.rankByRelevance(services, profile, userLocation);

      expect(ranked[0].service.id).toBe('b');
      expect(ranked[1].service.id).toBe('c');
      expect(ranked[2].service.id).toBe('a');
    });

    it('uses averageRating as relevanceScore for new users', () => {
      const profile = makeNewUserProfile(userLocation);
      const services = [makeService({ averageRating: 4.2 })];

      const ranked = engine.rankByRelevance(services, profile, userLocation);
      expect(ranked[0].relevanceScore).toBe(4.2);
    });

    it('adds "Bem avaliado na região" reason for rating >= 4', () => {
      const profile = makeNewUserProfile(userLocation);
      const services = [makeService({ averageRating: 4.5 })];

      const ranked = engine.rankByRelevance(services, profile, userLocation);
      expect(ranked[0].matchReasons).toContain('Bem avaliado na região');
    });

    it('adds "Próximo de você" reason for distance <= 5km', () => {
      const profile = makeNewUserProfile(userLocation);
      // Same location → 0 km distance
      const services = [makeService({ location: userLocation })];

      const ranked = engine.rankByRelevance(services, profile, userLocation);
      expect(ranked[0].matchReasons).toContain('Próximo de você');
    });

    it('prioritizes history categories for existing users', () => {
      const profile = makeExistingUserProfile(userLocation);
      // profile has 'reparos_domesticos' in favorites and search history
      const svcMatch = makeService({
        id: 'match',
        category: 'reparos_domesticos',
        averageRating: 3.0,
        location: userLocation,
      });
      const svcNoMatch = makeService({
        id: 'nomatch',
        category: 'outros',
        averageRating: 3.0,
        location: userLocation,
      });

      const ranked = engine.rankByRelevance(
        [svcNoMatch, svcMatch],
        profile,
        userLocation,
      );

      // The matching category service should rank higher
      expect(ranked[0].service.id).toBe('match');
      expect(ranked[0].matchReasons).toContain('Categoria do seu histórico');
    });

    it('computes distanceKm correctly', () => {
      const profile = makeNewUserProfile(userLocation);
      const farLocation = makeLocation(-23.60, -46.70);
      const services = [makeService({ location: farLocation })];

      const ranked = engine.rankByRelevance(services, profile, userLocation);
      expect(ranked[0].distanceKm).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations', () => {
    it('returns empty array when vector search returns no results', async () => {
      const profile = makeNewUserProfile(userLocation);
      const results = await engine.getRecommendations(profile, userLocation);
      expect(results).toEqual([]);
    });

    it('returns recommendations from vector search results', async () => {
      const vectorResults: VectorSearchResult[] = [
        {
          serviceId: 'svc-1',
          similarity: 0.9,
          metadata: {
            name: 'Eletricista',
            category: 'reparos_domesticos',
            rating: 4.5,
            latitude: -23.55,
            longitude: -46.63,
          },
        },
      ];
      mockVector = makeMockVectorClient(vectorResults);
      engine = new RecommendationEngine(mockEmbedding, mockVector);

      const profile = makeNewUserProfile(userLocation);
      const results = await engine.getRecommendations(profile, userLocation, 5);

      expect(results.length).toBe(1);
      expect(results[0].service.id).toBe('svc-1');
    });

    it('respects the limit parameter', async () => {
      const vectorResults: VectorSearchResult[] = Array.from(
        { length: 10 },
        (_, i) => ({
          serviceId: `svc-${i}`,
          similarity: 0.9 - i * 0.05,
          metadata: {
            name: `Service ${i}`,
            category: 'outros',
            rating: 4.0,
            latitude: -23.55,
            longitude: -46.63,
          },
        }),
      );
      mockVector = makeMockVectorClient(vectorResults);
      engine = new RecommendationEngine(mockEmbedding, mockVector);

      const profile = makeNewUserProfile(userLocation);
      const results = await engine.getRecommendations(profile, userLocation, 3);

      expect(results.length).toBe(3);
    });

    it('rejects if recommendation takes longer than 2 seconds', async () => {
      // Make the embedding generator hang for 3 seconds
      const slowEmbedding = makeMockEmbeddingGenerator();
      (slowEmbedding.generateUserEmbedding as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new Array(384).fill(0.1)), 3000)),
      );
      engine = new RecommendationEngine(slowEmbedding, mockVector);

      const profile = makeNewUserProfile(userLocation);
      await expect(
        engine.getRecommendations(profile, userLocation),
      ).rejects.toThrow('Recommendation timeout: exceeded 2 seconds');
    }, 5000);
  });
});
