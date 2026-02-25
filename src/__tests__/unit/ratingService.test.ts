/**
 * Unit tests for RatingService
 *
 * Verifies:
 * 1. Rating submission with score validation (1-5)
 * 2. Comment validation (max 500 chars)
 * 3. Real-time average calculation after submission
 * 4. Ranking recalculation (service averageRating updated)
 * 5. Retrieval of 3 most recent ratings
 *
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import { RatingService, type SubmitRatingInput } from '@client/services/ratingService';
import type { ServiceProvider, GeoPosition } from '@shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLocation(lat = -23.55, lon = -46.63): GeoPosition {
  return { latitude: lat, longitude: lon, accuracy: 10, timestamp: Date.now() };
}

function makeService(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'svc-1',
    name: 'Eletricista João',
    description: 'Serviços elétricos',
    category: 'reparos_domesticos',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua A, 100',
    location: makeLocation(),
    averageRating: 0,
    totalRatings: 0,
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

function makeRatingInput(overrides: Partial<SubmitRatingInput> = {}): SubmitRatingInput {
  return {
    serviceId: 'svc-1',
    userId: 'user-1',
    score: 4,
    userLocation: makeLocation(),
    isNeighbor: true,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RatingService', () => {
  let db: AppDatabase;
  let service: RatingService;

  beforeEach(async () => {
    db = new AppDatabase(`test-rating-${Date.now()}-${Math.random()}`);
    service = new RatingService(db);
    // Seed a service for rating tests
    await db.services.put(makeService());
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('submitRating', () => {
    it('should persist a rating and return it with correct fields', async () => {
      const input = makeRatingInput({ score: 5, comment: 'Excelente!' });
      const result = await service.submitRating(input);

      expect(result.rating.serviceId).toBe('svc-1');
      expect(result.rating.userId).toBe('user-1');
      expect(result.rating.score).toBe(5);
      expect(result.rating.comment).toBe('Excelente!');
      expect(result.rating.isNeighbor).toBe(true);
      expect(result.rating.helpful).toBe(0);
      expect(result.rating.id).toBeDefined();
      expect(result.rating.createdAt).toBeGreaterThan(0);
    });

    it('should store the rating in the database', async () => {
      const result = await service.submitRating(makeRatingInput());
      const stored = await db.ratings.get(result.rating.id);
      expect(stored).toBeDefined();
      expect(stored!.score).toBe(4);
    });

    it('should accept ratings without a comment', async () => {
      const input = makeRatingInput({ comment: undefined });
      const result = await service.submitRating(input);
      expect(result.rating.comment).toBeUndefined();
    });

    it('should accept a comment with exactly 500 characters', async () => {
      const comment = 'a'.repeat(500);
      const input = makeRatingInput({ comment });
      const result = await service.submitRating(input);
      expect(result.rating.comment).toBe(comment);
    });
  });

  describe('score validation', () => {
    it('should reject score of 0', async () => {
      await expect(service.submitRating(makeRatingInput({ score: 0 }))).rejects.toThrow(
        'Rating score must be an integer between 1 and 5',
      );
    });

    it('should reject score of 6', async () => {
      await expect(service.submitRating(makeRatingInput({ score: 6 }))).rejects.toThrow(
        'Rating score must be an integer between 1 and 5',
      );
    });

    it('should reject non-integer score', async () => {
      await expect(service.submitRating(makeRatingInput({ score: 3.5 }))).rejects.toThrow(
        'Rating score must be an integer between 1 and 5',
      );
    });

    it('should reject negative score', async () => {
      await expect(service.submitRating(makeRatingInput({ score: -1 }))).rejects.toThrow(
        'Rating score must be an integer between 1 and 5',
      );
    });

    it('should accept scores 1 through 5', async () => {
      for (const score of [1, 2, 3, 4, 5]) {
        const result = await service.submitRating(
          makeRatingInput({ score, userId: `user-${score}` }),
        );
        expect(result.rating.score).toBe(score);
      }
    });
  });

  describe('comment validation', () => {
    it('should reject comment exceeding 500 characters', async () => {
      const comment = 'a'.repeat(501);
      await expect(service.submitRating(makeRatingInput({ comment }))).rejects.toThrow(
        'Comment must not exceed 500 characters',
      );
    });

    it('should accept empty string comment', async () => {
      const result = await service.submitRating(makeRatingInput({ comment: '' }));
      expect(result.rating.comment).toBe('');
    });
  });

  describe('average calculation (Requirement 5.2)', () => {
    it('should return correct average for a single rating', async () => {
      const result = await service.submitRating(makeRatingInput({ score: 4 }));
      expect(result.newAverageRating).toBe(4);
      expect(result.newTotalRatings).toBe(1);
    });

    it('should calculate correct average for multiple ratings', async () => {
      await service.submitRating(makeRatingInput({ score: 5, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ score: 3, userId: 'u2' }));
      const result = await service.submitRating(makeRatingInput({ score: 4, userId: 'u3' }));

      // (5 + 3 + 4) / 3 = 4.0
      expect(result.newAverageRating).toBe(4);
      expect(result.newTotalRatings).toBe(3);
    });

    it('should round average to 2 decimal places', async () => {
      await service.submitRating(makeRatingInput({ score: 5, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ score: 4, userId: 'u2' }));
      const result = await service.submitRating(makeRatingInput({ score: 4, userId: 'u3' }));

      // (5 + 4 + 4) / 3 = 4.333... → 4.33
      expect(result.newAverageRating).toBe(4.33);
    });

    it('should return 0 average for service with no ratings via recalculateAverage', async () => {
      const { newAverage, newTotal } = await service.recalculateAverage('nonexistent-svc');
      expect(newAverage).toBe(0);
      expect(newTotal).toBe(0);
    });
  });

  describe('ranking recalculation (Requirement 5.4)', () => {
    it('should update the service averageRating in the database', async () => {
      await service.submitRating(makeRatingInput({ score: 5, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ score: 3, userId: 'u2' }));

      const updatedService = await db.services.get('svc-1');
      expect(updatedService!.averageRating).toBe(4);
      expect(updatedService!.totalRatings).toBe(2);
    });

    it('should update the service updatedAt timestamp', async () => {
      const before = Date.now();
      await service.submitRating(makeRatingInput({ score: 4 }));
      const updatedService = await db.services.get('svc-1');
      expect(updatedService!.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('should update recentRatings on the service', async () => {
      await service.submitRating(makeRatingInput({ score: 5 }));
      const updatedService = await db.services.get('svc-1');
      expect(updatedService!.recentRatings).toHaveLength(1);
      expect(updatedService!.recentRatings[0].score).toBe(5);
    });
  });

  describe('getRecentRatings (Requirement 5.5)', () => {
    it('should return empty array when no ratings exist', async () => {
      const recent = await service.getRecentRatings('svc-1');
      expect(recent).toEqual([]);
    });

    it('should return all ratings when fewer than 3 exist', async () => {
      await service.submitRating(makeRatingInput({ score: 4, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ score: 5, userId: 'u2' }));

      const recent = await service.getRecentRatings('svc-1');
      expect(recent).toHaveLength(2);
    });

    it('should return exactly 3 most recent ratings when more exist', async () => {
      // Submit 5 ratings with distinct timestamps
      for (let i = 0; i < 5; i++) {
        await service.submitRating(makeRatingInput({ score: (i % 5) + 1, userId: `u${i}` }));
      }

      const recent = await service.getRecentRatings('svc-1');
      expect(recent).toHaveLength(3);
    });

    it('should order ratings by createdAt descending (most recent first)', async () => {
      await service.submitRating(makeRatingInput({ score: 1, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ score: 3, userId: 'u2' }));
      await service.submitRating(makeRatingInput({ score: 5, userId: 'u3' }));

      const recent = await service.getRecentRatings('svc-1');
      expect(recent[0].createdAt).toBeGreaterThanOrEqual(recent[1].createdAt);
      expect(recent[1].createdAt).toBeGreaterThanOrEqual(recent[2].createdAt);
    });

    it('should only return ratings for the specified service', async () => {
      await db.services.put(makeService({ id: 'svc-2' }));
      await service.submitRating(makeRatingInput({ serviceId: 'svc-1', score: 4, userId: 'u1' }));
      await service.submitRating(makeRatingInput({ serviceId: 'svc-2', score: 2, userId: 'u2' }));

      const recent = await service.getRecentRatings('svc-1');
      expect(recent).toHaveLength(1);
      expect(recent[0].serviceId).toBe('svc-1');
    });
  });
});
