import type { UserProfile, PromptHistoryEntry } from '@shared/types/user';
import type { UserInteraction } from './personalizationEngine';
import { type AppDatabase, db as defaultDb } from './database';

export interface UserContext {
  currentCategory?: string;
  searchCount: number;
  viewDuration: number;
  sessionNumber: number;
  lastPromptDate?: number;
  recentSearches: string[];
}

export interface PreferencePrompt {
  id: string;
  type: 'category_priority' | 'context_situation' | 'help_offer';
  message: string;
  options?: string[];
  triggerReason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface UserIntent {
  type: 'renovation' | 'moving' | 'emergency' | 'routine' | 'exploration';
  confidence: number;
  suggestedCategories: string[];
  contextualQuestion?: string;
}

export const COLLECTION_RULES = {
  maxPromptsPerSession: 1,
  cooldownDays: 7,
  minInteractionsBeforePrompt: 3,
  viewDurationThreshold: 30,
  repeatSearchThreshold: 2,
} as const;

const COOLDOWN_MS = COLLECTION_RULES.cooldownDays * 24 * 60 * 60 * 1000;

const INTENT_KEYWORDS: Record<UserIntent['type'], string[]> = {
  renovation: [
    'reforma', 'reformar', 'pintura', 'pintar', 'azulejo', 'piso',
    'gesso', 'gesseiro', 'pedreiro', 'obra', 'construção', 'construcao',
  ],
  moving: [
    'mudança', 'mudanca', 'mudar', 'mudei', 'novo apartamento', 'nova casa',
    'frete', 'carreto', 'montagem', 'desmontagem',
  ],
  emergency: [
    'urgente', 'emergência', 'emergencia', 'vazamento', 'entupimento',
    'curto', 'curto-circuito', 'quebrou', 'estourou',
  ],
  routine: [
    'manutenção', 'manutencao', 'limpeza', 'faxina', 'diarista',
    'jardinagem', 'jardim',
  ],
  exploration: [
    'procurando', 'conhecer', 'opções', 'opcoes', 'indicação', 'indicacao',
    'recomendação', 'recomendacao',
  ],
};

const INTENT_CATEGORIES: Record<UserIntent['type'], string[]> = {
  renovation: ['construcao', 'reparos_domesticos'],
  moving: ['reparos_domesticos', 'servicos_pessoais'],
  emergency: ['reparos_domesticos'],
  routine: ['servicos_pessoais', 'reparos_domesticos'],
  exploration: [],
};

const INTENT_QUESTIONS: Record<UserIntent['type'], string> = {
  renovation: 'Você está fazendo uma reforma? Posso priorizar serviços de construção para você.',
  moving: 'Você acabou de se mudar? Posso ajudar a encontrar serviços essenciais na sua região.',
  emergency: 'Parece uma emergência! Quer ver profissionais disponíveis agora?',
  routine: 'Precisa de serviços regulares? Posso lembrar seus favoritos.',
  exploration: 'Está conhecendo a região? Posso mostrar os serviços mais bem avaliados por aqui.',
};

function countSearchFrequencies(searches: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const q of searches) {
    const normalized = q.toLowerCase().trim();
    if (normalized) {
      freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
    }
  }
  return freq;
}

function inferCategoryFromQuery(query: string): string | undefined {
  const q = query.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    reparos_domesticos: ['eletricista', 'elétric', 'eletric', 'encanador', 'pintor', 'marceneiro', 'serralheiro', 'reparo'],
    servicos_pessoais: ['costureira', 'cabeleireiro', 'cabeleir', 'manicure', 'diarista', 'faxina'],
    automotivo: ['mecânico', 'mecanico', 'carro', 'auto', 'borracheiro', 'oficina'],
    construcao: ['pedreiro', 'obra', 'construção', 'construcao', 'azulejo', 'gesso', 'gesseiro'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => q.includes(kw))) {
      return category;
    }
  }
  return undefined;
}

export class ProgressiveDataCollector {
  private db: AppDatabase;
  private sessionPromptCount: number = 0;

  constructor(db: AppDatabase = defaultDb) {
    this.db = db;
  }

  canAskInSession(profile: UserProfile): boolean {
    if (this.sessionPromptCount >= COLLECTION_RULES.maxPromptsPerSession) {
      return false;
    }

    const totalInteractions =
      profile.searchHistory.length +
      profile.viewedServices.length +
      profile.ratings.length;

    if (totalInteractions < COLLECTION_RULES.minInteractionsBeforePrompt) {
      return false;
    }

    return true;
  }

