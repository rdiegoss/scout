export const config = {
  supabaseUrl: import.meta.env?.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  supabaseAnonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY ?? 'local-anon-key',
  apiUrl: import.meta.env?.VITE_API_URL ?? 'http://localhost:3001',
  redisUrl: (typeof process !== 'undefined' ? process.env.REDIS_URL : undefined) as string | undefined,
  environment: (typeof process !== 'undefined' ? process.env.NODE_ENV : 'development') ?? 'development',
} as const;

export const COLLECTION_RULES = {
  maxPromptsPerSession: 1,
  cooldownDays: 7,
  minInteractionsBeforePrompt: 3,
  viewDurationThreshold: 30,
  repeatSearchThreshold: 2,
} as const;
