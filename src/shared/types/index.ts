// Core domain types for Scout

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type ServiceCategory =
  | 'reparos_domesticos'
  | 'servicos_pessoais'
  | 'automotivo'
  | 'construcao'
  | 'outros';

export interface ServiceProvider {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  subcategory?: string;
  phone: string;
  hasWhatsApp: boolean;
  whatsAppConfirmed: boolean;
  address: string;
  location: GeoPosition;
  serviceRadius?: number;
  averageRating: number;
  totalRatings: number;
  recentRatings: Rating[];
  registeredBy: string;
  neighborhoodScore: number;
  dataSource: 'manual' | 'kaggle' | 'web_scraping' | 'api' | 'partnership';
  sourceId?: string;
  sourceUrl?: string;
  importedAt?: number;
  verifiedByUsers: number;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface Rating {
  id: string;
  serviceId: string;
  userId: string;
  score: number;
  comment?: string;
  userLocation: GeoPosition;
  isNeighbor: boolean;
  createdAt: number;
  updatedAt?: number;
  helpful: number;
}

// Embedding storage for vector database
export interface EmbeddingRecord {
  id: string;
  entityType: 'service' | 'user' | 'query';
  entityId: string;
  vector: number[]; // 384 dimensions
  metadata: {
    category?: string;
    location?: GeoPosition;
    rating?: number;
    hasWhatsApp?: boolean;
    updatedAt: number;
  };
}

// Offline sync queue item
export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'service' | 'rating' | 'profile';
  entityId: string;
  data: unknown;
  createdAt: number;
  lastAttempt?: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  errorMessage?: string;
}

// Category and subcategory definitions
export interface SubcategoryDefinition {
  id: string;
  name: string;
  keywords: string[];
}

export interface CategoryDefinition {
  id: ServiceCategory;
  name: string;
  icon: string;
  subcategories: SubcategoryDefinition[];
}
