import * as tf from '@tensorflow/tfjs';
import type { ServiceProvider } from '@shared/types';
import type { UserProfile } from '@shared/types/user';

export const EMBEDDING_DIMENSION = 384;

export interface EmbeddingModelConfig {
  modelUrl?: string;
  vocabSize?: number;
  maxSequenceLength?: number;
}

const DEFAULT_CONFIG: Required<EmbeddingModelConfig> = {
  modelUrl: '/models/sentence-transformer/model.json',
  vocabSize: 30522,
  maxSequenceLength: 128,
};

export function tokenizeText(
  text: string,
  maxLength: number,
  vocabSize: number,
): number[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  const tokenIds = words.map((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) & 0x7fffffff;
    }
    return (hash % (vocabSize - 3)) + 3;
  });

  const withSpecialTokens = [1, ...tokenIds.slice(0, maxLength - 2), 2];

  while (withSpecialTokens.length < maxLength) {
    withSpecialTokens.push(0);
  }

  return withSpecialTokens.slice(0, maxLength);
}

export function buildServiceText(service: ServiceProvider): string {
  const parts = [service.name, service.description, service.category];

  if (service.subcategory) {
    parts.push(service.subcategory);
  }

  if (service.address) {
    parts.push(service.address);
  }

  return parts.join(' ');
}

export function buildUserText(profile: UserProfile): string {
  const parts: string[] = [];

  if (profile.searchHistory.length > 0) {
    const recentQueries = profile.searchHistory
      .slice(-10)
      .map((entry) => entry.query);
    parts.push(...recentQueries);
  }

  if (profile.favoriteCategories.length > 0) {
    parts.push(...profile.favoriteCategories);
  }

  if (profile.explicitPreferences.length > 0) {
    const prefCategories = profile.explicitPreferences.map((p) => p.category);
    parts.push(...prefCategories);
  }

  if (profile.inferredPreferences.length > 0) {
    const highConfidence = profile.inferredPreferences
      .filter((p) => p.confidence > 0.5)
      .map((p) => p.category);
    parts.push(...highConfidence);
  }

  if (profile.currentContext) {
    parts.push(profile.currentContext.type);
  }

  if (profile.firstName) {
    parts.push(profile.firstName);
  }

  if (parts.length === 0) {
    parts.push('new user local services');
  }

  return parts.join(' ');
}

export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((val) => val / magnitude);
}

export class EmbeddingGenerator {
  private model: tf.LayersModel | tf.GraphModel | null = null;
  private fallbackModel: tf.LayersModel | null = null;
  private config: Required<EmbeddingModelConfig>;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config?: EmbeddingModelConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.model = await tf.loadGraphModel(this.config.modelUrl);
      this.initialized = true;
    } catch {
      this.fallbackModel = this.createFallbackModel();
      this.initialized = true;
    }
  }

  private createFallbackModel(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.maxSequenceLength] });

    const embeddingLayer = tf.layers
      .embedding({
        inputDim: this.config.vocabSize,
        outputDim: EMBEDDING_DIMENSION,
        inputLength: this.config.maxSequenceLength,
      })
      .apply(input);

    const pooled = tf.layers
      .globalAveragePooling1d()
      .apply(embeddingLayer) as tf.SymbolicTensor;

    const model = tf.model({ inputs: input, outputs: pooled });
    return model;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();

    const tokenIds = tokenizeText(
      text,
      this.config.maxSequenceLength,
      this.config.vocabSize,
    );

    const inputTensor = tf.tensor2d([tokenIds], [1, this.config.maxSequenceLength]);

    try {
      let outputTensor: tf.Tensor;

      if (this.model) {
        const result = this.model.predict(inputTensor) as tf.Tensor | tf.Tensor[];
        outputTensor = Array.isArray(result) ? result[0] : result;
      } else if (this.fallbackModel) {
        const result = this.fallbackModel.predict(inputTensor);
        outputTensor = Array.isArray(result) ? result[0] : result;
      } else {
        throw new Error('No embedding model available');
      }

      const values = await outputTensor.data();
      outputTensor.dispose();

      const embedding = Array.from(values) as number[];
      return normalizeVector(embedding);
    } finally {
      inputTensor.dispose();
    }
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Query text cannot be empty');
    }
    return this.generateEmbedding(query.trim());
  }

  async generateServiceEmbedding(service: ServiceProvider): Promise<number[]> {
    const text = buildServiceText(service);
    return this.generateEmbedding(text);
  }

  async generateUserEmbedding(profile: UserProfile): Promise<number[]> {
    const text = buildUserText(profile);
    return this.generateEmbedding(text);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isUsingFullModel(): boolean {
    return this.model !== null;
  }

  dispose(): void {
    if (this.model && 'dispose' in this.model) {
      this.model.dispose();
    }
    if (this.fallbackModel) {
      this.fallbackModel.dispose();
    }
    this.model = null;
    this.fallbackModel = null;
    this.initialized = false;
    this.initPromise = null;
  }
}
