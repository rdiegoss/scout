/**
 * Property 19: Persistência de Perfil e Histórico (Round-Trip)
 *
 * Para qualquer UserProfile salvo no IndexedDB, incluindo histórico de buscas,
 * uma recuperação posterior deve retornar dados equivalentes. Adicionalmente,
 * após cada busca realizada, o termo deve aparecer no histórico local.
 *
 * **Validates: Requirements 9.1, 9.2**
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import Dexie from 'dexie';
import type { UserProfile, SearchHistoryEntry } from '@shared/types/user';
import {
  propertyTestConfig,
  userProfileArb,
  searchHistoryEntryArb,
} from './generators';

/**
 * Minimal Dexie database for testing profile persistence.
 * This mirrors the schema defined in the design document (IndexedDB Schema section).
 * The actual implementation will be created in Task 2.3.
 */
class TestAppDatabase extends Dexie {
  userProfile!: Dexie.Table<UserProfile, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      userProfile: 'id',
    });
  }
}

/** Deep-compare helper that handles undefined vs missing keys from IndexedDB round-trip */
function normalizeForComparison(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj));
}

describe('Property 19: Persistência de Perfil e Histórico (Round-Trip)', () => {
  let db: TestAppDatabase;

  beforeEach(async () => {
    // Create a fresh database for each test to avoid cross-contamination
    const dbName = `test-db-${Date.now()}-${Math.random()}`;
    db = new TestAppDatabase(dbName);
  });

  // **Validates: Requirements 9.1**
  it('should persist and retrieve any UserProfile with equivalent data (round-trip)', () => {
    fc.assert(
      fc.asyncProperty(userProfileArb, async (profile) => {
        // Save profile to IndexedDB
        await db.userProfile.put(profile);

        // Retrieve profile from IndexedDB
        const retrieved = await db.userProfile.get(profile.id);

        expect(retrieved).toBeDefined();
        // Normalize both to handle undefined vs missing key differences in IndexedDB
        expect(normalizeForComparison(retrieved)).toEqual(
          normalizeForComparison(profile),
        );
      }),
      propertyTestConfig,
    );
  });

  // **Validates: Requirements 9.1, 9.2**
  it('should preserve search history entries after adding them to a saved profile', () => {
    fc.assert(
      fc.asyncProperty(
        userProfileArb,
        searchHistoryEntryArb,
        async (profile, newEntry) => {
          // Save initial profile
          await db.userProfile.put(profile);

          // Simulate a search: add the new entry to the profile's search history
          const updatedHistory = [...profile.searchHistory, newEntry];
          await db.userProfile.update(profile.id, {
            searchHistory: updatedHistory,
          });

          // Retrieve and verify
          const retrieved = await db.userProfile.get(profile.id);
          expect(retrieved).toBeDefined();

          // The new search term must appear in the history
          const historyQueries = retrieved!.searchHistory.map(
            (e: SearchHistoryEntry) => e.query,
          );
          expect(historyQueries).toContain(newEntry.query);

          // History length should be original + 1
          expect(retrieved!.searchHistory).toHaveLength(
            profile.searchHistory.length + 1,
          );

          // The last entry should match the new entry
          const lastEntry =
            retrieved!.searchHistory[retrieved!.searchHistory.length - 1];
          expect(normalizeForComparison(lastEntry)).toEqual(
            normalizeForComparison(newEntry),
          );
        },
      ),
      propertyTestConfig,
    );
  });

  // **Validates: Requirements 9.1**
  it('should preserve all nested objects including embedding arrays on round-trip', () => {
    // Use a profile generator that always includes an embedding to stress-test nested data
    const profileWithEmbeddingArb = userProfileArb.map((profile) => ({
      ...profile,
      embedding: new Array(384).fill(0).map((_, i) => Math.sin(i) * 0.5),
    }));

    fc.assert(
      fc.asyncProperty(profileWithEmbeddingArb, async (profile) => {
        await db.userProfile.put(profile);
        const retrieved = await db.userProfile.get(profile.id);

        expect(retrieved).toBeDefined();
        expect(retrieved!.embedding).toBeDefined();
        expect(retrieved!.embedding).toHaveLength(384);

        // Verify all nested structures survived the round-trip
        expect(normalizeForComparison(retrieved!.searchHistory)).toEqual(
          normalizeForComparison(profile.searchHistory),
        );
        expect(normalizeForComparison(retrieved!.viewedServices)).toEqual(
          normalizeForComparison(profile.viewedServices),
        );
        expect(normalizeForComparison(retrieved!.behaviorMetrics)).toEqual(
          normalizeForComparison(profile.behaviorMetrics),
        );
        expect(normalizeForComparison(retrieved!.explicitPreferences)).toEqual(
          normalizeForComparison(profile.explicitPreferences),
        );
        expect(normalizeForComparison(retrieved!.inferredPreferences)).toEqual(
          normalizeForComparison(profile.inferredPreferences),
        );
      }),
      propertyTestConfig,
    );
  });
});
