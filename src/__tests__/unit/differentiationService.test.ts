/**
 * Unit tests for DifferentiationService
 *
 * Verifies:
 * 1. Community boost for locally-registered services (Req 13.2)
 * 2. "Recomendado por vizinhos" indicator (Req 13.3, 13.4)
 * 3. Situational context search (Req 13.5)
 * 4. Interaction history for recontact (Req 13.7)
 * 5. Complementary service suggestions (Req 13.9)
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.9
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import { DifferentiationService } from '@client/services/differentiationService';
import type { ServiceProvider, Rating, GeoPosition } from '@shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLocation(lat = -23.55, lon = -46.63): GeoPosition {
  return { latitude: lat, longitude: lon, accuracy: 10, timestamp: Date.now() };
}

function makeService(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: crypto.randomUUID(),
    name: 'Eletricista João',
    description: 'Serviços elétricos',
    category: 'reparos_domesticos',
    subcategory: 'eletricista',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua A, 100',
    location: makeLocation(),
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

function makeRating(overrides: Partial<Rating> = {}): Rating {
  return {
    id: crypto.randomUUID(),
    serviceId: 'svc-1',
    userId: 'user-1',
    score: 5,
    userLocation: makeLocation(),
    isNeighbor: true,
    createdAt: Date.now(),
    helpful: 0,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DifferentiationService', () => {
  let db: AppDatabase;
  let service: DifferentiationService;

  beforeEach(async () => {
    db = new AppDatabase(`test-diff-${Date.now()}-${Math.random()}`);
    service = new DifferentiationService(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  // ── 1. Community Boost (Req 13.2) ──────────────────────────────────────

  describe('applyCommunityBoost', () => {
    it('should boost community-registered services (dataSource=manual)', () => {
      const communityService = makeService({ id: 's1', dataSource: 'manual' });
      const externalService = makeService({ id: 's2', dataSource: 'kaggle' });
      const scores = new Map([['s1', 0.8], ['s2', 0.8]]);

      const results = service.applyCommunityBoost(
        [communityService, externalService],
        scores,
      );

      expect(results[0].boostedScore).toBe(0.8 * 1.25); // community boost
      expect(results[1].boostedScore).toBe(0.8); // no boost
    });

    it('should not boost external sources', () => {
      const sources: Array<ServiceProvider['dataSource']> = ['kaggle', 'web_scraping', 'api', 'partnership'];
      for (const dataSource of sources) {
        const svc = makeService({ id: 'ext', dataSource });
        const scores = new Map([['ext', 1.0]]);
        const [result] = service.applyCommunityBoost([svc], scores);
        expect(result.boostedScore).toBe(1.0);
      }
    });

    it('should default to 0 score when service id not in scores map', () => {
      const svc = makeService({ id: 'unknown' });
      const scores = new Map<string, number>();
      const [result] = service.applyCommunityBoost([svc], scores);
      expect(result.boostedScore).toBe(0);
    });

    it('should preserve original service properties', () => {
      const svc = makeService({ id: 's1', name: 'Test Service', dataSource: 'manual' });
      const scores = new Map([['s1', 0.5]]);
      const [result] = service.applyCommunityBoost([svc], scores);
      expect(result.name).toBe('Test Service');
      expect(result.id).toBe('s1');
    });
  });

  // ── 2. "Recomendado por vizinhos" (Req 13.3, 13.4) ────────────────────

  describe('isNeighborRecommended', () => {
    it('should return true when neighborhoodScore >= 0.7 and has enough neighbor ratings', () => {
      const svc = makeService({ neighborhoodScore: 0.8 });
      const ratings = [
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: true }),
      ];
      expect(service.isNeighborRecommended(svc, ratings)).toBe(true);
    });

    it('should return false when neighborhoodScore < 0.7', () => {
      const svc = makeService({ neighborhoodScore: 0.5 });
      const ratings = [
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: true }),
      ];
      expect(service.isNeighborRecommended(svc, ratings)).toBe(false);
    });

    it('should return false when not enough neighbor ratings', () => {
      const svc = makeService({ neighborhoodScore: 0.9 });
      const ratings = [
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: false }),
      ];
      expect(service.isNeighborRecommended(svc, ratings)).toBe(false);
    });

    it('should return true at exactly the threshold', () => {
      const svc = makeService({ neighborhoodScore: 0.7 });
      const ratings = [
        makeRating({ isNeighbor: true }),
        makeRating({ isNeighbor: true }),
      ];
      expect(service.isNeighborRecommended(svc, ratings)).toBe(true);
    });
  });

  describe('isNeighborRating', () => {
    it('should return true for ratings within the radius', () => {
      const ratingLoc = makeLocation(-23.55, -46.63);
      const serviceLoc = makeLocation(-23.551, -46.631);
      expect(service.isNeighborRating(ratingLoc, serviceLoc)).toBe(true);
    });

    it('should return false for ratings outside the radius', () => {
      const ratingLoc = makeLocation(-23.55, -46.63);
      const serviceLoc = makeLocation(-22.55, -45.63); // ~150km away
      expect(service.isNeighborRating(ratingLoc, serviceLoc)).toBe(false);
    });

    it('should respect custom radius', () => {
      const ratingLoc = makeLocation(-23.55, -46.63);
      const serviceLoc = makeLocation(-23.60, -46.63); // ~5.5km away
      expect(service.isNeighborRating(ratingLoc, serviceLoc, 3)).toBe(false);
      expect(service.isNeighborRating(ratingLoc, serviceLoc, 10)).toBe(true);
    });
  });

  describe('markNeighborRecommended', () => {
    it('should mark services with enough neighbor ratings', async () => {
      const svc = makeService({ id: 'svc-1', neighborhoodScore: 0.9 });
      await db.services.put(svc);
      await db.ratings.bulkPut([
        makeRating({ serviceId: 'svc-1', isNeighbor: true }),
        makeRating({ serviceId: 'svc-1', isNeighbor: true }),
      ]);

      const boosted = [{ ...svc, boostedScore: 1.0, isNeighborRecommended: false }];
      const results = await service.markNeighborRecommended(boosted);
      expect(results[0].isNeighborRecommended).toBe(true);
    });
  });

  // ── 3. Situational Context Search (Req 13.5) ──────────────────────────

  describe('matchSituationalContext', () => {
    it('should match exact known phrases', () => {
      const result = service.matchSituationalContext('acabei de me mudar');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('moving');
      expect(result!.suggestedCategories).toContain('eletricista');
      expect(result!.suggestedCategories).toContain('diarista');
    });

    it('should match "reforma em andamento"', () => {
      const result = service.matchSituationalContext('reforma em andamento');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('renovation');
      expect(result!.suggestedCategories).toContain('pedreiro');
    });

    it('should match "emergência"', () => {
      const result = service.matchSituationalContext('emergência');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('emergency');
    });

    it('should be case-insensitive', () => {
      const result = service.matchSituationalContext('ACABEI DE ME MUDAR');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('moving');
    });

    it('should match partial phrases', () => {
      const result = service.matchSituationalContext('preciso de ajuda, acabei de me mudar para cá');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('moving');
    });

    it('should return null for unrecognized queries', () => {
      const result = service.matchSituationalContext('quero pizza');
      expect(result).toBeNull();
    });
  });

  describe('searchBySituationalContext', () => {
    beforeEach(async () => {
      await db.services.bulkPut([
        makeService({ id: 's1', subcategory: 'eletricista', averageRating: 4.5 }),
        makeService({ id: 's2', subcategory: 'encanador', averageRating: 4.8 }),
        makeService({ id: 's3', subcategory: 'pintor', averageRating: 3.5 }),
        makeService({ id: 's4', subcategory: 'mecanico', averageRating: 5.0 }),
      ]);
    });

    it('should return services matching the situational context', async () => {
      const result = await service.searchBySituationalContext('acabei de me mudar');
      expect(result).not.toBeNull();
      expect(result!.context.type).toBe('moving');
      // Should include eletricista, encanador, pintor but not mecanico
      const ids = result!.services.map((s) => s.id);
      expect(ids).toContain('s1');
      expect(ids).toContain('s2');
      expect(ids).toContain('s3');
      expect(ids).not.toContain('s4');
    });

    it('should sort results by rating descending', async () => {
      const result = await service.searchBySituationalContext('acabei de me mudar');
      expect(result).not.toBeNull();
      const ratings = result!.services.map((s) => s.averageRating);
      for (let i = 1; i < ratings.length; i++) {
        expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
      }
    });

    it('should return null for unrecognized context', async () => {
      const result = await service.searchBySituationalContext('quero pizza');
      expect(result).toBeNull();
    });

    it('should filter by distance when user location is provided', async () => {
      // Add a far-away service
      await db.services.put(
        makeService({ id: 's-far', subcategory: 'eletricista', location: makeLocation(-22.0, -45.0) }),
      );

      const result = await service.searchBySituationalContext(
        'acabei de me mudar',
        makeLocation(-23.55, -46.63),
        10,
      );
      expect(result).not.toBeNull();
      const ids = result!.services.map((s) => s.id);
      expect(ids).not.toContain('s-far');
    });
  });

  // ── 4. Interaction History (Req 13.7) ──────────────────────────────────

  describe('recordInteraction', () => {
    it('should store an interaction record', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');
      const records = await db.interactionHistory.toArray();
      expect(records).toHaveLength(1);
      expect(records[0].userId).toBe('user-1');
      expect(records[0].serviceId).toBe('svc-1');
      expect(records[0].type).toBe('view');
    });

    it('should store multiple interactions for the same user-service pair', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');
      await service.recordInteraction('user-1', 'svc-1', 'contact');
      const records = await db.interactionHistory.toArray();
      expect(records).toHaveLength(2);
    });

    it('should store details when provided', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'contact', 'Called via WhatsApp');
      const records = await db.interactionHistory.toArray();
      expect(records[0].details).toBe('Called via WhatsApp');
    });
  });

  describe('getInteractionHistory', () => {
    beforeEach(async () => {
      await db.services.bulkPut([
        makeService({ id: 'svc-1', name: 'Eletricista João', category: 'reparos_domesticos' }),
        makeService({ id: 'svc-2', name: 'Encanador Pedro', category: 'reparos_domesticos' }),
      ]);
    });

    it('should return enriched interaction history sorted by most recent', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');
      // Small delay to ensure different timestamps
      await service.recordInteraction('user-1', 'svc-2', 'contact');

      const history = await service.getInteractionHistory('user-1');
      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0].lastInteraction).toBeGreaterThanOrEqual(history[1].lastInteraction);
    });

    it('should group interactions by service', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');
      await service.recordInteraction('user-1', 'svc-1', 'contact');
      await service.recordInteraction('user-1', 'svc-1', 'rating');

      const history = await service.getInteractionHistory('user-1');
      expect(history).toHaveLength(1);
      expect(history[0].interactions).toHaveLength(3);
    });

    it('should include service details for recontact', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');

      const history = await service.getInteractionHistory('user-1');
      expect(history[0].serviceName).toBe('Eletricista João');
      expect(history[0].servicePhone).toBe('(11) 99999-0000');
      expect(history[0].hasWhatsApp).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      await service.recordInteraction('user-1', 'svc-1', 'view');
      await service.recordInteraction('user-1', 'svc-2', 'view');

      const history = await service.getInteractionHistory('user-1', 1);
      expect(history).toHaveLength(1);
    });

    it('should return empty array when no interactions exist', async () => {
      const history = await service.getInteractionHistory('user-1');
      expect(history).toEqual([]);
    });

    it('should skip services that no longer exist in the database', async () => {
      await service.recordInteraction('user-1', 'deleted-svc', 'view');
      const history = await service.getInteractionHistory('user-1');
      expect(history).toEqual([]);
    });
  });

  // ── 5. Complementary Service Suggestions (Req 13.9) ────────────────────

  describe('suggestComplementaryServices', () => {
    beforeEach(async () => {
      await db.services.bulkPut([
        makeService({ id: 's-encanador', subcategory: 'encanador', name: 'Encanador Pedro', averageRating: 4.8 }),
        makeService({ id: 's-pintor', subcategory: 'pintor', name: 'Pintor Carlos', averageRating: 4.2 }),
        makeService({ id: 's-gesseiro', subcategory: 'gesseiro', name: 'Gesseiro Marcos', averageRating: 4.5 }),
        makeService({ id: 's-mecanico', subcategory: 'mecanico', name: 'Mecânico José', averageRating: 4.9 }),
      ]);
    });

    it('should suggest complementary services for an electrician', async () => {
      const electrician = makeService({ id: 's-eletricista', subcategory: 'eletricista' });
      const suggestions = await service.suggestComplementaryServices(electrician);

      // Electrician complements: encanador, pintor, gesseiro
      expect(suggestions.length).toBeGreaterThan(0);
      const subcategories = suggestions.map((s) => s.service.subcategory);
      expect(subcategories).toContain('encanador');
    });

    it('should not suggest the current service itself', async () => {
      const electrician = makeService({ id: 's-encanador', subcategory: 'eletricista' });
      const suggestions = await service.suggestComplementaryServices(electrician);
      const ids = suggestions.map((s) => s.service.id);
      expect(ids).not.toContain('s-encanador');
    });

    it('should sort suggestions by rating descending', async () => {
      const electrician = makeService({ id: 's-eletricista', subcategory: 'eletricista' });
      const suggestions = await service.suggestComplementaryServices(electrician);
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].service.averageRating).toBeLessThanOrEqual(
          suggestions[i - 1].service.averageRating,
        );
      }
    });

    it('should respect the limit parameter', async () => {
      const electrician = makeService({ id: 's-eletricista', subcategory: 'eletricista' });
      const suggestions = await service.suggestComplementaryServices(electrician, undefined, 1);
      expect(suggestions).toHaveLength(1);
    });

    it('should return empty array for subcategory with no complements', async () => {
      const svc = makeService({ subcategory: 'tecnico_informatica' });
      const suggestions = await service.suggestComplementaryServices(svc);
      expect(suggestions).toEqual([]);
    });

    it('should include reason in suggestion', async () => {
      const electrician = makeService({ id: 's-eletricista', subcategory: 'eletricista' });
      const suggestions = await service.suggestComplementaryServices(electrician);
      expect(suggestions[0].reason).toContain('eletricista');
    });
  });

  describe('getComplementaryCategories', () => {
    it('should return complementary categories for eletricista', () => {
      const complements = service.getComplementaryCategories('eletricista');
      expect(complements).toContain('encanador');
      expect(complements).toContain('pintor');
      expect(complements).toContain('gesseiro');
    });

    it('should return empty array for unknown subcategory', () => {
      const complements = service.getComplementaryCategories('unknown');
      expect(complements).toEqual([]);
    });
  });
});
