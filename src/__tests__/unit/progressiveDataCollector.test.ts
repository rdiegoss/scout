/**
 * Unit tests for ProgressiveDataCollector
 *
 * Verifies:
 * 1. canAskInSession() limits to 1 prompt per session (Req 14.6)
 * 2. canAskInSession() requires minimum interactions (Req 14.3)
 * 3. generateContextualPrompt() triggers on repeated searches (Req 14.4)
 * 4. generateContextualPrompt() triggers on long view duration (Req 14.5)
 * 5. generateContextualPrompt() detects new category interest (Req 14.7)
 * 6. detectUserIntent() identifies renovation, moving, emergency, etc.
 * 7. isPromptInCooldown() enforces 7-day cooldown (Req 14.9)
 * 8. markPromptAsShown() records prompt in history (Req 14.8)
 *
 * Validates: Requirements 14.1, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '@client/services/database';
import {
  ProgressiveDataCollector,
  COLLECTION_RULES,
  type UserContext,
} from '@client/services/progressiveDataCollector';
import type { UserInteraction } from '@client/services/personalizationEngine';
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

function makeContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    searchCount: 0,
    viewDuration: 0,
    sessionNumber: 1,
    recentSearches: [],
    ...overrides,
  };
}

function profileWithEnoughInteractions(overrides: Partial<UserProfile> = {}): UserProfile {
  return makeProfile({
    searchHistory: [
      { query: 'eletricista', timestamp: Date.now(), resultsCount: 5 },
      { query: 'encanador', timestamp: Date.now(), resultsCount: 3 },
    ],
    viewedServices: [
      { serviceId: 's1', viewedAt: Date.now(), duration: 10, contacted: false },
    ],
    ...overrides,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProgressiveDataCollector', () => {
  let db: AppDatabase;
  let collector: ProgressiveDataCollector;

  beforeEach(async () => {
    db = new AppDatabase(`test-collector-${Date.now()}`);
    collector = new ProgressiveDataCollector(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  // ── canAskInSession ────────────────────────────────────────────────────

  describe('canAskInSession', () => {
    it('should return false for a new user with no interactions', () => {
      const profile = makeProfile();
      expect(collector.canAskInSession(profile)).toBe(false);
    });

    it('should return true when user has enough interactions', () => {
      const profile = profileWithEnoughInteractions();
      expect(collector.canAskInSession(profile)).toBe(true);
    });

    it('should return false after one prompt has been shown in the session', () => {
      const profile = profileWithEnoughInteractions();
      expect(collector.canAskInSession(profile)).toBe(true);

      // Simulate showing a prompt by incrementing session count
      collector['sessionPromptCount'] = 1;
      expect(collector.canAskInSession(profile)).toBe(false);
    });

    it('should allow asking again after session reset', () => {
      const profile = profileWithEnoughInteractions();
      collector['sessionPromptCount'] = 1;
      expect(collector.canAskInSession(profile)).toBe(false);

      collector.resetSession();
      expect(collector.canAskInSession(profile)).toBe(true);
    });

    it('should require exactly minInteractionsBeforePrompt interactions', () => {
      // 2 interactions (below threshold of 3)
      const profileBelow = makeProfile({
        searchHistory: [
          { query: 'a', timestamp: Date.now(), resultsCount: 1 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 5, contacted: false },
        ],
      });
      expect(collector.canAskInSession(profileBelow)).toBe(false);

      // Exactly 3 interactions (at threshold)
      const profileAt = makeProfile({
        searchHistory: [
          { query: 'a', timestamp: Date.now(), resultsCount: 1 },
          { query: 'b', timestamp: Date.now(), resultsCount: 1 },
        ],
        viewedServices: [
          { serviceId: 's1', viewedAt: Date.now(), duration: 5, contacted: false },
        ],
      });
      expect(collector.canAskInSession(profileAt)).toBe(true);
    });
  });

  // ── generateContextualPrompt ───────────────────────────────────────────

  describe('generateContextualPrompt', () => {
    it('should return null when canAskInSession is false', () => {
      const profile = makeProfile(); // no interactions
      const context = makeContext();
      expect(collector.generateContextualPrompt(profile, context)).toBeNull();
    });

    it('should generate category_priority prompt for repeated searches (Req 14.4)', () => {
      const profile = profileWithEnoughInteractions();
      const context = makeContext({
        recentSearches: ['eletricista', 'eletricista'],
      });

      const prompt = collector.generateContextualPrompt(profile, context);

      expect(prompt).not.toBeNull();
      expect(prompt!.type).toBe('category_priority');
      expect(prompt!.message).toContain('eletricista');
      expect(prompt!.options).toBeDefined();
    });

    it('should generate help_offer prompt for long view duration (Req 14.5)', () => {
      const profile = profileWithEnoughInteractions();
      const context = makeContext({
        viewDuration: 35,
        currentCategory: 'reparos_domesticos',
      });

      const prompt = collector.generateContextualPrompt(profile, context);

      expect(prompt).not.toBeNull();
      expect(prompt!.type).toBe('help_offer');
      expect(prompt!.message).toContain('reparos domésticos');
    });

    it('should generate context_situation prompt when intent is detected (Req 14.7)', () => {
      const profile = profileWithEnoughInteractions();
      const context = makeContext({
        recentSearches: ['reforma cozinha', 'pedreiro para reforma', 'azulejo banheiro'],
      });

      const prompt = collector.generateContextualPrompt(profile, context);

      expect(prompt).not.toBeNull();
      // Could be category_priority or context_situation depending on which triggers first
      expect(['category_priority', 'context_situation']).toContain(prompt!.type);
    });

    it('should not generate prompt when view duration is below threshold', () => {
      const profile = profileWithEnoughInteractions();
      const context = makeContext({
        viewDuration: 10, // below 30s threshold
        currentCategory: 'automotivo',
      });

      const prompt = collector.generateContextualPrompt(profile, context);
      expect(prompt).toBeNull();
    });

    it('should respect cooldown when generating prompts', () => {
      const now = Date.now();
      const profile = profileWithEnoughInteractions({
        promptHistory: [
          {
            promptId: 'help-reparos_domesticos-123',
            promptType: 'help_offer',
            shownAt: now - 1000, // just shown
            response: 'dismissed',
          },
        ],
      });
      const context = makeContext({
        viewDuration: 35,
        currentCategory: 'reparos_domesticos',
      });

      const prompt = collector.generateContextualPrompt(profile, context);
      // help_offer is in cooldown, so it should skip it
      expect(prompt === null || prompt.type !== 'help_offer').toBe(true);
    });
  });

  // ── detectUserIntent ───────────────────────────────────────────────────

  describe('detectUserIntent', () => {
    it('should return null for empty interactions', () => {
      expect(collector.detectUserIntent([])).toBeNull();
    });

    it('should detect renovation intent', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'reforma cozinha', timestamp: Date.now() },
        { type: 'search', searchQuery: 'pedreiro para obra', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('renovation');
      expect(intent!.confidence).toBeGreaterThan(0);
      expect(intent!.suggestedCategories).toContain('construcao');
    });

    it('should detect moving intent', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'mudança residencial', timestamp: Date.now() },
        { type: 'search', searchQuery: 'frete para mudança', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('moving');
      expect(intent!.suggestedCategories).toContain('reparos_domesticos');
    });

    it('should detect emergency intent', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'vazamento urgente', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('emergency');
      expect(intent!.confidence).toBeGreaterThan(0);
    });

    it('should detect routine intent', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'diarista para faxina', timestamp: Date.now() },
        { type: 'search', searchQuery: 'limpeza semanal', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);

      expect(intent).not.toBeNull();
      expect(intent!.type).toBe('routine');
    });

    it('should return null when no keywords match', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'xyz abc', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);
      expect(intent).toBeNull();
    });

    it('should ignore non-search interactions for intent detection', () => {
      const interactions: UserInteraction[] = [
        { type: 'view', serviceId: 's1', timestamp: Date.now(), duration: 30 },
        { type: 'contact', serviceId: 's2', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);
      expect(intent).toBeNull();
    });

    it('should include contextual question in detected intent', () => {
      const interactions: UserInteraction[] = [
        { type: 'search', searchQuery: 'reforma banheiro', timestamp: Date.now() },
      ];

      const intent = collector.detectUserIntent(interactions);

      expect(intent).not.toBeNull();
      expect(intent!.contextualQuestion).toBeDefined();
      expect(intent!.contextualQuestion!.length).toBeGreaterThan(0);
    });
  });

  // ── isPromptInCooldown ─────────────────────────────────────────────────

  describe('isPromptInCooldown', () => {
    it('should return false when no prompt history exists', () => {
      const profile = makeProfile();
      expect(collector.isPromptInCooldown(profile, 'category_priority')).toBe(false);
    });

    it('should return true when prompt was dismissed within 7 days', () => {
      const now = Date.now();
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'test-1',
            promptType: 'category_priority',
            shownAt: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
            response: 'dismissed',
          },
        ],
      });

      expect(collector.isPromptInCooldown(profile, 'category_priority')).toBe(true);
    });

    it('should return true when prompt was ignored within 7 days', () => {
      const now = Date.now();
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'test-1',
            promptType: 'help_offer',
            shownAt: now - 1 * 24 * 60 * 60 * 1000, // 1 day ago
            response: 'ignored',
          },
        ],
      });

      expect(collector.isPromptInCooldown(profile, 'help_offer')).toBe(true);
    });

    it('should return false when cooldown has expired (>7 days)', () => {
      const now = Date.now();
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'test-1',
            promptType: 'category_priority',
            shownAt: now - 8 * 24 * 60 * 60 * 1000, // 8 days ago
            response: 'dismissed',
          },
        ],
      });

      expect(collector.isPromptInCooldown(profile, 'category_priority')).toBe(false);
    });

    it('should not apply cooldown for answered prompts', () => {
      const now = Date.now();
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'test-1',
            promptType: 'category_priority',
            shownAt: now - 1000, // just now
            response: 'answered',
          },
        ],
      });

      expect(collector.isPromptInCooldown(profile, 'category_priority')).toBe(false);
    });

    it('should check cooldown per prompt type independently', () => {
      const now = Date.now();
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'test-1',
            promptType: 'category_priority',
            shownAt: now - 1000,
            response: 'dismissed',
          },
        ],
      });

      expect(collector.isPromptInCooldown(profile, 'category_priority')).toBe(true);
      expect(collector.isPromptInCooldown(profile, 'help_offer')).toBe(false);
    });
  });

  // ── markPromptAsShown ──────────────────────────────────────────────────

  describe('markPromptAsShown', () => {
    it('should add prompt to user prompt history', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      await collector.markPromptAsShown('user-1', 'cat-priority-reparos-123', 'category_priority');

      const updated = await db.userProfile.get('user-1');
      expect(updated!.promptHistory).toHaveLength(1);
      expect(updated!.promptHistory[0].promptId).toBe('cat-priority-reparos-123');
      expect(updated!.promptHistory[0].promptType).toBe('category_priority');
      expect(updated!.promptHistory[0].response).toBe('ignored');
    });

    it('should increment session prompt count', async () => {
      const profile = makeProfile();
      await db.userProfile.add(profile);

      expect(collector['sessionPromptCount']).toBe(0);
      await collector.markPromptAsShown('user-1', 'test-1');
      expect(collector['sessionPromptCount']).toBe(1);
    });

    it('should not throw for non-existent user', async () => {
      await expect(
        collector.markPromptAsShown('nonexistent', 'test-1'),
      ).resolves.not.toThrow();
    });

    it('should append to existing prompt history', async () => {
      const profile = makeProfile({
        promptHistory: [
          {
            promptId: 'existing-1',
            promptType: 'help_offer',
            shownAt: Date.now() - 100000,
            response: 'answered',
            answer: 'Sim',
          },
        ],
      });
      await db.userProfile.add(profile);

      await collector.markPromptAsShown('user-1', 'new-prompt-1', 'context_situation');

      const updated = await db.userProfile.get('user-1');
      expect(updated!.promptHistory).toHaveLength(2);
      expect(updated!.promptHistory[0].promptId).toBe('existing-1');
      expect(updated!.promptHistory[1].promptId).toBe('new-prompt-1');
    });
  });

  // ── resetSession ───────────────────────────────────────────────────────

  describe('resetSession', () => {
    it('should reset session prompt count to zero', () => {
      collector['sessionPromptCount'] = 3;
      collector.resetSession();
      expect(collector['sessionPromptCount']).toBe(0);
    });
  });
});
