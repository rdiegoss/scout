/**
 * Unit tests for EmbeddingGenerator service.
 * Tests embedding generation for queries, services, and user profiles.
 *
 * Validates: Requirements 3.1, 3.4, 3.5
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  EmbeddingGenerator,
  EMBEDDING_DIMENSION,
  tokenizeText,
  buildServiceText,
  buildUserText,
  normalizeVector,
} from '@client/services/embeddingGenerator';
import type { ServiceProvider } from '@shared/types';
import type { UserProfile } from '@shared/types/user';

// Helper to create a minimal ServiceProvider
function createTestService(overrides?: Partial<ServiceProvider>): ServiceProvider {
  return {
    id: 'test-service-1',
    name: 'João Eletricista',
    description: 'Serviços elétricos residenciais e comerciais em São Paulo',
    category: 'reparos_domesticos',
    subcategory: 'eletricista',
    phone: '(11) 99999-1234',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua das Flores, 123, São Paulo',
    location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
    averageRating: 4.5,
    totalRatings: 20,
    recentRatings: [],
    registeredBy: 'user-1',
    neighborhoodScore: 0.8,
    dataSource: 'manual',
    verifiedByUsers: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  };
}

// Helper to create a minimal UserProfile
function createTestProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: 'test-user-1',
    firstName: 'Maria',
    location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: Date.now() },
    searchHistory: [
      { query: 'eletricista', timestamp: Date.now(), resultsCount: 5 },
      { query: 'encanador urgente', timestamp: Date.now(), resultsCount: 3 },
    ],
    viewedServices: [],
    registeredServices: [],
    favoriteCategories: ['reparos_domesticos'],
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

describe('tokenizeText', () => {
  it('should tokenize text into integer IDs with special tokens', () => {
    const tokens = tokenizeText('hello world', 10, 30000);
    expect(tokens).toHaveLength(10);
    expect(tokens[0]).toBe(1); // [CLS]
    expect(tokens[tokens.indexOf(2)]).toBe(2); // [SEP] present
  });

  it('should pad short sequences to maxLength', () => {
    const tokens = tokenizeText('hi', 20, 30000);
    expect(tokens).toHaveLength(20);
    // Trailing zeros for padding
    expect(tokens.slice(-15).every((t) => t === 0 || t === 2)).toBe(true);
  });

  it('should truncate long sequences to maxLength', () => {
    const longText = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const tokens = tokenizeText(longText, 50, 30000);
    expect(tokens).toHaveLength(50);
  });

  it('should handle Portuguese text with accents', () => {
    const tokens = tokenizeText('serviço elétrico São Paulo', 20, 30000);
    expect(tokens).toHaveLength(20);
    expect(tokens[0]).toBe(1); // [CLS]
  });

  it('should produce deterministic output for same input', () => {
    const tokens1 = tokenizeText('eletricista residencial', 20, 30000);
    const tokens2 = tokenizeText('eletricista residencial', 20, 30000);
    expect(tokens1).toEqual(tokens2);
  });

  it('should handle empty-ish text gracefully', () => {
    const tokens = tokenizeText('   ', 10, 30000);
    expect(tokens).toHaveLength(10);
    expect(tokens[0]).toBe(1); // [CLS]
    expect(tokens[1]).toBe(2); // [SEP] immediately after
  });
});

describe('buildServiceText', () => {
  it('should combine service fields into a single string', () => {
    const service = createTestService();
    const text = buildServiceText(service);
    expect(text).toContain('João Eletricista');
    expect(text).toContain('Serviços elétricos');
    expect(text).toContain('reparos_domesticos');
    expect(text).toContain('eletricista');
    expect(text).toContain('Rua das Flores');
  });

  it('should handle service without subcategory', () => {
    const service = createTestService({ subcategory: undefined });
    const text = buildServiceText(service);
    expect(text).not.toContain('undefined');
  });
});

describe('buildUserText', () => {
  it('should combine user profile data into a single string', () => {
    const profile = createTestProfile();
    const text = buildUserText(profile);
    expect(text).toContain('eletricista');
    expect(text).toContain('encanador urgente');
    expect(text).toContain('reparos_domesticos');
    expect(text).toContain('Maria');
  });

  it('should use fallback text for empty profiles', () => {
    const profile = createTestProfile({
      firstName: undefined,
      searchHistory: [],
      favoriteCategories: [],
      explicitPreferences: [],
      inferredPreferences: [],
      currentContext: undefined,
    });
    const text = buildUserText(profile);
    expect(text).toBe('novo usuario servicos locais');
  });
});

describe('normalizeVector', () => {
  it('should produce a unit-length vector', () => {
    const vector = [3, 4, 0];
    const normalized = normalizeVector(vector);
    const magnitude = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it('should handle zero vector without error', () => {
    const vector = [0, 0, 0];
    const normalized = normalizeVector(vector);
    expect(normalized).toEqual([0, 0, 0]);
  });
});

describe('EmbeddingGenerator', () => {
  let generator: EmbeddingGenerator;

  afterEach(() => {
    if (generator) {
      generator.dispose();
    }
  });

  it('should initialize with fallback model when no model URL is available', async () => {
    generator = new EmbeddingGenerator({ modelUrl: '/nonexistent/model.json' });
    await generator.initialize();
    expect(generator.isInitialized()).toBe(true);
    expect(generator.isUsingFullModel()).toBe(false);
  });

  it('should generate query embedding with correct dimension', async () => {
    generator = new EmbeddingGenerator();
    const embedding = await generator.generateQueryEmbedding('eletricista em São Paulo');
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding.every((v) => typeof v === 'number' && isFinite(v))).toBe(true);
  });

  it('should generate normalized query embedding (unit length)', async () => {
    generator = new EmbeddingGenerator();
    const embedding = await generator.generateQueryEmbedding('encanador urgente');
    const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 4);
  });

  it('should throw error for empty query', async () => {
    generator = new EmbeddingGenerator();
    await expect(generator.generateQueryEmbedding('')).rejects.toThrow('Query text cannot be empty');
    await expect(generator.generateQueryEmbedding('   ')).rejects.toThrow('Query text cannot be empty');
  });

  it('should generate service embedding with correct dimension', async () => {
    generator = new EmbeddingGenerator();
    const service = createTestService();
    const embedding = await generator.generateServiceEmbedding(service);
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding.every((v) => typeof v === 'number' && isFinite(v))).toBe(true);
  });

  it('should generate user embedding with correct dimension', async () => {
    generator = new EmbeddingGenerator();
    const profile = createTestProfile();
    const embedding = await generator.generateUserEmbedding(profile);
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding.every((v) => typeof v === 'number' && isFinite(v))).toBe(true);
  });

  it('should generate deterministic embeddings for same input', async () => {
    generator = new EmbeddingGenerator();
    const embedding1 = await generator.generateQueryEmbedding('costureira');
    const embedding2 = await generator.generateQueryEmbedding('costureira');
    expect(embedding1).toEqual(embedding2);
  });

  it('should generate different embeddings for different inputs', async () => {
    generator = new EmbeddingGenerator();
    const embedding1 = await generator.generateQueryEmbedding('eletricista');
    const embedding2 = await generator.generateQueryEmbedding('mecânico automotivo');
    // They should not be identical
    const identical = embedding1.every((v, i) => v === embedding2[i]);
    expect(identical).toBe(false);
  });

  it('should handle Portuguese text with special characters', async () => {
    generator = new EmbeddingGenerator();
    const embedding = await generator.generateQueryEmbedding(
      'serviço de manutenção elétrica em São Paulo'
    );
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding.every((v) => isFinite(v))).toBe(true);
  });

  it('should handle user profile with no data gracefully', async () => {
    generator = new EmbeddingGenerator();
    const emptyProfile = createTestProfile({
      firstName: undefined,
      searchHistory: [],
      favoriteCategories: [],
      explicitPreferences: [],
      inferredPreferences: [],
      currentContext: undefined,
    });
    const embedding = await generator.generateUserEmbedding(emptyProfile);
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding.every((v) => isFinite(v))).toBe(true);
  });

  it('should properly dispose resources', async () => {
    generator = new EmbeddingGenerator();
    await generator.initialize();
    expect(generator.isInitialized()).toBe(true);
    generator.dispose();
    expect(generator.isInitialized()).toBe(false);
  });

  it('should re-initialize after dispose', async () => {
    generator = new EmbeddingGenerator();
    await generator.initialize();
    generator.dispose();
    const embedding = await generator.generateQueryEmbedding('teste');
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
  });
});
