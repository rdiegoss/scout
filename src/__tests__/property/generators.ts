/**
 * Custom fast-check generators for property-based testing.
 * These generators produce valid domain objects for Scout.
 */
import * as fc from 'fast-check';
import type { GeoPosition, ServiceCategory, ServiceProvider, Rating } from '@shared/types';
import type {
  UserProfile,
  SearchHistoryEntry,
  ViewedService,
  ExplicitPreference,
  InferredPreference,
  UserSituationalContext,
  PromptHistoryEntry,
  BehaviorMetrics,
} from '@shared/types/user';

// Default property test configuration
export const propertyTestConfig: fc.Parameters<unknown> = {
  numRuns: 100,
  verbose: true,
};

// Valid Brazilian DDD codes
const VALID_DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
] as const;

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'reparos_domesticos',
  'servicos_pessoais',
  'automotivo',
  'construcao',
  'outros',
];

// GPS coordinates generator (valid ranges)
export const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.double({ min: 1, max: 1000, noNaN: true }),
  timestamp: fc.integer({ min: 0 }),
});

// Helper to generate digit strings of exact length
const digitString = (length: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
    minLength: length,
    maxLength: length,
  }).map((digits) => digits.join(''));

// Helper to generate a valid mobile number (9 digits, starts with 9)
const mobileNumberArb: fc.Arbitrary<string> = digitString(8).map(
  (rest) => `9${rest}`,
);

// Helper to generate a valid landline number (8 digits, does NOT start with 9)
const landlineNumberArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('2', '3', '4', '5', '6', '7', '8'),
    digitString(7),
  )
  .map(([first, rest]) => `${first}${rest}`);

// Brazilian phone number generator (valid formats)
export const brazilianPhoneArb: fc.Arbitrary<string> = fc.oneof(
  // Format: (XX) XXXXX-XXXX (mobile with DDD)
  fc.tuple(fc.constantFrom(...VALID_DDDS), mobileNumberArb).map(
    ([ddd, num]) => `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`,
  ),
  // Format: (XX) XXXX-XXXX (landline with DDD)
  fc.tuple(fc.constantFrom(...VALID_DDDS), landlineNumberArb).map(
    ([ddd, num]) => `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`,
  ),
  // Format: +55 XX XXXXX-XXXX (mobile with country code)
  fc.tuple(fc.constantFrom(...VALID_DDDS), mobileNumberArb).map(
    ([ddd, num]) => `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`,
  ),
  // Format: +55 XX XXXX-XXXX (landline with country code)
  fc.tuple(fc.constantFrom(...VALID_DDDS), landlineNumberArb).map(
    ([ddd, num]) => `+55 ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`,
  ),
  // Format: XXXXX-XXXX (mobile without DDD)
  mobileNumberArb.map((num) => `${num.slice(0, 5)}-${num.slice(5)}`),
  // Format: XXXX-XXXX (landline without DDD)
  landlineNumberArb.map((num) => `${num.slice(0, 4)}-${num.slice(4)}`),
);

// Service category generator
export const serviceCategoryArb: fc.Arbitrary<ServiceCategory> = fc.constantFrom(
  ...SERVICE_CATEGORIES,
);

// Rating score generator (1-5)
export const ratingScoreArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 5 });

// Rating generator
export const ratingArb: fc.Arbitrary<Rating> = fc.record({
  id: fc.uuid(),
  serviceId: fc.uuid(),
  userId: fc.uuid(),
  score: ratingScoreArb,
  comment: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  userLocation: geoPositionArb,
  isNeighbor: fc.boolean(),
  createdAt: fc.integer({ min: 0 }),
  updatedAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
  helpful: fc.integer({ min: 0, max: 1000 }),
});

// ServiceProvider generator
export const serviceProviderArb: fc.Arbitrary<ServiceProvider> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 500 }),
  category: serviceCategoryArb,
  subcategory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  phone: brazilianPhoneArb,
  hasWhatsApp: fc.boolean(),
  whatsAppConfirmed: fc.boolean(),
  address: fc.string({ minLength: 5, maxLength: 200 }),
  location: geoPositionArb,
  serviceRadius: fc.option(fc.double({ min: 1, max: 100, noNaN: true }), { nil: undefined }),
  averageRating: fc.double({ min: 1, max: 5, noNaN: true }),
  totalRatings: fc.integer({ min: 0, max: 10000 }),
  recentRatings: fc.array(ratingArb, { maxLength: 3 }),
  registeredBy: fc.uuid(),
  neighborhoodScore: fc.double({ min: 0, max: 1, noNaN: true }),
  dataSource: fc.constantFrom('manual', 'kaggle', 'web_scraping', 'api', 'partnership' as const),
  sourceId: fc.option(fc.string(), { nil: undefined }),
  sourceUrl: fc.option(fc.string(), { nil: undefined }),
  importedAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
  verifiedByUsers: fc.integer({ min: 0, max: 100 }),
  embedding: fc.option(
    fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 384, maxLength: 384 }),
    { nil: undefined },
  ),
  createdAt: fc.integer({ min: 0 }),
  updatedAt: fc.integer({ min: 0 }),
  isActive: fc.boolean(),
});

