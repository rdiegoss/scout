/**
 * Unit tests for AppDatabase (Dexie.js IndexedDB schema)
 *
 * Verifies:
 * 1. Database can be created
 * 2. All tables exist with correct names
 * 3. Basic CRUD operations work on each table
 *
 * Validates: Requirements 9.1, 9.2
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import type { ServiceProvider, Rating, EmbeddingRecord, SyncQueueItem } from '@shared/types';
import type { UserProfile, SearchHistoryEntry, ViewedService } from '@shared/types/user';

describe('AppDatabase', () => {
  let db: AppDatabase;

  beforeEach(() => {
    const dbName = `test-db-${Date.now()}-${Math.random()}`;
    db = new AppDatabase(dbName);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Database creation', () => {
    it('should create the database successfully', async () => {
      expect(db).toBeDefined();
      // Dexie opens lazily on first operation
      await db.open();
      expect(db.isOpen()).toBe(true);
    });

    it('should have all expected tables', () => {
      const tableNames = db.tables.map((t: { name: string }) => t.name).sort();
      const expected = [
        'cachedEmbeddings',
        'interactionHistory',
        'ratings',
        'searchHistory',
        'services',
        'syncQueue',
        'userProfile',
        'viewedServices',
      ];
      expect(tableNames).toEqual(expected);
    });
  });

  describe('userProfile table', () => {
    it('should store and retrieve a user profile', async () => {
      const profile: UserProfile = {
        id: 'user-1',
        firstName: 'João',
        location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
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

      await db.userProfile.put(profile);
      const retrieved = await db.userProfile.get('user-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('user-1');
      expect(retrieved!.firstName).toBe('João');
    });

    it('should update an existing profile', async () => {
      const profile: UserProfile = {
        id: 'user-2',
        location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
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
        sessionCount: 0,
      };

      await db.userProfile.put(profile);
      await db.userProfile.update('user-2', { firstName: 'Maria', sessionCount: 5 });

      const retrieved = await db.userProfile.get('user-2');
      expect(retrieved!.firstName).toBe('Maria');
      expect(retrieved!.sessionCount).toBe(5);
    });

    it('should delete a profile', async () => {
      const profile: UserProfile = {
        id: 'user-del',
        location: { latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() },
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
        sessionCount: 0,
      };

      await db.userProfile.put(profile);
      await db.userProfile.delete('user-del');
      const retrieved = await db.userProfile.get('user-del');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('services table', () => {
    const makeService = (overrides: Partial<ServiceProvider> = {}): ServiceProvider => ({
      id: 'svc-1',
      name: 'Test Service',
      description: 'A test service provider',
      category: 'reparos_domesticos',
      phone: '(11) 99999-9999',
      hasWhatsApp: true,
      whatsAppConfirmed: false,
      address: 'Rua Test 123',
      location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
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
    });

    it('should store and retrieve a service', async () => {
      const service = makeService();
      await db.services.put(service);
      const retrieved = await db.services.get('svc-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Service');
    });

    it('should query services by category index', async () => {
      await db.services.bulkPut([
        makeService({ id: 's1', category: 'reparos_domesticos' }),
        makeService({ id: 's2', category: 'automotivo' }),
        makeService({ id: 's3', category: 'reparos_domesticos' }),
      ]);

      const results = await db.services.where('category').equals('reparos_domesticos').toArray();
      expect(results).toHaveLength(2);
      expect(results.every((s: ServiceProvider) => s.category === 'reparos_domesticos')).toBe(true);
    });

    it('should delete a service', async () => {
      await db.services.put(makeService());
      await db.services.delete('svc-1');
      const retrieved = await db.services.get('svc-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('ratings table', () => {
    const makeRating = (overrides: Partial<Rating> = {}): Rating => ({
      id: 'rating-1',
      serviceId: 'svc-1',
      userId: 'user-1',
      score: 4,
      comment: 'Great service',
      userLocation: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
      isNeighbor: true,
      createdAt: Date.now(),
      helpful: 5,
      ...overrides,
    });

    it('should store and retrieve a rating', async () => {
      const rating = makeRating();
      await db.ratings.put(rating);
      const retrieved = await db.ratings.get('rating-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.score).toBe(4);
    });

    it('should query ratings by serviceId index', async () => {
      await db.ratings.bulkPut([
        makeRating({ id: 'r1', serviceId: 'svc-1' }),
        makeRating({ id: 'r2', serviceId: 'svc-2' }),
        makeRating({ id: 'r3', serviceId: 'svc-1' }),
      ]);

      const results = await db.ratings.where('serviceId').equals('svc-1').toArray();
      expect(results).toHaveLength(2);
    });

    it('should query ratings by userId index', async () => {
      await db.ratings.bulkPut([
        makeRating({ id: 'r1', userId: 'user-1' }),
        makeRating({ id: 'r2', userId: 'user-2' }),
      ]);

      const results = await db.ratings.where('userId').equals('user-1').toArray();
      expect(results).toHaveLength(1);
    });
  });

  describe('searchHistory table', () => {
    it('should auto-increment id for search history entries', async () => {
      const id1 = await db.searchHistory.add({ query: 'eletricista', timestamp: Date.now(), resultsCount: 5 } as never);
      const id2 = await db.searchHistory.add({ query: 'encanador', timestamp: Date.now(), resultsCount: 3 } as never);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id2).toBeGreaterThan(id1 as number);
    });

    it('should query search history by query index', async () => {
      await db.searchHistory.add({ query: 'eletricista', timestamp: 1000, resultsCount: 3 } as never);
      await db.searchHistory.add({ query: 'eletricista', timestamp: 2000, resultsCount: 5 } as never);
      await db.searchHistory.add({ query: 'encanador', timestamp: 3000, resultsCount: 2 } as never);

      const results = await db.searchHistory.where('query').equals('eletricista').toArray();
      expect(results).toHaveLength(2);
    });
  });

  describe('viewedServices table', () => {
    it('should auto-increment id for viewed services', async () => {
      const id1 = await db.viewedServices.add({ serviceId: 'svc-1', viewedAt: Date.now(), duration: 30, contacted: false } as never);
      const id2 = await db.viewedServices.add({ serviceId: 'svc-2', viewedAt: Date.now(), duration: 15, contacted: true } as never);

      expect(id2).toBeGreaterThan(id1 as number);
    });

    it('should query viewed services by serviceId index', async () => {
      await db.viewedServices.add({ serviceId: 'svc-1', viewedAt: 1000, duration: 10, contacted: false } as never);
      await db.viewedServices.add({ serviceId: 'svc-1', viewedAt: 2000, duration: 20, contacted: true } as never);
      await db.viewedServices.add({ serviceId: 'svc-2', viewedAt: 3000, duration: 5, contacted: false } as never);

      const results = await db.viewedServices.where('serviceId').equals('svc-1').toArray();
      expect(results).toHaveLength(2);
    });
  });

  describe('syncQueue table', () => {
    it('should store and retrieve sync queue items', async () => {
      const item: SyncQueueItem = {
        id: 'sync-1',
        operation: 'create',
        entityType: 'service',
        entityId: 'svc-1',
        data: { name: 'Test' },
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      await db.syncQueue.put(item);
      const retrieved = await db.syncQueue.get('sync-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.status).toBe('pending');
    });

    it('should query sync queue by status index', async () => {
      await db.syncQueue.bulkPut([
        { id: 's1', operation: 'create', entityType: 'service', entityId: 'e1', data: {}, createdAt: 1000, retryCount: 0, maxRetries: 3, status: 'pending' } as SyncQueueItem,
        { id: 's2', operation: 'update', entityType: 'rating', entityId: 'e2', data: {}, createdAt: 2000, retryCount: 1, maxRetries: 3, status: 'failed' } as SyncQueueItem,
        { id: 's3', operation: 'create', entityType: 'profile', entityId: 'e3', data: {}, createdAt: 3000, retryCount: 0, maxRetries: 3, status: 'pending' } as SyncQueueItem,
      ]);

      const pending = await db.syncQueue.where('status').equals('pending').toArray();
      expect(pending).toHaveLength(2);
    });
  });

  describe('cachedEmbeddings table', () => {
    it('should store and retrieve cached embeddings', async () => {
      const embedding: EmbeddingRecord = {
        id: 'emb-1',
        entityType: 'service',
        entityId: 'svc-1',
        vector: new Array(384).fill(0.1),
        metadata: { category: 'reparos_domesticos', updatedAt: Date.now() },
      };

      await db.cachedEmbeddings.put(embedding);
      const retrieved = await db.cachedEmbeddings.get('emb-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.vector).toHaveLength(384);
    });

    it('should query embeddings by entityType index', async () => {
      await db.cachedEmbeddings.bulkPut([
        { id: 'e1', entityType: 'service', entityId: 's1', vector: [0.1], metadata: { updatedAt: 1000 } } as EmbeddingRecord,
        { id: 'e2', entityType: 'user', entityId: 'u1', vector: [0.2], metadata: { updatedAt: 2000 } } as EmbeddingRecord,
        { id: 'e3', entityType: 'service', entityId: 's2', vector: [0.3], metadata: { updatedAt: 3000 } } as EmbeddingRecord,
      ]);

      const serviceEmbeddings = await db.cachedEmbeddings.where('entityType').equals('service').toArray();
      expect(serviceEmbeddings).toHaveLength(2);
    });

    it('should query embeddings by entityId index', async () => {
      await db.cachedEmbeddings.bulkPut([
        { id: 'e1', entityType: 'service', entityId: 'svc-1', vector: [0.1], metadata: { updatedAt: 1000 } } as EmbeddingRecord,
        { id: 'e2', entityType: 'query', entityId: 'svc-1', vector: [0.2], metadata: { updatedAt: 2000 } } as EmbeddingRecord,
      ]);

      const results = await db.cachedEmbeddings.where('entityId').equals('svc-1').toArray();
      expect(results).toHaveLength(2);
    });
  });
});
