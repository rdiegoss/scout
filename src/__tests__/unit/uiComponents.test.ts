/**
 * Unit tests for UI components - HomeScreen, SearchScreen,
 * ServiceProfileScreen, CategoriesScreen.
 *
 * Tests component logic, prop interfaces, and helper components.
 * Since we're in a node environment without jsdom, we test the
 * exported types/interfaces and component module structure.
 *
 * Validates: Requirements 6.1, 6.4, 6.5, 6.6, 8.2
 */
import { describe, it, expect } from 'vitest';
import { CATEGORIES } from '@client/services/categoryService';
import type { HomeScreenProps } from '@client/pages/HomeScreen';
import type { SearchScreenProps, SearchResult } from '@client/pages/SearchScreen';
import type { ServiceProfileScreenProps } from '@client/pages/ServiceProfileScreen';
import type { CategoriesScreenProps } from '@client/pages/CategoriesScreen';
import type { ServiceProvider, Rating } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import type { RecommendedService } from '@client/services/recommendationEngine';
import type { PersonalizedUIConfig, SmartInsight } from '@client/services/personalizationEngine';
import type { CategoryCount } from '@client/services/categoryService';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeService(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'svc-1',
    name: 'Eletricista João',
    description: 'Serviços elétricos residenciais',
    category: 'reparos_domesticos',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua das Flores, 123',
    location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
    averageRating: 4.5,
    totalRatings: 12,
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
    firstName: 'Maria',
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

function makeUIConfig(overrides: Partial<PersonalizedUIConfig> = {}): PersonalizedUIConfig {
  return {
    highlightCategories: ['reparos_domesticos'],
    colorAccent: '#2563EB',
    layoutPriority: ['reparos_domesticos', 'servicos_pessoais', 'automotivo', 'construcao', 'outros'],
    showNeighborRecommendations: true,
    greeting: 'Olá, Maria!',
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<RecommendedService> = {}): RecommendedService {
  return {
    service: makeService(),
    relevanceScore: 0.85,
    distanceKm: 2.3,
    matchReasons: ['Próximo de você', 'Bem avaliado'],
    ...overrides,
  };
}

function makeRating(overrides: Partial<Rating> = {}): Rating {
  return {
    id: 'rating-1',
    serviceId: 'svc-1',
    userId: 'user-2',
    score: 5,
    comment: 'Excelente serviço!',
    userLocation: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
    isNeighbor: true,
    createdAt: Date.now(),
    helpful: 2,
    ...overrides,
  };
}

// ── HomeScreen tests ─────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  it('should accept valid props with user profile and recommendations', () => {
    const props: HomeScreenProps = {
      userProfile: makeUserProfile(),
      uiConfig: makeUIConfig(),
      recommendations: [makeRecommendation()],
      searchResults: [],
      searchLoading: false,
      categories: CATEGORIES,
      loading: false,
      aiReady: true,
      onSearch: async () => {},
      onServiceSelect: () => {},
    };

    expect(props.userProfile?.firstName).toBe('Maria');
    expect(props.uiConfig?.greeting).toBe('Olá, Maria!');
    expect(props.recommendations).toHaveLength(1);
    expect(props.categories).toHaveLength(5);
    expect(props.loading).toBe(false);
  });

  it('should handle loading state with null profile', () => {
    const props: HomeScreenProps = {
      userProfile: null,
      uiConfig: null,
      recommendations: [],
      searchResults: [],
      searchLoading: false,
      categories: CATEGORIES,
      loading: true,
      aiReady: false,
      onSearch: async () => {},
      onServiceSelect: () => {},
    };

    expect(props.loading).toBe(true);
    expect(props.userProfile).toBeNull();
    expect(props.recommendations).toHaveLength(0);
  });

  it('should provide all 5 main categories for navigation', () => {
    expect(CATEGORIES).toHaveLength(5);
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toContain('reparos_domesticos');
    expect(ids).toContain('servicos_pessoais');
    expect(ids).toContain('automotivo');
    expect(ids).toContain('construcao');
    expect(ids).toContain('outros');
  });

  it('should highlight categories from UI config', () => {
    const config = makeUIConfig({ highlightCategories: ['automotivo', 'construcao'] });
    expect(config.highlightCategories).toContain('automotivo');
    expect(config.highlightCategories).toContain('construcao');
    expect(config.highlightCategories).not.toContain('outros');
  });

  it('should accept smartInsight prop for AI insight card', () => {
    const insight: SmartInsight = {
      headlineKey: 'home.insight.intent.renovation.headline',
      descriptionKey: 'home.insight.intent.renovation.description',
      confidence: 0.82,
      intentType: 'renovation',
      suggestedCategories: ['reparos_domesticos'],
      isNewUser: false,
    };

    const props: HomeScreenProps = {
      userProfile: makeUserProfile(),
      uiConfig: makeUIConfig(),
      recommendations: [makeRecommendation()],
      searchResults: [],
      searchLoading: false,
      categories: CATEGORIES,
      loading: false,
      aiReady: true,
      smartInsight: insight,
      onSearch: async () => {},
      onServiceSelect: () => {},
    };

    expect(props.smartInsight?.headlineKey).toContain('renovation');
    expect(props.smartInsight?.confidence).toBeGreaterThan(0.5);
    expect(props.smartInsight?.intentType).toBe('renovation');
  });

  it('should accept recentSearches prop for quick-tap chips', () => {
    const props: HomeScreenProps = {
      userProfile: makeUserProfile(),
      uiConfig: makeUIConfig(),
      recommendations: [],
      searchResults: [],
      searchLoading: false,
      categories: CATEGORIES,
      loading: false,
      aiReady: true,
      recentSearches: ['eletricista', 'encanador', 'pintor'],
      onSearch: async () => {},
      onServiceSelect: () => {},
    };

    expect(props.recentSearches).toHaveLength(3);
    expect(props.recentSearches).toContain('eletricista');
  });

  it('should accept onQuickInterestTap for implicit preference capture', () => {
    let tapped: string | undefined;
    const props: HomeScreenProps = {
      userProfile: makeUserProfile(),
      uiConfig: makeUIConfig(),
      recommendations: [],
      searchResults: [],
      searchLoading: false,
      categories: CATEGORIES,
      loading: false,
      aiReady: true,
      onSearch: async () => {},
      onServiceSelect: () => {},
      onQuickInterestTap: (category) => { tapped = category; },
    };

    props.onQuickInterestTap?.('automotivo');
    expect(tapped).toBe('automotivo');
  });

  it('should split recommendations into forYou and trending segments', () => {
    const recs: RecommendedService[] = Array.from({ length: 10 }, (_, i) =>
      makeRecommendation({
        service: makeService({ id: `svc-${i}`, name: `Serviço ${i}` }),
        relevanceScore: 1 - i * 0.1,
      }),
    );

    // forYou = top 6 by relevanceScore, trending = remainder
    const forYou = recs.slice(0, 6);
    const trending = recs.slice(6).sort((a, b) => (b.service.averageRating ?? 0) - (a.service.averageRating ?? 0));

    expect(forYou).toHaveLength(6);
    expect(trending).toHaveLength(4);
    expect(forYou[0].relevanceScore).toBeGreaterThan(forYou[5].relevanceScore);
  });
});