// Search history entry generator
export const searchHistoryEntryArb: fc.Arbitrary<SearchHistoryEntry> = fc.record({
  query: fc.string({ minLength: 1, maxLength: 100 }),
  timestamp: fc.integer({ min: 0 }),
  resultsCount: fc.integer({ min: 0, max: 100 }),
  selectedServiceId: fc.option(fc.uuid(), { nil: undefined }),
});

// Viewed service generator
export const viewedServiceArb: fc.Arbitrary<ViewedService> = fc.record({
  serviceId: fc.uuid(),
  viewedAt: fc.integer({ min: 0 }),
  duration: fc.integer({ min: 1, max: 3600 }),
  contacted: fc.boolean(),
});

// Embedding generator (384 dimensions)
export const embeddingArb: fc.Arbitrary<number[]> = fc.array(
  fc.double({ min: -1, max: 1, noNaN: true }),
  { minLength: 384, maxLength: 384 },
);

// Explicit preference generator
export const explicitPreferenceArb = fc.record({
  category: serviceCategoryArb,
  priority: fc.constantFrom('high' as const, 'medium' as const, 'low' as const),
  source: fc.constantFrom('user_answer' as const, 'user_favorite' as const),
  collectedAt: fc.integer({ min: 0 }),
});

// Inferred preference generator
export const inferredPreferenceArb = fc.record({
  category: serviceCategoryArb,
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  basedOn: fc.constantFrom(
    'search_frequency' as const,
    'view_duration' as const,
    'contact_rate' as const,
  ),
  lastUpdated: fc.integer({ min: 0 }),
});

// Situational context generator
export const userSituationalContextArb = fc.record({
  type: fc.constantFrom(
    'renovation' as const,
    'moving' as const,
    'emergency' as const,
    'routine' as const,
  ),
  detectedAt: fc.integer({ min: 0 }),
  confirmedByUser: fc.boolean(),
  expiresAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
});

// Prompt history entry generator
export const promptHistoryEntryArb = fc.record({
  promptId: fc.uuid(),
  promptType: fc.string({ minLength: 1, maxLength: 50 }),
  shownAt: fc.integer({ min: 0 }),
  response: fc.constantFrom('answered' as const, 'dismissed' as const, 'ignored' as const),
  answer: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

// Behavior metrics generator
export const behaviorMetricsArb = fc.record({
  preferredAccessTimes: fc.array(fc.integer({ min: 0, max: 23 }), { maxLength: 5 }),
  avgSessionDuration: fc.double({ min: 0, max: 3600, noNaN: true }),
  categoryClickCounts: fc.dictionary(
    fc.constantFrom(...SERVICE_CATEGORIES),
    fc.integer({ min: 0, max: 1000 }),
  ),
  searchToContactRatio: fc.double({ min: 0, max: 1, noNaN: true }),
});

// Full UserProfile generator
export const userProfileArb: fc.Arbitrary<UserProfile> = fc.record({
  id: fc.uuid(),
  firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  location: geoPositionArb,
  manualAddress: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  searchHistory: fc.array(searchHistoryEntryArb, { maxLength: 10 }),
  viewedServices: fc.array(viewedServiceArb, { maxLength: 10 }),
  registeredServices: fc.array(fc.uuid(), { maxLength: 5 }),
  favoriteCategories: fc.array(serviceCategoryArb, { maxLength: 5 }),
  explicitPreferences: fc.array(explicitPreferenceArb, { maxLength: 3 }),
  inferredPreferences: fc.array(inferredPreferenceArb, { maxLength: 3 }),
  currentContext: fc.option(userSituationalContextArb, { nil: undefined }),
  promptHistory: fc.array(promptHistoryEntryArb, { maxLength: 5 }),
  ratings: fc.array(fc.uuid(), { maxLength: 10 }),
  behaviorMetrics: behaviorMetricsArb,
  embedding: fc.option(
    fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 384, maxLength: 384 }),
    { nil: undefined },
  ),
  createdAt: fc.integer({ min: 0 }),
  lastActiveAt: fc.integer({ min: 0 }),
  sessionCount: fc.integer({ min: 0, max: 10000 }),
});

