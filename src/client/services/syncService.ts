import type { SyncQueueItem } from '@shared/types';
import { type AppDatabase, db as defaultDb } from './database';

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'service' | 'rating' | 'profile';
  data: unknown;
  timestamp: number;
  retryCount: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

export type SyncExecutor = (item: SyncQueueItem) => Promise<void>;

const DEFAULT_MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export function calculateBackoffDelay(retryCount: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  return delay;
}

export class SyncService {
  private db: AppDatabase;
  private executor: SyncExecutor;
  private online: boolean;
  private connectivityListeners: Array<(online: boolean) => void> = [];

  constructor(
    db: AppDatabase = defaultDb,
    executor: SyncExecutor = defaultSyncExecutor,
    initialOnline?: boolean,
  ) {
    this.db = db;
    this.executor = executor;
    this.online = initialOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);
  }

  isOnline(): boolean {
    return this.online;
  }

  setOnline(online: boolean): void {
    const changed = this.online !== online;
    this.online = online;
    if (changed) {
      for (const listener of this.connectivityListeners) {
        listener(online);
      }
    }
  }

  onConnectivityChange(callback: (online: boolean) => void): void {
    this.connectivityListeners.push(callback);
  }

  async queueOperation(operation: PendingOperation): Promise<void> {
    const item: SyncQueueItem = {
      id: operation.id,
      operation: operation.type,
      entityType: operation.entity,
      entityId: operation.id,
      data: operation.data,
      createdAt: operation.timestamp,
      retryCount: operation.retryCount,
      maxRetries: DEFAULT_MAX_RETRIES,
      status: 'pending',
    };

    await this.db.syncQueue.put(item);
  }

  async syncPendingData(): Promise<SyncResult> {
    const pendingItems = await this.db.syncQueue
      .where('status')
      .anyOf('pending', 'failed')
      .toArray();

    const retryable = pendingItems.filter((item) => item.retryCount < item.maxRetries);

    retryable.sort((a, b) => a.createdAt - b.createdAt);

    let synced = 0;
    let failed = 0;

    for (const item of retryable) {
      if (item.lastAttempt) {
        const delay = calculateBackoffDelay(item.retryCount);
        const elapsed = Date.now() - item.lastAttempt;
        if (elapsed < delay) {
          continue; // Skip this item, not ready for retry yet
        }
      }

      await this.db.syncQueue.update(item.id, { status: 'syncing' });

      try {
        await this.executor(item);
        await this.db.syncQueue.update(item.id, { status: 'synced' });
        synced++;
      } catch (error) {
        const newRetryCount = item.retryCount + 1;
        const newStatus = newRetryCount >= item.maxRetries ? 'failed' : 'pending';
        const errorMessage = error instanceof Error ? error.message : String(error);

        await this.db.syncQueue.update(item.id, {
          status: newStatus,
          retryCount: newRetryCount,
          lastAttempt: Date.now(),
          errorMessage,
        });
        failed++;
      }
    }

    const remainingPending = await this.db.syncQueue
      .where('status')
      .anyOf('pending', 'failed')
      .count();

    return { synced, failed, pending: remainingPending };
  }
}

async function defaultSyncExecutor(_item: SyncQueueItem): Promise<void> {
  throw new Error('SyncExecutor not configured');
}
