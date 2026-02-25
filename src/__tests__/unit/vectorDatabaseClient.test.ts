/**
 * Unit tests for VectorDatabaseClient (SupabaseVectorClient).
 *
 * Uses a mock Supabase client to verify correct query construction,
 * filter application, and error handling without requiring a live database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupabaseVectorClient,
  haversineDistanceKm,
  type ServiceMetadata,
  type SearchFilters,
} from '@client/services/vectorDatabaseClient';

// ── Mock Supabase client builder ─────────────────────────────────────────────

function createMockSupabase() {
  const rpcMock = vi.fn();
  const deleteMock = vi.fn();
  const eqMock = vi.fn();
  const upsertMock = vi.fn();
  const fromMock = vi.fn();

  // Chain: supabase.from('...').delete().eq(...)
  eqMock.mockResolvedValue({ error: null });
  deleteMock.mockReturnValue({ eq: eqMock });
  upsertMock.mockResolvedValue({ error: null });

  fromMock.mockReturnValue({
    upsert: upsertMock,
    delete: deleteMock,
  });

  const client = {
    rpc: rpcMock,
    from: fromMock,
  } as any;

  return { client, rpcMock, fromMock, upsertMock, deleteMock, eqMock };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('haversineDistanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceKm(0, 0, 0, 0)).toBe(0);
  });

  it('calculates approximate distance between São Paulo and Rio de Janeiro', () => {
    // SP: -23.5505, -46.6333 | RJ: -22.9068, -43.1729
    const dist = haversineDistanceKm(-23.5505, -46.6333, -22.9068, -43.1729);
    // ~360 km
    expect(dist).toBeGreaterThan(340);
    expect(dist).toBeLessThan(380);
  });
});

describe('SupabaseVectorClient', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let client: SupabaseVectorClient;

  beforeEach(() => {
    mock = createMockSupabase();
    client = new SupabaseVectorClient(mock.client);
  });

  // ── searchSimilar ────────────────────────────────────────────────────────

  describe('searchSimilar', () => {
    it('calls RPC with correct parameters and returns mapped results', async () => {
      const embedding = Array(384).fill(0.1);
      const rpcResult = [
        {
          service_id: 'svc-1',
          similarity: 0.95,
          metadata: { category: 'automotivo', name: 'Mecânico João' },
        },
        {
          service_id: 'svc-2',
          similarity: 0.82,
          metadata: { category: 'construcao' },
        },
      ];
      mock.rpcMock.mockResolvedValue({ data: rpcResult, error: null });

      const results = await client.searchSimilar(embedding, 10);

      expect(mock.rpcMock).toHaveBeenCalledWith('match_service_embeddings', {
        query_embedding: JSON.stringify(embedding),
        match_count: 10,
        filter_category: null,
        filter_min_rating: null,
        filter_has_whatsapp: null,
      });
      expect(results).toHaveLength(2);
      expect(results[0].serviceId).toBe('svc-1');
      expect(results[0].similarity).toBe(0.95);
      expect(results[1].serviceId).toBe('svc-2');
    });

    it('passes filters to the RPC call', async () => {
      mock.rpcMock.mockResolvedValue({ data: [], error: null });

      const filters: SearchFilters = {
        category: 'automotivo',
        minRating: 4.0,
        hasWhatsApp: true,
      };
      await client.searchSimilar(Array(384).fill(0), 5, filters);

      expect(mock.rpcMock).toHaveBeenCalledWith('match_service_embeddings', {
        query_embedding: expect.any(String),
        match_count: 5,
        filter_category: 'automotivo',
        filter_min_rating: 4.0,
        filter_has_whatsapp: true,
      });
    });

    it('applies client-side distance filter when maxDistanceKm is set', async () => {
      const rpcResult = [
        {
          service_id: 'near',
          similarity: 0.9,
          metadata: { latitude: -23.55, longitude: -46.63 },
        },
        {
          service_id: 'far',
          similarity: 0.85,
          metadata: { latitude: -22.9, longitude: -43.17 },
        },
        {
          service_id: 'no-location',
          similarity: 0.8,
          metadata: {},
        },
      ];
      mock.rpcMock.mockResolvedValue({ data: rpcResult, error: null });

      const filters: SearchFilters = {
        maxDistanceKm: 50,
        userLatitude: -23.5505,
        userLongitude: -46.6333,
      };
      const results = await client.searchSimilar(Array(384).fill(0), 10, filters);

      // 'near' is ~5km away → included
      // 'far' is ~360km away → excluded
      // 'no-location' has no coords → included (kept by default)
      expect(results.map((r) => r.serviceId)).toEqual(['near', 'no-location']);
    });

    it('returns empty array when RPC returns null data', async () => {
      mock.rpcMock.mockResolvedValue({ data: null, error: null });
      const results = await client.searchSimilar(Array(384).fill(0), 10);
      expect(results).toEqual([]);
    });

    it('throws on RPC error', async () => {
      mock.rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(
        client.searchSimilar(Array(384).fill(0), 10),
      ).rejects.toThrow('Vector search failed: connection refused');
    });

    it('handles null metadata gracefully', async () => {
      mock.rpcMock.mockResolvedValue({
        data: [{ service_id: 'svc-1', similarity: 0.7, metadata: null }],
        error: null,
      });

      const results = await client.searchSimilar(Array(384).fill(0), 5);
      expect(results[0].metadata).toEqual({});
    });
  });

  // ── upsertServiceEmbedding ───────────────────────────────────────────────

  describe('upsertServiceEmbedding', () => {
    it('calls upsert with correct payload and conflict target', async () => {
      const embedding = Array(384).fill(0.5);
      const metadata: ServiceMetadata = {
        category: 'automotivo',
        rating: 4.5,
        hasWhatsApp: true,
      };

      await client.upsertServiceEmbedding('svc-123', embedding, metadata);

      expect(mock.fromMock).toHaveBeenCalledWith('service_embeddings');
      expect(mock.upsertMock).toHaveBeenCalledWith(
        {
          service_id: 'svc-123',
          embedding: JSON.stringify(embedding),
          metadata,
        },
        { onConflict: 'service_id' },
      );
    });

    it('throws on upsert error', async () => {
      mock.upsertMock.mockResolvedValue({
        error: { message: 'duplicate key' },
      });

      await expect(
        client.upsertServiceEmbedding('svc-1', [], {}),
      ).rejects.toThrow('Upsert embedding failed: duplicate key');
    });
  });

  // ── deleteServiceEmbedding ───────────────────────────────────────────────

  describe('deleteServiceEmbedding', () => {
    it('calls delete with correct service_id filter', async () => {
      await client.deleteServiceEmbedding('svc-456');

      expect(mock.fromMock).toHaveBeenCalledWith('service_embeddings');
      expect(mock.eqMock).toHaveBeenCalledWith('service_id', 'svc-456');
    });

    it('throws on delete error', async () => {
      mock.eqMock.mockResolvedValue({
        error: { message: 'not found' },
      });

      await expect(
        client.deleteServiceEmbedding('svc-999'),
      ).rejects.toThrow('Delete embedding failed: not found');
    });
  });
});
