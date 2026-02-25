/**
 * Unit tests for CategoryService
 *
 * Verifies:
 * 1. Category and subcategory structure (Req 10.1, 10.2)
 * 2. Service count per category within geographic radius (Req 10.3)
 * 3. Filtering by category preserving relevance order (Req 10.4)
 * 4. Favoriting/unfavoriting categories persisted in UserProfile (Req 10.5)
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import { CategoryService, CATEGORIES } from '@client/services/categoryService';
import type { ServiceProvider, GeoPosition, ServiceCategory } from '@shared/types';
import type { UserProfile } from '@shared/types/user';

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

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    location: makeLocation(),
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
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CategoryService', () => {
  let db: AppDatabase;
  let service: CategoryService;

  beforeEach(async () => {
    db = new AppDatabase(`test-category-${Date.now()}-${Math.random()}`);
    service = new CategoryService(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  // ── Category structure (Req 10.1, 10.2) ────────────────────────────────

  describe('getAllCategories', () => {
    it('should return all 5 main categories', () => {
      const categories = service.getAllCategories();
      expect(categories).toHaveLength(5);
      const ids = categories.map((c) => c.id);
      expect(ids).toContain('reparos_domesticos');
      expect(ids).toContain('servicos_pessoais');
      expect(ids).toContain('automotivo');
      expect(ids).toContain('construcao');
      expect(ids).toContain('outros');
    });

    it('should have name and icon for every category', () => {
      for (const cat of service.getAllCategories()) {
        expect(cat.name).toBeTruthy();
        expect(cat.icon).toBeTruthy();
      }
    });

    it('should have at least one subcategory per category', () => {
      for (const cat of service.getAllCategories()) {
        expect(cat.subcategories.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('getCategoryById', () => {
    it('should return the correct category', () => {
      const cat = service.getCategoryById('automotivo');
      expect(cat).toBeDefined();
      expect(cat!.name).toBe('Automotivo');
    });

    it('should return undefined for unknown id', () => {
      const cat = service.getCategoryById('nonexistent' as ServiceCategory);
      expect(cat).toBeUndefined();
    });
  });

  describe('getSubcategories', () => {
    it('should return subcategories for a valid category', () => {
      const subs = service.getSubcategories('reparos_domesticos');
      expect(subs.length).toBeGreaterThan(0);
      expect(subs.some((s) => s.id === 'eletricista')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const subs = service.getSubcategories('nonexistent' as ServiceCategory);
      expect(subs).toEqual([]);
    });

    it('each subcategory should have keywords for semantic search', () => {
      for (const cat of CATEGORIES) {
        for (const sub of cat.subcategories) {
          expect(sub.keywords.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ── Service count per category (Req 10.3) ──────────────────────────────

  describe('getServiceCountsByCategory', () => {
    it('should return zero counts when no services exist', async () => {
      const counts = await service.getServiceCountsByCategory(makeLocation());
      expect(counts).toHaveLength(5);
      for (const c of counts) {
        expect(c.count).toBe(0);
      }
    });

    it('should count active services within radius', async () => {
      // Services near user (within 5km default)
      await db.services.bulkPut([
        makeService({ id: 's1', category: 'reparos_domesticos', location: makeLocation(-23.55, -46.63) }),
        makeService({ id: 's2', category: 'reparos_domesticos', location: makeLocation(-23.551, -46.631) }),
        makeService({ id: 's3', category: 'automotivo', location: makeLocation(-23.552, -46.632) }),
      ]);

      const counts = await service.getServiceCountsByCategory(makeLocation(-23.55, -46.63));
      const reparos = counts.find((c) => c.categoryId === 'reparos_domesticos');
      const auto = counts.find((c) => c.categoryId === 'automotivo');
      expect(reparos!.count).toBe(2);
      expect(auto!.count).toBe(1);
    });

    it('should exclude services outside the radius', async () => {
      // Service far away (~111km north)
      await db.services.put(
        makeService({ id: 's-far', category: 'automotivo', location: makeLocation(-22.55, -46.63) }),
      );

      const counts = await service.getServiceCountsByCategory(makeLocation(-23.55, -46.63), 5);
      const auto = counts.find((c) => c.categoryId === 'automotivo');
      expect(auto!.count).toBe(0);
    });

    it('should exclude inactive services', async () => {
      await db.services.put(
        makeService({ id: 's-inactive', category: 'construcao', isActive: false }),
      );

      const counts = await service.getServiceCountsByCategory(makeLocation());
      const construcao = counts.find((c) => c.categoryId === 'construcao');
      expect(construcao!.count).toBe(0);
    });
  });

  // ── Filter by category (Req 10.4) ──────────────────────────────────────

  describe('filterByCategory', () => {
    it('should return only services matching the category', () => {
      const services = [
        makeService({ id: 's1', category: 'reparos_domesticos' }),
        makeService({ id: 's2', category: 'automotivo' }),
        makeService({ id: 's3', category: 'reparos_domesticos' }),
      ];

      const filtered = service.filterByCategory(services, 'reparos_domesticos');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((s) => s.category === 'reparos_domesticos')).toBe(true);
    });

    it('should preserve the original order (relevance ordering)', () => {
      const services = [
        makeService({ id: 'first', category: 'automotivo', averageRating: 5 }),
        makeService({ id: 'second', category: 'reparos_domesticos', averageRating: 3 }),
        makeService({ id: 'third', category: 'automotivo', averageRating: 1 }),
      ];

      const filtered = service.filterByCategory(services, 'automotivo');
      expect(filtered[0].id).toBe('first');
      expect(filtered[1].id).toBe('third');
    });

    it('should return empty array when no services match', () => {
      const services = [makeService({ category: 'automotivo' })];
      const filtered = service.filterByCategory(services, 'construcao');
      expect(filtered).toEqual([]);
    });
  });

  describe('filterBySubcategory', () => {
    it('should filter by subcategory preserving order', () => {
      const services = [
        makeService({ id: 's1', subcategory: 'eletricista' }),
        makeService({ id: 's2', subcategory: 'encanador' }),
        makeService({ id: 's3', subcategory: 'eletricista' }),
      ];

      const filtered = service.filterBySubcategory(services, 'eletricista');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('s1');
      expect(filtered[1].id).toBe('s3');
    });
  });

  // ── Favorite categories (Req 10.5) ─────────────────────────────────────

  describe('favoriteCategory', () => {
    beforeEach(async () => {
      await db.userProfile.put(makeUserProfile());
    });

    it('should add a category to favorites', async () => {
      await service.favoriteCategory('user-1', 'automotivo');
      const favorites = await service.getFavoriteCategories('user-1');
      expect(favorites).toContain('automotivo');
    });

    it('should not duplicate if already favorited', async () => {
      await service.favoriteCategory('user-1', 'automotivo');
      await service.favoriteCategory('user-1', 'automotivo');
      const favorites = await service.getFavoriteCategories('user-1');
      expect(favorites.filter((c) => c === 'automotivo')).toHaveLength(1);
    });

    it('should throw when user profile not found', async () => {
      await expect(service.favoriteCategory('nonexistent', 'automotivo')).rejects.toThrow(
        'UserProfile not found',
      );
    });
  });

  describe('unfavoriteCategory', () => {
    beforeEach(async () => {
      await db.userProfile.put(makeUserProfile({ favoriteCategories: ['automotivo', 'construcao'] }));
    });

    it('should remove a category from favorites', async () => {
      await service.unfavoriteCategory('user-1', 'automotivo');
      const favorites = await service.getFavoriteCategories('user-1');
      expect(favorites).not.toContain('automotivo');
      expect(favorites).toContain('construcao');
    });

    it('should be a no-op when category is not in favorites', async () => {
      await service.unfavoriteCategory('user-1', 'outros');
      const favorites = await service.getFavoriteCategories('user-1');
      expect(favorites).toHaveLength(2);
    });

    it('should throw when user profile not found', async () => {
      await expect(service.unfavoriteCategory('nonexistent', 'automotivo')).rejects.toThrow(
        'UserProfile not found',
      );
    });
  });

  describe('getFavoriteCategories', () => {
    it('should return empty array when user has no profile', async () => {
      const favorites = await service.getFavoriteCategories('nonexistent');
      expect(favorites).toEqual([]);
    });

    it('should return the persisted favorites', async () => {
      await db.userProfile.put(makeUserProfile({ favoriteCategories: ['automotivo'] }));
      const favorites = await service.getFavoriteCategories('user-1');
      expect(favorites).toEqual(['automotivo']);
    });
  });

  describe('isFavorite', () => {
    beforeEach(async () => {
      await db.userProfile.put(makeUserProfile({ favoriteCategories: ['automotivo'] }));
    });

    it('should return true for a favorited category', async () => {
      expect(await service.isFavorite('user-1', 'automotivo')).toBe(true);
    });

    it('should return false for a non-favorited category', async () => {
      expect(await service.isFavorite('user-1', 'construcao')).toBe(false);
    });
  });
});
