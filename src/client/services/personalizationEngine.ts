import type { ServiceCategory } from '@shared/types';
import type {
  UserProfile,
  InferredPreference,
} from '@shared/types/user';
import { type AppDatabase, db as defaultDb } from './database';

export interface UserInteraction {
  type: 'view' | 'search' | 'rating' | 'contact' | 'register';
  serviceId?: string;
  category?: string;
  searchQuery?: string;
  timestamp: number;
  duration?: number;
}

export interface UserPreferences {
  topCategories: ServiceCategory[];
  inferredPreferences: InferredPreference[];
  preferredAccessTimes: number[];
  isActiveUser: boolean;
}

export interface CategoryPriority {
  category: ServiceCategory;
  score: number;
  reason: string;
}

export interface PersonalizedUIConfig {
  highlightCategories: string[];
  colorAccent: string;
  layoutPriority: string[];
  showNeighborRecommendations: boolean;
  greeting: string;
}

export interface SmartInsight {

  headlineKey: string;

  headlineParams?: Record<string, string | number>;

  descriptionKey: string;

  descriptionParams?: Record<string, string | number>;

  suggestedCategories: ServiceCategory[];

  intentType?: 'renovation' | 'moving' | 'emergency' | 'routine' | 'exploration';

  confidence: number;

  isNewUser: boolean;
}

const ALL_CATEGORIES: ServiceCategory[] = [
  'reparos_domesticos',
  'servicos_pessoais',
  'automotivo',
  'construcao',
  'outros',
];

const ACTIVE_USER_THRESHOLD = 5;

const MIN_INFERENCE_CONFIDENCE = 0.2;

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  reparos_domesticos: '#2563EB',
  servicos_pessoais: '#D946EF',
  automotivo: '#EA580C',
  construcao: '#CA8A04',
  outros: '#6366F1',
};

const DEFAULT_COLOR = '#6366F1';

function countCategoryInteractions(profile: UserProfile): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of profile.searchHistory) {
    const q = entry.query.toLowerCase();
    if (q.includes('reparo') || q.includes('doméstico') || q.includes('domestico') || q.includes('elétric') || q.includes('eletric') || q.includes('encanad') || q.includes('pintor') || q.includes('marceneir') || q.includes('serralheir')) {
      counts['reparos_domesticos'] = (counts['reparos_domesticos'] ?? 0) + 1;
    }
    if (q.includes('pessoal') || q.includes('pessoais') || q.includes('costur') || q.includes('cabeleir') || q.includes('manicure') || q.includes('diarista')) {
      counts['servicos_pessoais'] = (counts['servicos_pessoais'] ?? 0) + 1;
    }
    if (q.includes('auto') || q.includes('carro') || q.includes('mecânico') || q.includes('mecanico') || q.includes('borracheiro')) {
      counts['automotivo'] = (counts['automotivo'] ?? 0) + 1;
    }
    if (q.includes('construção') || q.includes('construcao') || q.includes('obra') || q.includes('pedreiro') || q.includes('azulej') || q.includes('gesseiro')) {
      counts['construcao'] = (counts['construcao'] ?? 0) + 1;
    }
  }

  for (const [cat, count] of Object.entries(profile.behaviorMetrics.categoryClickCounts)) {
    counts[cat] = (counts[cat] ?? 0) + count;
  }

  for (const pref of profile.explicitPreferences) {
    const weight = pref.priority === 'high' ? 3 : pref.priority === 'medium' ? 2 : 1;
    counts[pref.category] = (counts[pref.category] ?? 0) + weight;
  }

  for (const cat of profile.favoriteCategories) {
    counts[cat] = (counts[cat] ?? 0) + 2;
  }

  return counts;
}

function getTotalInteractionCount(profile: UserProfile): number {
  return (
    profile.searchHistory.length +
    profile.viewedServices.length +
    profile.ratings.length +
    profile.registeredServices.length
  );
}

function getHourOfDay(timestamp: number): number {
  return new Date(timestamp).getHours();
}

export class PersonalizationEngine {
  private db: AppDatabase;

  constructor(db: AppDatabase = defaultDb) {
    this.db = db;
  }

  analyzeUserBehavior(profile: UserProfile): UserPreferences {
    const categoryCounts = countCategoryInteractions(profile);
    const totalInteractions = getTotalInteractionCount(profile);

    const registeredCategories = this._inferFromRegisteredServices(profile);
    for (const cat of registeredCategories) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 3;
    }

