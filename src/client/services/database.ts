import Dexie, { type Table } from 'dexie';
import type { ServiceProvider, Rating, EmbeddingRecord, SyncQueueItem } from '@shared/types';
import type { UserProfile, SearchHistoryEntry, ViewedService } from '@shared/types/user';
import { SEED_SERVICES } from './seedData';

export interface InteractionRecord {
  id?: number;
  userId: string;
  serviceId: string;
  type: 'view' | 'contact' | 'rating' | 'search' | 'register';
  timestamp: number;
  details?: string;
}

export interface SearchHistoryRecord extends SearchHistoryEntry {
  id?: number;
}

export interface ViewedServiceRecord extends ViewedService {
  id?: number;
}

export class AppDatabase extends Dexie {
  userProfile!: Table<UserProfile, string>;
  services!: Table<ServiceProvider, string>;
  ratings!: Table<Rating, string>;
  searchHistory!: Table<SearchHistoryRecord, number>;
  viewedServices!: Table<ViewedServiceRecord, number>;
  syncQueue!: Table<SyncQueueItem, string>;
  cachedEmbeddings!: Table<EmbeddingRecord, string>;
  interactionHistory!: Table<InteractionRecord, number>;

  constructor(name = 'LocalServicesRecommenderDB') {
    super(name);

    this.version(1).stores({
      userProfile: 'id',
      services: 'id, category, *location, averageRating',
      ratings: 'id, serviceId, userId, createdAt',
      searchHistory: '++id, query, timestamp',
      viewedServices: '++id, serviceId, viewedAt',
      syncQueue: 'id, status, createdAt',
      cachedEmbeddings: 'id, entityType, entityId',
    });

    this.version(2).stores({
      interactionHistory: '++id, userId, serviceId, type, timestamp',
    });

    this.version(3).stores({}).upgrade(async (tx) => {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const idMap: Record<string, string> = {};
      const services = tx.table('services');
      const allServices = await services.toArray();
      for (const svc of allServices) {
        if (!UUID_RE.test(svc.id)) {
          const newId = crypto.randomUUID();
          idMap[svc.id] = newId;
          await services.delete(svc.id);
          await services.add({ ...svc, id: newId, updatedAt: Date.now() });
        }
      }

      const ratings = tx.table('ratings');
      const allRatings = await ratings.toArray();
      for (const rating of allRatings) {
        const mappedServiceId = idMap[rating.serviceId];
        if (mappedServiceId) {
          await ratings.update(rating.id, { serviceId: mappedServiceId });
        }
      }

      const queue = tx.table('syncQueue');
      const allQueued = await queue.toArray();
      for (const item of allQueued) {
        const hasLegacyId = !UUID_RE.test(item.entityId);
        const dataObj = item.data as Record<string, unknown> | undefined;
        const hasLegacyRef =
          dataObj &&
          typeof dataObj === 'object' &&
          (typeof dataObj.serviceId === 'string' && !UUID_RE.test(dataObj.serviceId)) ||
          (typeof dataObj?.id === 'string' && !UUID_RE.test(dataObj.id as string));
        if (hasLegacyId || hasLegacyRef) {
          await queue.delete(item.id);
        }
      }
    });

    if (name === 'LocalServicesRecommenderDB') {
      this.on('populate', (tx) => {
        const table = tx.table('services');
        for (const svc of SEED_SERVICES) {
          table.add(svc);
        }
      });
    }
  }
}

export const db = new AppDatabase();
