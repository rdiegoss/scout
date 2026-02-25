/**
 * Unit tests for PersonalizationEngine
 *
 * Verifies:
 * 1. analyzeUserBehavior() infers preferences from profile data (Req 12.2, 12.3, 12.4)
 * 2. recordInteraction() updates behavior metrics in the database (Req 12.4, 12.7)
 * 3. getPrioritizedCategories() returns categories sorted by relevance (Req 12.2, 12.3)
 * 4. generateUIConfig() produces personalized UI configuration (Req 12.1, 12.5, 12.6)
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import {
  PersonalizationEngine,
  type UserInteraction,
  type SmartInsight,
} from '@client/services/personalizationEngine';
import type { UserProfile } from '@shared/types/user';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
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
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PersonalizationEngine', () => {
  let db: AppDatabase;
  let engine: PersonalizationEngine;

  beforeEach(async () => {
    db = new AppDatabase(`test-personalization-${Date.now()}`);
    engine = new PersonalizationEngine(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  // ── analyzeUserBehavior ──────────────────────────────────────────────────

  describe('analyzeUserBehavior', () => {
    it('should return empty preferences for a new user with no history', () => {
      const profile = makeProfile();
      const prefs = engine.analyzeUserBehavior(profile);

      expect(prefs.topCategories).toEqual([]);
      expect(prefs.inferredPreferences).toEqual([]);
      expect(prefs.isActiveUser).toBe(false);
    });

    it('should infer categories from search history', () => {
      const profile = makeProfile({
        searchHistory: [
          { query: 'eletricista perto de mim', timestamp: Date.now(), resultsCount: 5 },
          { query: 'reparo doméstico', timestamp: Date.now(), resultsCount: 3 },
        ],
      });

      const prefs = engine.analyzeUserBehavior(profile);

      expect(prefs.topCategories).toContain('reparos_domesticos');
      expect(prefs.inferredPreferences.length).toBeGreaterThan(0);
    });

    it('should consider favorite categories', () => {
      const profile = makeProfile({
        favoriteCategories: ['automotivo'],
      });

      const prefs = engine.analyzeUserBehavior(profile);

      expect(prefs.topCategories).toContain('automotivo');
    });

    it('should consider explicit preferences', () => {
      const profile = makeProfile({
        explicitPreferences: [
          { category: 'construcao', priority: 'high', source: 'user_answer', collectedAt: Date.now() },
        ],
      });

      const prefs = engine.analyzeUserBehavior(profile);

      expect(prefs.topCategories).toContain('construcao');
    });

    it('should mark user as active when they have enough interactions', () => {
      const profile = makeProfile({
        searchHistory: [
          { query: 'a', timestamp: Date.now(), resultsCount: 1 },
          { query: 'b', timestamp: Date.now(), resultsCount: 1 },
          { query: 'c', timestamp: Date.now(), resultsCount: 1 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's2', viewedAt: Date.now(), duration: 10, contacted: false },
        ],
      });

      const prefs = engine.analyzeUserBehavior(profile);
      expect(prefs.isActiveUser).toBe(true);
    });

    it('should infer from registered services via behavior metrics (Req 12.3)', () => {
      const profile = makeProfile({
        registeredServices: ['svc-1', 'svc-2'],
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: { servicos_pessoais: 5 },
          searchToContactRatio: 0,
        },
      });

      const prefs = engine.analyzeUserBehavior(profile);

      expect(prefs.topCategories).toContain('servicos_pessoais');
    });
  });

  // ── recordInteraction ────────────────────────────────────────────────────

  describe('recordInteraction', () => {
    it('should update category click counts for category interactions', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      const interaction: UserInteraction = {
        type: 'view',
        category: 'automotivo',
        timestamp: Date.now(),
        duration: 15,
      };

      await engine.recordInteraction('user-1', interaction);

      const updated = await db.userProfile.get('user-1');
      expect(updated!.behaviorMetrics.categoryClickCounts['automotivo']).toBe(1);
    });

    it('should add search to search history', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      const interaction: UserInteraction = {
        type: 'search',
        searchQuery: 'encanador urgente',
        timestamp: Date.now(),
      };

      await engine.recordInteraction('user-1', interaction);

      const history = await db.searchHistory.toArray();
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('encanador urgente');
    });

    it('should add view to viewed services', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      const interaction: UserInteraction = {
        type: 'view',
        serviceId: 'svc-123',
        timestamp: Date.now(),
        duration: 45,
      };

      await engine.recordInteraction('user-1', interaction);

      const viewed = await db.viewedServices.toArray();
      expect(viewed).toHaveLength(1);
      expect(viewed[0].serviceId).toBe('svc-123');
      expect(viewed[0].duration).toBe(45);
    });

    it('should update lastActiveAt timestamp', async () => {
      const profile = makeProfile({ lastActiveAt: 1000 });
      await db.userProfile.add(profile);

      const now = Date.now();
      await engine.recordInteraction('user-1', {
        type: 'view',
        timestamp: now,
      });

      const updated = await db.userProfile.get('user-1');
      expect(updated!.lastActiveAt).toBe(now);
    });

    it('should not throw for non-existent user', async () => {
      await expect(
        engine.recordInteraction('nonexistent', {
          type: 'view',
          timestamp: Date.now(),
        }),
      ).resolves.not.toThrow();
    });

    it('should track preferred access times', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      await engine.recordInteraction('user-1', {
        type: 'view',
        timestamp,
      });

      const updated = await db.userProfile.get('user-1');
      expect(updated!.behaviorMetrics.preferredAccessTimes).toContain(14);
    });
  });

  // ── getPrioritizedCategories ─────────────────────────────────────────────

  describe('getPrioritizedCategories', () => {
    it('should return all categories with zero scores for new user', () => {
      const profile = makeProfile();
      const priorities = engine.getPrioritizedCategories(profile);

      expect(priorities).toHaveLength(5);
      priorities.forEach((p) => {
        expect(p.score).toBe(0);
      });
    });

    it('should prioritize categories from search history', () => {
      const profile = makeProfile({
        searchHistory: [
          { query: 'mecânico de carro', timestamp: Date.now(), resultsCount: 5 },
          { query: 'oficina automotiva', timestamp: Date.now(), resultsCount: 3 },
        ],
      });

      const priorities = engine.getPrioritizedCategories(profile);

      expect(priorities[0].category).toBe('automotivo');
      expect(priorities[0].score).toBeGreaterThan(0);
    });

    it('should boost favorite categories', () => {
      const profile = makeProfile({
        favoriteCategories: ['construcao'],
      });

      const priorities = engine.getPrioritizedCategories(profile);
      const construcao = priorities.find((p) => p.category === 'construcao')!;

      expect(construcao.score).toBeGreaterThan(0);
      expect(construcao.reason).toBe('Categoria favorita');
    });

    it('should boost categories from explicit preferences', () => {
      const profile = makeProfile({
        explicitPreferences: [
          { category: 'servicos_pessoais', priority: 'high', source: 'user_answer', collectedAt: Date.now() },
        ],
      });

      const priorities = engine.getPrioritizedCategories(profile);
      const pessoais = priorities.find((p) => p.category === 'servicos_pessoais')!;

      expect(pessoais.score).toBeGreaterThan(0);
      expect(pessoais.reason).toBe('Preferência explícita');
    });

    it('should return categories sorted by score descending', () => {
      const profile = makeProfile({
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: {
            reparos_domesticos: 10,
            automotivo: 5,
            construcao: 1,
          },
          searchToContactRatio: 0,
        },
      });

      const priorities = engine.getPrioritizedCategories(profile);

      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i - 1].score).toBeGreaterThanOrEqual(priorities[i].score);
      }
    });
  });

  // ── generateUIConfig ─────────────────────────────────────────────────────

  describe('generateUIConfig', () => {
    it('should generate default greeting for user without name', () => {
      const profile = makeProfile();
      const config = engine.generateUIConfig(profile);

      expect(config.greeting).toBe('Olá! O que você precisa hoje?');
    });

    it('should generate personalized greeting with user name (Req 12.1)', () => {
      const profile = makeProfile({ firstName: 'Maria' });
      const config = engine.generateUIConfig(profile);

      expect(config.greeting).toBe('Olá, Maria!');
    });

    it('should include all categories in layoutPriority', () => {
      const profile = makeProfile();
      const config = engine.generateUIConfig(profile);

      expect(config.layoutPriority).toHaveLength(5);
      expect(config.layoutPriority).toContain('reparos_domesticos');
      expect(config.layoutPriority).toContain('servicos_pessoais');
      expect(config.layoutPriority).toContain('automotivo');
      expect(config.layoutPriority).toContain('construcao');
      expect(config.layoutPriority).toContain('outros');
    });

    it('should prioritize user categories in layout (Req 12.5)', () => {
      const profile = makeProfile({
        favoriteCategories: ['construcao'],
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: { construcao: 10 },
          searchToContactRatio: 0,
        },
      });

      const config = engine.generateUIConfig(profile);

      expect(config.layoutPriority[0]).toBe('construcao');
      expect(config.highlightCategories).toContain('construcao');
    });

    it('should adapt color accent based on top category (Req 12.6)', () => {
      const profile = makeProfile({
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: { automotivo: 10 },
          searchToContactRatio: 0,
        },
      });

      const config = engine.generateUIConfig(profile);

      expect(config.colorAccent).toBe('#EA580C'); // automotivo color
    });

    it('should use default color for new user', () => {
      const profile = makeProfile();
      const config = engine.generateUIConfig(profile);

      expect(config.colorAccent).toBe('#6366F1');
    });

    it('should show neighbor recommendations for active users', () => {
      const profile = makeProfile({ sessionCount: 3 });
      const config = engine.generateUIConfig(profile);

      expect(config.showNeighborRecommendations).toBe(true);
    });

    it('should not show neighbor recommendations for brand new users', () => {
      const profile = makeProfile({ sessionCount: 1 });
      const config = engine.generateUIConfig(profile);

      expect(config.showNeighborRecommendations).toBe(false);
    });

    it('should highlight at most 3 categories', () => {
      const profile = makeProfile({
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: {
            reparos_domesticos: 10,
            servicos_pessoais: 8,
            automotivo: 6,
            construcao: 4,
            outros: 2,
          },
          searchToContactRatio: 0,
        },
      });

      const config = engine.generateUIConfig(profile);

      expect(config.highlightCategories.length).toBeLessThanOrEqual(3);
    });
  });

  // ── generateSmartInsight ─────────────────────────────────────────────────

  describe('generateSmartInsight', () => {
    it('should return new-user insight for profile with few interactions', () => {
      const profile = makeProfile({ sessionCount: 1 });
      const insight: SmartInsight = engine.generateSmartInsight(profile);

      expect(insight.headlineKey).toBeTruthy();
      expect(insight.descriptionKey).toBeTruthy();
      expect(insight.confidence).toBeGreaterThanOrEqual(0);
      expect(insight.confidence).toBeLessThanOrEqual(1);
      expect(insight.isNewUser).toBe(true);
      expect(insight.headlineKey).toContain('newUser');
    });

    it('should detect renovation intent from search history', () => {
      const profile = makeProfile({
        searchHistory: [
          { query: 'pedreiro para reforma', timestamp: Date.now(), resultsCount: 3 },
          { query: 'pintor residencial', timestamp: Date.now(), resultsCount: 5 },
          { query: 'reforma cozinha', timestamp: Date.now(), resultsCount: 2 },
        ],
        sessionCount: 5,
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's2', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's3', viewedAt: Date.now(), duration: 10, contacted: false },
        ],
      });

      const insight = engine.generateSmartInsight(profile);

      expect(insight.intentType).toBeDefined();
      expect(insight.confidence).toBeGreaterThan(0);
      expect(insight.isNewUser).toBe(false);
    });

    it('should use category affinity when no clear intent is detected', () => {
      const profile = makeProfile({
        favoriteCategories: ['automotivo'],
        behaviorMetrics: {
          preferredAccessTimes: [],
          avgSessionDuration: 0,
          categoryClickCounts: { automotivo: 15 },
          searchToContactRatio: 0,
        },
        searchHistory: [
          { query: 'algo genérico', timestamp: Date.now(), resultsCount: 1 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's2', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's3', viewedAt: Date.now(), duration: 10, contacted: false },
        ],
        sessionCount: 5,
      });

      const insight = engine.generateSmartInsight(profile);

      expect(insight.headlineKey).toBeTruthy();
      expect(insight.descriptionKey).toBeTruthy();
    });

    it('should return valid SmartInsight shape', () => {
      const profile = makeProfile();
      const insight = engine.generateSmartInsight(profile);

      expect(insight).toHaveProperty('headlineKey');
      expect(insight).toHaveProperty('descriptionKey');
      expect(insight).toHaveProperty('confidence');
      expect(insight).toHaveProperty('isNewUser');
      expect(typeof insight.headlineKey).toBe('string');
      expect(typeof insight.descriptionKey).toBe('string');
      expect(typeof insight.confidence).toBe('number');
    });

    it('should increase confidence with more search data', () => {
      const lightProfile = makeProfile({
        searchHistory: [
          { query: 'eletricista', timestamp: Date.now(), resultsCount: 3 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's2', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's3', viewedAt: Date.now(), duration: 10, contacted: false },
        ],
        sessionCount: 5,
      });

      const heavyProfile = makeProfile({
        searchHistory: [
          { query: 'eletricista residencial', timestamp: Date.now(), resultsCount: 3 },
          { query: 'instalação elétrica', timestamp: Date.now(), resultsCount: 5 },
          { query: 'reparo elétrico urgente', timestamp: Date.now(), resultsCount: 2 },
          { query: 'eletricista 24h', timestamp: Date.now(), resultsCount: 4 },
          { query: 'reforma elétrica', timestamp: Date.now(), resultsCount: 1 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's2', viewedAt: Date.now(), duration: 10, contacted: false },
          { serviceId: 's3', viewedAt: Date.now(), duration: 10, contacted: false },
        ],
        sessionCount: 10,
      });

      const lightInsight = engine.generateSmartInsight(lightProfile);
      const heavyInsight = engine.generateSmartInsight(heavyProfile);

      expect(heavyInsight.confidence).toBeGreaterThanOrEqual(lightInsight.confidence);
    });
  });
});