    const maxCount = Math.max(1, ...Object.values(categoryCounts));
    const inferredPreferences: InferredPreference[] = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category: category as ServiceCategory,
        confidence: count / maxCount,
        basedOn: 'search_frequency' as const,
        lastUpdated: Date.now(),
      }))
      .filter((p) => p.confidence >= MIN_INFERENCE_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence);

    const topCategories = inferredPreferences
      .map((p) => p.category)
      .filter((c): c is ServiceCategory => ALL_CATEGORIES.includes(c as ServiceCategory));

    const preferredAccessTimes = [...profile.behaviorMetrics.preferredAccessTimes];

    return {
      topCategories,
      inferredPreferences,
      preferredAccessTimes,
      isActiveUser: totalInteractions >= ACTIVE_USER_THRESHOLD,
    };
  }

  async recordInteraction(userId: string, interaction: UserInteraction): Promise<void> {
    const profile = await this.db.userProfile.get(userId);
    if (!profile) {
      return;
    }

    const updatedMetrics = { ...profile.behaviorMetrics };

    if (interaction.category) {
      updatedMetrics.categoryClickCounts = {
        ...updatedMetrics.categoryClickCounts,
        [interaction.category]:
          (updatedMetrics.categoryClickCounts[interaction.category] ?? 0) + 1,
      };
    }

    const hour = getHourOfDay(interaction.timestamp);
    const accessTimes = [...updatedMetrics.preferredAccessTimes];
    if (!accessTimes.includes(hour)) {
      accessTimes.push(hour);
      if (accessTimes.length > 5) {
        accessTimes.shift();
      }
    }
    updatedMetrics.preferredAccessTimes = accessTimes;

    if (interaction.type === 'contact') {
      const totalSearches = Math.max(1, profile.searchHistory.length);
      const contactCount = profile.viewedServices.filter((v) => v.contacted).length + 1;
      updatedMetrics.searchToContactRatio = contactCount / totalSearches;
    }

    if (interaction.type === 'view' && interaction.duration) {
      const viewCount = profile.viewedServices.length + 1;
      const prevTotal = updatedMetrics.avgSessionDuration * profile.viewedServices.length;
      updatedMetrics.avgSessionDuration = (prevTotal + interaction.duration) / viewCount;
    }

    if (interaction.type === 'search' && interaction.searchQuery) {
      await this.db.searchHistory.add({
        query: interaction.searchQuery,
        timestamp: interaction.timestamp,
        resultsCount: 0,
      });
    }

    if (interaction.type === 'view' && interaction.serviceId) {
      await this.db.viewedServices.add({
        serviceId: interaction.serviceId,
        viewedAt: interaction.timestamp,
        duration: interaction.duration ?? 0,
        contacted: false,
      });
    }

    await this.db.userProfile.update(userId, {
      behaviorMetrics: updatedMetrics,
      lastActiveAt: interaction.timestamp,
    });
  }

  getPrioritizedCategories(profile: UserProfile): CategoryPriority[] {
    const categoryCounts = countCategoryInteractions(profile);

    const registeredCategories = this._inferFromRegisteredServices(profile);
    for (const cat of registeredCategories) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 3;
    }

    const maxCount = Math.max(1, ...Object.values(categoryCounts));

    const priorities: CategoryPriority[] = ALL_CATEGORIES.map((category) => {
      const count = categoryCounts[category] ?? 0;
      const score = count / maxCount;

      let reason = 'Categoria padrão';
      if (profile.favoriteCategories.includes(category)) {
        reason = 'Categoria favorita';
      } else if (profile.explicitPreferences.some((p) => p.category === category)) {
        reason = 'Preferência explícita';
      } else if (registeredCategories.includes(category)) {
        reason = 'Serviços cadastrados nesta categoria';
      } else if (count > 0) {
        reason = 'Baseado no histórico de uso';
      }

      return { category, score, reason };
    });

    return priorities.sort((a, b) => b.score - a.score);
  }

  generateUIConfig(profile: UserProfile): PersonalizedUIConfig {
    const priorities = this.getPrioritizedCategories(profile);
    const topCategories = priorities
      .filter((p) => p.score > 0)
      .map((p) => p.category);

    const highlightCategories = topCategories.slice(0, 3);

    const topCategory = topCategories[0] as ServiceCategory | undefined;
    const colorAccent = topCategory
      ? CATEGORY_COLORS[topCategory] ?? DEFAULT_COLOR
      : DEFAULT_COLOR;

    const layoutPriority = [
      ...topCategories,
      ...ALL_CATEGORIES.filter((c) => !topCategories.includes(c)),
    ];

    const showNeighborRecommendations =
      getTotalInteractionCount(profile) >= ACTIVE_USER_THRESHOLD ||
      profile.sessionCount > 1;

    const greeting = profile.firstName
      ? `Olá, ${profile.firstName}!`
      : 'Olá! O que você precisa hoje?';

    return {
      highlightCategories,
      colorAccent,
      layoutPriority,
      showNeighborRecommendations,
      greeting,
    };
  }

  generateSmartInsight(profile: UserProfile): SmartInsight {
    const totalInteractions = getTotalInteractionCount(profile);
    const isNewUser = totalInteractions < 3;

    if (isNewUser) {
      return {
        headlineKey: profile.firstName
          ? 'home.insight.newUserWithName'
          : 'home.insight.newUser',
        headlineParams: profile.firstName ? { name: profile.firstName } : undefined,
        descriptionKey: 'home.insight.newUserDescription',
        suggestedCategories: [],
        confidence: 0,
        isNewUser: true,
      };
    }

    const recentSearches = profile.searchHistory.slice(-10);
    const intentScores = this._scoreIntents(recentSearches.map((s) => s.query));

    const priorities = this.getPrioritizedCategories(profile);
    const topPriority = priorities[0];

    if (intentScores.bestIntent && intentScores.confidence >= 0.4) {
      return {
        headlineKey: `home.insight.intent.${intentScores.bestIntent}.headline`,
        descriptionKey: `home.insight.intent.${intentScores.bestIntent}.description`,
        suggestedCategories: intentScores.suggestedCategories,
        intentType: intentScores.bestIntent as SmartInsight['intentType'],
        confidence: intentScores.confidence,
        isNewUser: false,
      };
    }

    if (topPriority && topPriority.score > 0) {
      return {
        headlineKey: 'home.insight.categoryAffinity',
        headlineParams: { category: topPriority.category },
        descriptionKey: 'home.insight.categoryAffinityDescription',
        descriptionParams: { count: totalInteractions },
        suggestedCategories: priorities.filter((p) => p.score > 0).map((p) => p.category),
        confidence: topPriority.score,
        isNewUser: false,
      };
    }

    return {
      headlineKey: 'home.insight.activeUser',
      descriptionKey: 'home.insight.activeUserDescription',
      descriptionParams: { count: totalInteractions },
      suggestedCategories: [],
      confidence: 0.3,
      isNewUser: false,
    };
  }

  private _scoreIntents(queries: string[]): {
    bestIntent: string | null;
    confidence: number;
    suggestedCategories: ServiceCategory[];
  } {
    const INTENT_KEYWORDS: Record<string, string[]> = {
      renovation: ['reforma', 'reformar', 'pintura', 'pintar', 'azulejo', 'piso', 'gesso', 'gesseiro', 'pedreiro', 'obra', 'construção', 'construcao'],
      moving: ['mudança', 'mudanca', 'mudar', 'mudei', 'novo apartamento', 'nova casa', 'frete', 'carreto', 'montagem'],
      emergency: ['urgente', 'emergência', 'emergencia', 'vazamento', 'entupimento', 'curto', 'quebrou', 'estourou'],
      routine: ['manutenção', 'manutencao', 'limpeza', 'faxina', 'diarista', 'jardinagem'],
      exploration: ['procurando', 'conhecer', 'opções', 'opcoes', 'indicação', 'indicacao', 'recomendação'],
    };
    const INTENT_CATS: Record<string, ServiceCategory[]> = {
      renovation: ['construcao', 'reparos_domesticos'],
      moving: ['reparos_domesticos', 'servicos_pessoais'],
      emergency: ['reparos_domesticos'],
      routine: ['servicos_pessoais', 'reparos_domesticos'],
      exploration: [],
    };

    let bestIntent: string | null = null;
    let maxScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      let score = 0;
      for (const q of queries) {
        const lower = q.toLowerCase();
        for (const kw of keywords) {
          if (lower.includes(kw)) score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }

    const confidence = queries.length > 0 ? Math.min(1, maxScore / queries.length) : 0;
    return {
      bestIntent: maxScore > 0 ? bestIntent : null,
      confidence,
      suggestedCategories: bestIntent ? (INTENT_CATS[bestIntent] ?? []) : [],
    };
  }

  private _inferFromRegisteredServices(profile: UserProfile): ServiceCategory[] {
    if (profile.registeredServices.length === 0) {
      return [];
    }

    const clickedCategories = Object.entries(profile.behaviorMetrics.categoryClickCounts)
      .filter(([, count]) => count > 0)
      .map(([cat]) => cat as ServiceCategory)
      .filter((c) => ALL_CATEGORIES.includes(c));

    if (clickedCategories.length === 0) {
      return profile.explicitPreferences.map((p) => p.category);
    }

    return clickedCategories;
  }
}
