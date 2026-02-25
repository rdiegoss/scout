import type { GeoPosition, ServiceCategory } from './index';

export interface UserProfile {
  id: string;
  firstName?: string;
  location: GeoPosition;
  manualAddress?: string;
  searchHistory: SearchHistoryEntry[];
  viewedServices: ViewedService[];
  registeredServices: string[];
  favoriteCategories: ServiceCategory[];
  explicitPreferences: ExplicitPreference[];
  inferredPreferences: InferredPreference[];
  currentContext?: UserSituationalContext;
  promptHistory: PromptHistoryEntry[];
  ratings: string[];
  behaviorMetrics: BehaviorMetrics;
  embedding?: number[];
  createdAt: number;
  lastActiveAt: number;
  sessionCount: number;
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  resultsCount: number;
  selectedServiceId?: string;
}

export interface ViewedService {
  serviceId: string;
  viewedAt: number;
  duration: number;
  contacted: boolean;
}

export interface ExplicitPreference {
  category: ServiceCategory;
  priority: 'high' | 'medium' | 'low';
  source: 'user_answer' | 'user_favorite';
  collectedAt: number;
}

export interface InferredPreference {
  category: ServiceCategory;
  confidence: number;
  basedOn: 'search_frequency' | 'view_duration' | 'contact_rate';
  lastUpdated: number;
}

export interface UserSituationalContext {
  type: 'renovation' | 'moving' | 'emergency' | 'routine';
  detectedAt: number;
  confirmedByUser: boolean;
  expiresAt?: number;
}

export interface PromptHistoryEntry {
  promptId: string;
  promptType: string;
  shownAt: number;
  response: 'answered' | 'dismissed' | 'ignored';
  answer?: string;
}

export interface BehaviorMetrics {
  preferredAccessTimes: number[];
  avgSessionDuration: number;
  categoryClickCounts: Record<string, number>;
  searchToContactRatio: number;
}
