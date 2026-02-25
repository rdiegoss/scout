import type { ServiceProvider, Rating, GeoPosition } from '@shared/types';
import { type AppDatabase, type InteractionRecord, db as defaultDb } from './database';
import { haversineDistanceKm } from './vectorDatabaseClient';

export interface BoostedService extends ServiceProvider {

  boostedScore: number;

  isNeighborRecommended: boolean;
}

export interface SituationalContext {
  type: 'moving' | 'renovation' | 'emergency' | 'routine';
  suggestedCategories: string[];
  label: string;
}

export interface InteractionHistoryEntry {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  servicePhone: string;
  hasWhatsApp: boolean;
  interactions: InteractionRecord[];
  lastInteraction: number;
}

export interface ComplementarySuggestion {
  service: ServiceProvider;
  reason: string;
  relatedCategory: string;
}

const COMMUNITY_BOOST = 1.25;

const NEIGHBOR_RECOMMENDATION_THRESHOLD = 0.7;

const MIN_NEIGHBOR_RATINGS = 2;

const NEIGHBOR_RADIUS_KM = 5;

const SITUATIONAL_CONTEXT_MAP: Record<string, SituationalContext> = {
  'acabei de me mudar': {
    type: 'moving',
    suggestedCategories: ['eletricista', 'encanador', 'pintor', 'diarista', 'chaveiro', 'marceneiro'],
    label: 'Mudança recente',
  },
  'mudei recentemente': {
    type: 'moving',
    suggestedCategories: ['eletricista', 'encanador', 'pintor', 'diarista', 'chaveiro', 'marceneiro'],
    label: 'Mudança recente',
  },
  'reforma em andamento': {
    type: 'renovation',
    suggestedCategories: ['pedreiro', 'eletricista', 'encanador', 'pintor', 'azulejista', 'gesseiro', 'vidraceiro'],
    label: 'Reforma',
  },
  'estou reformando': {
    type: 'renovation',
    suggestedCategories: ['pedreiro', 'eletricista', 'encanador', 'pintor', 'azulejista', 'gesseiro', 'vidraceiro'],
    label: 'Reforma',
  },
  'emergência': {
    type: 'emergency',
    suggestedCategories: ['eletricista', 'encanador', 'chaveiro', 'vidraceiro'],
    label: 'Emergência',
  },
  'urgente': {
    type: 'emergency',
    suggestedCategories: ['eletricista', 'encanador', 'chaveiro', 'vidraceiro'],
    label: 'Emergência',
  },
  'manutenção da casa': {
    type: 'routine',
    suggestedCategories: ['eletricista', 'encanador', 'pintor', 'jardineiro', 'diarista', 'dedetizador'],
    label: 'Manutenção',
  },
};

const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  eletricista: ['encanador', 'pintor', 'gesseiro'],
  encanador: ['eletricista', 'azulejista', 'pedreiro'],
  pintor: ['gesseiro', 'pedreiro', 'marceneiro'],
  pedreiro: ['eletricista', 'encanador', 'azulejista', 'pintor'],
  azulejista: ['encanador', 'pedreiro', 'gesseiro'],
  gesseiro: ['pintor', 'eletricista'],
  marceneiro: ['pintor', 'serralheiro'],
  serralheiro: ['marceneiro', 'vidraceiro'],
  vidraceiro: ['serralheiro', 'marceneiro'],
  mecanico: ['eletricista_auto', 'funileiro', 'borracheiro'],
  eletricista_auto: ['mecanico', 'borracheiro'],
  funileiro: ['mecanico', 'pintor'],
  borracheiro: ['mecanico'],
  costureira: ['cabeleireiro', 'manicure'],
  cabeleireiro: ['manicure', 'costureira'],
  manicure: ['cabeleireiro', 'costureira'],
  diarista: ['jardineiro', 'dedetizador'],
  jardineiro: ['diarista', 'dedetizador'],
  dedetizador: ['diarista', 'jardineiro'],
  chaveiro: ['serralheiro'],
  tecnico_informatica: [],
};

export class DifferentiationService {
  private db: AppDatabase;

  constructor(db: AppDatabase = defaultDb) {
    this.db = db;
  }

  applyCommunityBoost(
    services: ServiceProvider[],
    baseScores: Map<string, number>,
  ): BoostedService[] {
    return services.map((service) => {
      const baseScore = baseScores.get(service.id) ?? 0;
      const isCommunityService = service.dataSource === 'manual';
      const boostedScore = isCommunityService
        ? baseScore * COMMUNITY_BOOST
        : baseScore;

      return {
        ...service,
        boostedScore,
        isNeighborRecommended: false, // set separately by markNeighborRecommended
      };
    });
  }

  isNeighborRecommended(service: ServiceProvider, ratings: Rating[]): boolean {
    if (service.neighborhoodScore < NEIGHBOR_RECOMMENDATION_THRESHOLD) {
      return false;
    }

    const neighborRatings = ratings.filter((r) => r.isNeighbor);
    return neighborRatings.length >= MIN_NEIGHBOR_RATINGS;
  }

