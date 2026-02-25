/**
 * Unit tests for SyncService
 *
 * Verifies:
 * 1. Queuing operations for offline sync
 * 2. Syncing pending data when online
 * 3. Connectivity detection and change listeners
 * 4. Exponential backoff retry on failure
 * 5. Max retries limit
 *
 * Validates: Requirements 9.3, 9.4
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppDatabase } from '@client/services/database';
import {
  SyncService,
  calculateBackoffDelay,
  type PendingOperation,
  type SyncExecutor,
} from '@client/services/syncService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOperation(overrides: Partial<PendingOperation> = {}): PendingOperation {
  return {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'create',
    entity: 'service',
    data: { name: 'Test Service' },
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SyncService', () => {
  let db: AppDatabase;
  let executor: SyncExecutor;
  let service: SyncService;

  beforeEach(() => {
    db = new AppDatabase(`test-sync-${Date.now()}-${Math.random()}`);
    executor = vi.fn().mockResolvedValue(undefined);
    service = new SyncService(db, executor, true);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('isOnline / setOnline', () => {
    it('should return the initial online status', () => {
      expect(service.isOnline()).toBe(true);

      const offlineService = new SyncService(db, executor, false);
      expect(offlineService.isOnline()).toBe(false);
    });

    it('should update online status via setOnline', () => {
      service.setOnline(false);
      expect(service.isOnline()).toBe(false);

      service.setOnline(true);
      expect(service.isOnline()).toBe(true);
    });
  });

  describe('onConnectivityChange', () => {
    it('should notify listeners when connectivity changes', () => {
      const listener = vi.fn();
      service.onConnectivityChange(listener);

      service.setOnline(false);
      expect(listener).toHaveBeenCalledWith(false);

      service.setOnline(true);
      expect(listener).toHaveBeenCalledWith(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should not notify listeners when status does not change', () => {
      const listener = vi.fn();
      service.onConnectivityChange(listener);

      service.setOnline(true); // already true
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      service.onConnectivityChange(listener1);
      service.onConnectivityChange(listener2);

      service.setOnline(false);
      expect(listener1).toHaveBeenCalledWith(false);
      expect(listener2).toHaveBeenCalledWith(false);
    });
  });

  describe('queueOperation', () => {
    it('should persist operation to syncQueue', async () => {
      const op = makeOperation({ id: 'op-1' });
      await service.queueOperation(op);

      const stored = await db.syncQueue.get('op-1');
      expect(stored).toBeDefined();
      expect(stored!.operation).toBe('create');
      expect(stored!.entityType).toBe('service');
      expect(stored!.status).toBe('pending');
      expect(stored!.retryCount).toBe(0);
    });

    it('should map PendingOperation fields to SyncQueueItem correctly', async () => {
      const op = makeOperation({
        id: 'op-2',
        type: 'update',
        entity: 'rating',
        data: { score: 5 },
        timestamp: 1000,
        retryCount: 2,
      });
      await service.queueOperation(op);

      const stored = await db.syncQueue.get('op-2');
      expect(stored!.operation).toBe('update');
      expect(stored!.entityType).toBe('rating');
      expect(stored!.data).toEqual({ score: 5 });
      expect(stored!.createdAt).toBe(1000);
      expect(stored!.retryCount).toBe(2);
      expect(stored!.maxRetries).toBe(5);
    });

    it('should queue multiple operations', async () => {
      await service.queueOperation(makeOperation({ id: 'a' }));
      await service.queueOperation(makeOperation({ id: 'b' }));
      await service.queueOperation(makeOperation({ id: 'c' }));

      const count = await db.syncQueue.count();
      expect(count).toBe(3);
    });
  });

  describe('syncPendingData', () => {
    it('should sync all pending operations and mark them as synced', async () => {
      await service.queueOperation(makeOperation({ id: 'op-1', timestamp: 100 }));
      await service.queueOperation(makeOperation({ id: 'op-2', timestamp: 200 }));

      const result = await service.syncPendingData();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.pending).toBe(0);

      const item1 = await db.syncQueue.get('op-1');
      expect(item1!.status).toBe('synced');
      const item2 = await db.syncQueue.get('op-2');
      expect(item2!.status).toBe('synced');
    });

    it('should call executor for each pending item', async () => {
      await service.queueOperation(makeOperation({ id: 'op-1', timestamp: 100 }));
      await service.queueOperation(makeOperation({ id: 'op-2', timestamp: 200 }));

      await service.syncPendingData();

      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should process items in FIFO order (oldest first)', async () => {
      await service.queueOperation(makeOperation({ id: 'op-new', timestamp: 2000 }));
      await service.queueOperation(makeOperation({ id: 'op-old', timestamp: 1000 }));

      const callOrder: string[] = [];
      (executor as ReturnType<typeof vi.fn>).mockImplementation(async (item) => {
        callOrder.push(item.id);
      });

      await service.syncPendingData();

      expect(callOrder).toEqual(['op-old', 'op-new']);
    });

    it('should return empty result when no pending items', async () => {
      const result = await service.syncPendingData();
      expect(result).toEqual({ synced: 0, failed: 0, pending: 0 });
    });

    it('should not process already synced items', async () => {
      await service.queueOperation(makeOperation({ id: 'op-1' }));
      await db.syncQueue.update('op-1', { status: 'synced' });

      const result = await service.syncPendingData();
      expect(result.synced).toBe(0);
      expect(executor).not.toHaveBeenCalled();
    });
  });

  describe('failure handling and retry (Requirement 9.4)', () => {
    it('should mark failed items with incremented retryCount', async () => {
      (executor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await service.queueOperation(makeOperation({ id: 'op-fail', timestamp: 100 }));
      const result = await service.syncPendingData();

      expect(result.failed).toBe(1);

      const item = await db.syncQueue.get('op-fail');
      expect(item!.retryCount).toBe(1);
      expect(item!.errorMessage).toBe('Network error');
      expect(item!.lastAttempt).toBeGreaterThan(0);
    });

    it('should keep failed items as pending for retry when under max retries', async () => {
      (executor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await service.queueOperation(makeOperation({ id: 'op-retry', timestamp: 100 }));
      await service.syncPendingData();

      const item = await db.syncQueue.get('op-retry');
      expect(item!.status).toBe('pending');
      expect(item!.retryCount).toBe(1);
    });

    it('should mark items as failed permanently when max retries exceeded', async () => {
      (executor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await service.queueOperation(
        makeOperation({ id: 'op-max', timestamp: 100, retryCount: 4 }),
      );

      // retryCount is 4, maxRetries is 5, so after one more failure it hits 5
      await service.syncPendingData();

      const item = await db.syncQueue.get('op-max');
      expect(item!.status).toBe('failed');
      expect(item!.retryCount).toBe(5);
    });

    it('should not retry items that already exceeded max retries', async () => {
      await service.queueOperation(
        makeOperation({ id: 'op-done', timestamp: 100, retryCount: 5 }),
      );
      // Manually set maxRetries to match
      await db.syncQueue.update('op-done', { retryCount: 5 });

      const result = await service.syncPendingData();
      expect(executor).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
    });

    it('should handle mixed success and failure', async () => {
      let callCount = 0;
      (executor as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error('fail');
      });

      await service.queueOperation(makeOperation({ id: 'op-ok', timestamp: 100 }));
      await service.queueOperation(makeOperation({ id: 'op-fail', timestamp: 200 }));

      const result = await service.syncPendingData();
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should store error message from non-Error throws', async () => {
      (executor as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      await service.queueOperation(makeOperation({ id: 'op-str', timestamp: 100 }));
      await service.syncPendingData();

      const item = await db.syncQueue.get('op-str');
      expect(item!.errorMessage).toBe('string error');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should return base delay for first retry', () => {
      expect(calculateBackoffDelay(0)).toBe(1000);
    });

    it('should double delay for each retry', () => {
      expect(calculateBackoffDelay(1)).toBe(2000);
      expect(calculateBackoffDelay(2)).toBe(4000);
      expect(calculateBackoffDelay(3)).toBe(8000);
    });

    it('should cap delay at max value', () => {
      expect(calculateBackoffDelay(10)).toBe(30_000);
      expect(calculateBackoffDelay(20)).toBe(30_000);
    });
  });

  describe('backoff timing', () => {
    it('should skip items whose backoff delay has not elapsed', async () => {
      (executor as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

      await service.queueOperation(makeOperation({ id: 'op-backoff', timestamp: 100 }));

      // First sync: fails, sets lastAttempt
      await service.syncPendingData();

      // Reset mock to succeed
      (executor as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Immediately try again - should skip due to backoff
      const result = await service.syncPendingData();
      // The executor should not have been called again because backoff hasn't elapsed
      expect(executor).toHaveBeenCalledTimes(1); // only the first call
      expect(result.synced).toBe(0);
    });
  });
});