  generateContextualPrompt(
    profile: UserProfile,
    context: UserContext,
  ): PreferencePrompt | null {
    if (!this.canAskInSession(profile)) {
      return null;
    }

    const searchFreq = countSearchFrequencies(context.recentSearches);
    for (const [query, count] of searchFreq) {
      if (count >= COLLECTION_RULES.repeatSearchThreshold) {
        const category = inferCategoryFromQuery(query);
        const promptType = 'category_priority';
        if (this.isPromptInCooldown(profile, promptType)) {
          continue;
        }
        return {
          id: `cat-priority-${category ?? 'general'}-${Date.now()}`,
          type: promptType,
          message: category
            ? `Notei que você busca bastante por "${query}". Quer priorizar essa categoria?`
            : `Você tem buscado bastante por "${query}". Quer que eu priorize resultados similares?`,
          options: ['Sim, priorizar', 'Não, obrigado'],
          triggerReason: `Busca repetida: "${query}" (${count}x)`,
          priority: 'medium',
        };
      }
    }

    if (context.viewDuration >= COLLECTION_RULES.viewDurationThreshold && context.currentCategory) {
      const promptType = 'help_offer';
      if (!this.isPromptInCooldown(profile, promptType)) {
        return {
          id: `help-${context.currentCategory}-${Date.now()}`,
          type: promptType,
          message: `Precisa de mais opções de ${formatCategoryName(context.currentCategory)}?`,
          options: ['Sim, mostrar mais', 'Não, estou bem'],
          triggerReason: `Visualização longa (${context.viewDuration}s) em ${context.currentCategory}`,
          priority: 'low',
        };
      }
    }

    const interactions: UserInteraction[] = context.recentSearches.map((q) => ({
      type: 'search' as const,
      searchQuery: q,
      timestamp: Date.now(),
    }));
    const intent = this.detectUserIntent(interactions);
    if (intent && intent.confidence >= 0.5) {
      const promptType = 'context_situation';
      if (!this.isPromptInCooldown(profile, promptType)) {
        return {
          id: `context-${intent.type}-${Date.now()}`,
          type: promptType,
          message: intent.contextualQuestion ?? INTENT_QUESTIONS[intent.type],
          options: ['Sim', 'Não'],
          triggerReason: `Intenção detectada: ${intent.type} (confiança: ${intent.confidence.toFixed(2)})`,
          priority: 'high',
        };
      }
    }

    return null;
  }

  detectUserIntent(interactions: UserInteraction[]): UserIntent | null {
    if (interactions.length === 0) {
      return null;
    }

    const queries = interactions
      .filter((i) => i.type === 'search' && i.searchQuery)
      .map((i) => i.searchQuery!.toLowerCase());

    const scores: Record<string, number> = {};
    let maxScore = 0;
    let bestIntent: UserIntent['type'] | null = null;

    for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
      let score = 0;
      for (const query of queries) {
        for (const keyword of keywords) {
          if (query.includes(keyword)) {
            score += 1;
          }
        }
      }
      scores[intentType] = score;
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intentType as UserIntent['type'];
      }
    }

    if (!bestIntent || maxScore === 0) {
      return null;
    }

    const totalQueries = Math.max(1, queries.length);
    const confidence = Math.min(1, maxScore / totalQueries);

    return {
      type: bestIntent,
      confidence,
      suggestedCategories: INTENT_CATEGORIES[bestIntent],
      contextualQuestion: INTENT_QUESTIONS[bestIntent],
    };
  }

  async markPromptAsShown(userId: string, promptId: string, promptType?: string): Promise<void> {
    this.sessionPromptCount += 1;

    const profile = await this.db.userProfile.get(userId);
    if (!profile) {
      return;
    }

    const entry: PromptHistoryEntry = {
      promptId,
      promptType: promptType ?? promptId.split('-')[0] ?? 'unknown',
      shownAt: Date.now(),
      response: 'ignored', // default until user responds
    };

    const updatedHistory = [...profile.promptHistory, entry];

    await this.db.userProfile.update(userId, {
      promptHistory: updatedHistory,
    });
  }

  isPromptInCooldown(profile: UserProfile, promptType: string): boolean {
    const now = Date.now();

    const relevantPrompts = profile.promptHistory
      .filter(
        (entry) =>
          entry.promptType === promptType &&
          (entry.response === 'ignored' || entry.response === 'dismissed'),
      )
      .sort((a, b) => b.shownAt - a.shownAt);

    if (relevantPrompts.length === 0) {
      return false;
    }

    const lastShown = relevantPrompts[0].shownAt;
    return now - lastShown < COOLDOWN_MS;
  }

  resetSession(): void {
    this.sessionPromptCount = 0;
  }
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    reparos_domesticos: 'reparos domésticos',
    servicos_pessoais: 'serviços pessoais',
    automotivo: 'serviços automotivos',
    construcao: 'construção',
    outros: 'outros serviços',
  };
  return names[category] ?? category;
}