  async markNeighborRecommended(services: BoostedService[]): Promise<BoostedService[]> {
    const results: BoostedService[] = [];

    for (const service of services) {
      const ratings = await this.db.ratings
        .where('serviceId')
        .equals(service.id)
        .toArray();

      results.push({
        ...service,
        isNeighborRecommended: this.isNeighborRecommended(service, ratings),
      });
    }

    return results;
  }

  isNeighborRating(
    ratingLocation: GeoPosition,
    serviceLocation: GeoPosition,
    radiusKm: number = NEIGHBOR_RADIUS_KM,
  ): boolean {
    const distance = haversineDistanceKm(
      ratingLocation.latitude,
      ratingLocation.longitude,
      serviceLocation.latitude,
      serviceLocation.longitude,
    );
    return distance <= radiusKm;
  }

  matchSituationalContext(query: string): SituationalContext | null {
    const normalizedQuery = query.toLowerCase().trim();

    if (SITUATIONAL_CONTEXT_MAP[normalizedQuery]) {
      return SITUATIONAL_CONTEXT_MAP[normalizedQuery];
    }

    for (const [phrase, context] of Object.entries(SITUATIONAL_CONTEXT_MAP)) {
      if (normalizedQuery.includes(phrase) || phrase.includes(normalizedQuery)) {
        return context;
      }
    }

    return null;
  }

  async searchBySituationalContext(
    query: string,
    userLocation?: GeoPosition,
    radiusKm: number = 10,
  ): Promise<{ context: SituationalContext; services: ServiceProvider[] } | null> {
    const context = this.matchSituationalContext(query);
    if (!context) {
      return null;
    }

    let services = await this.db.services
      .filter((s) => s.isActive && context.suggestedCategories.includes(s.subcategory ?? ''))
      .toArray();

    if (userLocation) {
      services = services.filter(
        (s) =>
          haversineDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            s.location.latitude,
            s.location.longitude,
          ) <= radiusKm,
      );
    }

    services.sort((a, b) => b.averageRating - a.averageRating);

    return { context, services };
  }

  async recordInteraction(
    userId: string,
    serviceId: string,
    type: InteractionRecord['type'],
    details?: string,
  ): Promise<void> {
    await this.db.interactionHistory.add({
      userId,
      serviceId,
      type,
      timestamp: Date.now(),
      details,
    });
  }

  async getInteractionHistory(
    userId: string,
    limit: number = 20,
  ): Promise<InteractionHistoryEntry[]> {
    const interactions = await this.db.interactionHistory
      .where('userId')
      .equals(userId)
      .toArray();

    const grouped = new Map<string, InteractionRecord[]>();
    for (const interaction of interactions) {
      const existing = grouped.get(interaction.serviceId) ?? [];
      existing.push(interaction);
      grouped.set(interaction.serviceId, existing);
    }

    const entries: InteractionHistoryEntry[] = [];
    for (const [serviceId, serviceInteractions] of grouped) {
      const service = await this.db.services.get(serviceId);
      if (!service) continue;

      serviceInteractions.sort((a, b) => b.timestamp - a.timestamp);

      entries.push({
        serviceId,
        serviceName: service.name,
        serviceCategory: service.category,
        servicePhone: service.phone,
        hasWhatsApp: service.hasWhatsApp,
        interactions: serviceInteractions,
        lastInteraction: serviceInteractions[0].timestamp,
      });
    }

    entries.sort((a, b) => b.lastInteraction - a.lastInteraction);
    return entries.slice(0, limit);
  }

  async getServiceInteractions(
    userId: string,
    serviceId: string,
  ): Promise<InteractionRecord[]> {
    const interactions = await this.db.interactionHistory
      .where('[userId+serviceId]')
      .equals([userId, serviceId])
      .toArray();

    if (interactions.length === 0) {
      const all = await this.db.interactionHistory
        .where('userId')
        .equals(userId)
        .toArray();
      return all
        .filter((i) => i.serviceId === serviceId)
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    return interactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  async suggestComplementaryServices(
    currentService: ServiceProvider,
    userLocation?: GeoPosition,
    limit: number = 5,
  ): Promise<ComplementarySuggestion[]> {
    const subcategory = currentService.subcategory ?? '';
    const complementarySubcategories = COMPLEMENTARY_CATEGORIES[subcategory] ?? [];

    if (complementarySubcategories.length === 0) {
      return [];
    }

    let candidates = await this.db.services
      .filter(
        (s) =>
          s.isActive &&
          s.id !== currentService.id &&
          complementarySubcategories.includes(s.subcategory ?? ''),
      )
      .toArray();

    if (userLocation) {
      candidates = candidates.filter(
        (s) =>
          haversineDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            s.location.latitude,
            s.location.longitude,
          ) <= 10,
      );
    }

    candidates.sort((a, b) => b.averageRating - a.averageRating);

    return candidates.slice(0, limit).map((service) => ({
      service,
      reason: `Complementar a ${subcategory}`,
      relatedCategory: service.subcategory ?? service.category,
    }));
  }

  getComplementaryCategories(subcategory: string): string[] {
    return COMPLEMENTARY_CATEGORIES[subcategory] ?? [];
  }
}
