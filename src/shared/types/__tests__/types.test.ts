import { describe, it, expect } from 'vitest';
import type {
  GeoPosition,
  ServiceCategory,
  EmbeddingRecord,
  SyncQueueItem,
  CategoryDefinition,
  SubcategoryDefinition,
} from '../index';

describe('EmbeddingRecord', () => {
  it('should represent a service embedding', () => {
    const record: EmbeddingRecord = {
      id: 'emb-1',
      entityType: 'service',
      entityId: 'svc-123',
      vector: new Array(384).fill(0.1),
      metadata: {
        category: 'reparos_domesticos',
        rating: 4.5,
        hasWhatsApp: true,
        updatedAt: Date.now(),
      },
    };

    expect(record.entityType).toBe('service');
    expect(record.vector).toHaveLength(384);
    expect(record.metadata.category).toBe('reparos_domesticos');
    expect(record.metadata.hasWhatsApp).toBe(true);
  });

  it('should represent a user embedding', () => {
    const record: EmbeddingRecord = {
      id: 'emb-2',
      entityType: 'user',
      entityId: 'usr-456',
      vector: new Array(384).fill(-0.2),
      metadata: {
        updatedAt: Date.now(),
      },
    };

    expect(record.entityType).toBe('user');
    expect(record.metadata.category).toBeUndefined();
    expect(record.metadata.location).toBeUndefined();
  });

  it('should represent a query embedding with location metadata', () => {
    const location: GeoPosition = {
      latitude: -23.55,
      longitude: -46.63,
      accuracy: 10,
      timestamp: Date.now(),
    };

    const record: EmbeddingRecord = {
      id: 'emb-3',
      entityType: 'query',
      entityId: 'q-789',
      vector: new Array(384).fill(0),
      metadata: {
        location,
        updatedAt: Date.now(),
      },
    };

    expect(record.entityType).toBe('query');
    expect(record.metadata.location).toEqual(location);
  });
});

describe('SyncQueueItem', () => {
  it('should represent a pending create operation', () => {
    const item: SyncQueueItem = {
      id: 'sync-1',
      operation: 'create',
      entityType: 'service',
      entityId: 'svc-new',
      data: { name: 'Test Service' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    };

    expect(item.operation).toBe('create');
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(0);
    expect(item.lastAttempt).toBeUndefined();
    expect(item.errorMessage).toBeUndefined();
  });

  it('should represent a failed sync with error details', () => {
    const now = Date.now();
    const item: SyncQueueItem = {
      id: 'sync-2',
      operation: 'update',
      entityType: 'rating',
      entityId: 'rat-123',
      data: { score: 5 },
      createdAt: now - 60000,
      lastAttempt: now,
      retryCount: 2,
      maxRetries: 3,
      status: 'failed',
      errorMessage: 'Network timeout',
    };

    expect(item.status).toBe('failed');
    expect(item.retryCount).toBe(2);
    expect(item.lastAttempt).toBe(now);
    expect(item.errorMessage).toBe('Network timeout');
  });

  it('should support all operation types', () => {
    const operations: SyncQueueItem['operation'][] = ['create', 'update', 'delete'];
    operations.forEach((op) => {
      const item: SyncQueueItem = {
        id: `sync-${op}`,
        operation: op,
        entityType: 'profile',
        entityId: 'prof-1',
        data: {},
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 5,
        status: 'pending',
      };
      expect(item.operation).toBe(op);
    });
  });

  it('should support all status values', () => {
    const statuses: SyncQueueItem['status'][] = ['pending', 'syncing', 'failed', 'synced'];
    statuses.forEach((status) => {
      const item: SyncQueueItem = {
        id: `sync-${status}`,
        operation: 'create',
        entityType: 'service',
        entityId: 'svc-1',
        data: {},
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status,
      };
      expect(item.status).toBe(status);
    });
  });
});

describe('CategoryDefinition and SubcategoryDefinition', () => {
  it('should define a category with subcategories', () => {
    const category: CategoryDefinition = {
      id: 'reparos_domesticos',
      name: 'Reparos Domésticos',
      icon: '🔧',
      subcategories: [
        { id: 'eletricista', name: 'Eletricista', keywords: ['elétrica', 'fiação', 'tomada'] },
        { id: 'encanador', name: 'Encanador', keywords: ['hidráulica', 'vazamento', 'cano'] },
      ],
    };

    expect(category.id).toBe('reparos_domesticos');
    expect(category.subcategories).toHaveLength(2);
    expect(category.subcategories[0].keywords).toContain('elétrica');
  });

  it('should allow a category with empty subcategories', () => {
    const category: CategoryDefinition = {
      id: 'outros',
      name: 'Outros',
      icon: '📦',
      subcategories: [],
    };

    expect(category.subcategories).toHaveLength(0);
  });

  it('should define subcategory with keywords for semantic search', () => {
    const sub: SubcategoryDefinition = {
      id: 'mecanico',
      name: 'Mecânico',
      keywords: ['carro', 'motor', 'freio', 'óleo', 'revisão'],
    };

    expect(sub.id).toBe('mecanico');
    expect(sub.keywords.length).toBeGreaterThan(0);
  });

  it('should support all ServiceCategory values as category ids', () => {
    const categoryIds: ServiceCategory[] = [
      'reparos_domesticos',
      'servicos_pessoais',
      'automotivo',
      'construcao',
      'outros',
    ];

    categoryIds.forEach((id) => {
      const cat: CategoryDefinition = {
        id,
        name: id,
        icon: '📌',
        subcategories: [],
      };
      expect(cat.id).toBe(id);
    });
  });
});