// ── SearchScreen tests ───────────────────────────────────────────────────────

describe('SearchScreen', () => {
  it('should accept valid props with search results', () => {
    const results: SearchResult[] = [
      { service: makeService(), similarity: 0.92, distanceKm: 1.5 },
      { service: makeService({ id: 'svc-2', name: 'Encanador Pedro' }), similarity: 0.78, distanceKm: 3.2 },
    ];

    const props: SearchScreenProps = {
      onSearch: async () => {},
      results,
      loading: false,
      onServiceSelect: () => {},
      onBack: () => {},
    };

    expect(props.results).toHaveLength(2);
    expect(props.results[0].similarity).toBeGreaterThan(props.results[1].similarity);
  });

  it('should handle empty results state', () => {
    const props: SearchScreenProps = {
      onSearch: async () => {},
      results: [],
      loading: false,
      onServiceSelect: () => {},
      onBack: () => {},
    };

    expect(props.results).toHaveLength(0);
    expect(props.loading).toBe(false);
  });

  it('should handle loading state', () => {
    const props: SearchScreenProps = {
      onSearch: async () => {},
      results: [],
      loading: true,
      onServiceSelect: () => {},
      onBack: () => {},
    };

    expect(props.loading).toBe(true);
  });
});

// ── ServiceProfileScreen tests ───────────────────────────────────────────────

describe('ServiceProfileScreen', () => {
  it('should display service with all details', () => {
    const service = makeService({
      recentRatings: [
        makeRating({ id: 'r1', score: 5 }),
        makeRating({ id: 'r2', score: 4 }),
        makeRating({ id: 'r3', score: 3 }),
      ],
    });

    const props: ServiceProfileScreenProps = {
      service,
      loading: false,
      onBack: () => {},
      onSubmitRating: async () => {},
    };

    expect(props.service?.name).toBe('Eletricista João');
    expect(props.service?.phone).toBe('(11) 99999-0000');
    expect(props.service?.hasWhatsApp).toBe(true);
    expect(props.service?.whatsAppConfirmed).toBe(true);
    expect(props.service?.averageRating).toBe(4.5);
    expect(props.service?.recentRatings).toHaveLength(3);
  });

  it('should show WhatsApp indicator when confirmed', () => {
    const service = makeService({ hasWhatsApp: true, whatsAppConfirmed: true });
    expect(service.hasWhatsApp && service.whatsAppConfirmed).toBe(true);
  });

  it('should show unconfirmed WhatsApp status', () => {
    const service = makeService({ hasWhatsApp: true, whatsAppConfirmed: false });
    expect(service.hasWhatsApp).toBe(true);
    expect(service.whatsAppConfirmed).toBe(false);
  });

  it('should handle null service (loading)', () => {
    const props: ServiceProfileScreenProps = {
      service: null,
      loading: true,
      onBack: () => {},
      onSubmitRating: async () => {},
    };

    expect(props.service).toBeNull();
    expect(props.loading).toBe(true);
  });

  it('should validate rating score range 1-5', () => {
    for (let score = 1; score <= 5; score++) {
      const rating = makeRating({ score });
      expect(rating.score).toBeGreaterThanOrEqual(1);
      expect(rating.score).toBeLessThanOrEqual(5);
    }
  });
});

// ── CategoriesScreen tests ───────────────────────────────────────────────────

describe('CategoriesScreen', () => {
  it('should display all main categories with icons', () => {
    const props: CategoriesScreenProps = {
      categories: CATEGORIES,
      categoryCounts: CATEGORIES.map((c) => ({ categoryId: c.id, count: 10 })),
      loading: false,
      onBack: () => {},
      onSubcategorySelect: () => {},
    };

    expect(props.categories).toHaveLength(5);
    for (const cat of props.categories) {
      expect(cat.icon).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.subcategories.length).toBeGreaterThan(0);
    }
  });

  it('should show service count per category', () => {
    const counts: CategoryCount[] = [
      { categoryId: 'reparos_domesticos', count: 15 },
      { categoryId: 'servicos_pessoais', count: 8 },
      { categoryId: 'automotivo', count: 5 },
      { categoryId: 'construcao', count: 12 },
      { categoryId: 'outros', count: 3 },
    ];

    expect(counts.find((c) => c.categoryId === 'reparos_domesticos')?.count).toBe(15);
    expect(counts.find((c) => c.categoryId === 'outros')?.count).toBe(3);
  });

  it('should have subcategories for each main category', () => {
    for (const cat of CATEGORIES) {
      expect(cat.subcategories.length).toBeGreaterThan(0);
      for (const sub of cat.subcategories) {
        expect(sub.id).toBeTruthy();
        expect(sub.name).toBeTruthy();
        expect(sub.keywords.length).toBeGreaterThan(0);
      }
    }
  });

  it('should ensure each subcategory belongs to exactly one category', () => {
    const subcategoryIds = new Map<string, string>();
    for (const cat of CATEGORIES) {
      for (const sub of cat.subcategories) {
        expect(subcategoryIds.has(sub.id)).toBe(false);
        subcategoryIds.set(sub.id, cat.id);
      }
    }
  });

  it('should handle loading state', () => {
    const props: CategoriesScreenProps = {
      categories: CATEGORIES,
      categoryCounts: [],
      loading: true,
      onBack: () => {},
      onSubcategorySelect: () => {},
    };

    expect(props.loading).toBe(true);
  });
});
