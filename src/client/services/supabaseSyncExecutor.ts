import type { SyncQueueItem, ServiceProvider, Rating } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import { supabase, type DbService, type DbRating, type DbUser } from './supabaseClient';
import type { SyncExecutor } from './syncService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mapServiceToDb(data: ServiceProvider): DbService {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    subcategory: data.subcategory,
    phone: data.phone,
    has_whatsapp: data.hasWhatsApp,
    whatsapp_confirmed: data.whatsAppConfirmed,
    address: data.address,
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    service_radius: data.serviceRadius,
    average_rating: data.averageRating,
    total_ratings: data.totalRatings,
    registered_by: data.registeredBy || undefined,
    neighborhood_score: data.neighborhoodScore,
    data_source: data.dataSource,
    source_id: data.sourceId,
    source_url: data.sourceUrl,
    imported_at: data.importedAt ? new Date(data.importedAt).toISOString() : undefined,
    verified_by_users: data.verifiedByUsers,
    is_active: data.isActive,
  };
}

function mapRatingToDb(data: Rating): DbRating {
  return {
    id: data.id,
    service_id: data.serviceId,
    user_id: data.userId || undefined,
    score: data.score,
    comment: data.comment,
    user_latitude: data.userLocation?.latitude,
    user_longitude: data.userLocation?.longitude,
    is_neighbor: data.isNeighbor,
    helpful: data.helpful ?? 0,
  };
}

function mapProfileToDb(data: UserProfile): DbUser {
  return {
    id: data.id,
    first_name: data.firstName,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
    accuracy: data.location?.accuracy,
    favorite_categories: data.favoriteCategories,
    session_count: data.sessionCount,
  };
}

async function ensureUserExists(userId: string | undefined): Promise<void> {
  if (!userId || !isValidUuid(userId)) return;

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (data) return;

  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, first_name: '' }, { onConflict: 'id' });

  if (error) {
    console.warn(`[sync] ensureUserExists(${userId}) failed:`, error.message);
  }
}

async function syncService(item: SyncQueueItem): Promise<void> {
  const data = item.data as ServiceProvider;

  if (data.registeredBy) await ensureUserExists(data.registeredBy);

  switch (item.operation) {
    case 'create': {
      const row = mapServiceToDb(data);
      const { error } = await supabase.from('services').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(`Supabase services upsert failed: ${error.message}`);
      break;
    }
    case 'update': {
      const row = mapServiceToDb(data);
      const { error } = await supabase.from('services').update(row).eq('id', item.entityId);
      if (error) throw new Error(`Supabase services update failed: ${error.message}`);
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('services').update({ is_active: false }).eq('id', item.entityId);
      if (error) throw new Error(`Supabase services soft-delete failed: ${error.message}`);
      break;
    }
  }
}

async function syncRating(item: SyncQueueItem): Promise<void> {
  const data = item.data as Rating;

  if (data.userId) await ensureUserExists(data.userId);

  switch (item.operation) {
    case 'create': {
      const row = mapRatingToDb(data);
      const { error } = await supabase.from('ratings').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(`Supabase ratings upsert failed: ${error.message}`);

      await recalculateServiceRating(data.serviceId);
      break;
    }
    case 'update': {
      const row = mapRatingToDb(data);
      const { error } = await supabase.from('ratings').update(row).eq('id', item.entityId);
      if (error) throw new Error(`Supabase ratings update failed: ${error.message}`);
      await recalculateServiceRating(data.serviceId);
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('ratings').delete().eq('id', item.entityId);
      if (error) throw new Error(`Supabase ratings delete failed: ${error.message}`);
      break;
    }
  }
}

async function syncProfile(item: SyncQueueItem): Promise<void> {
  const data = item.data as UserProfile;

  switch (item.operation) {
    case 'create':
    case 'update': {
      const row = mapProfileToDb(data);
      const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(`Supabase users upsert failed: ${error.message}`);
      break;
    }
    case 'delete': {
      const { error } = await supabase.from('users').delete().eq('id', item.entityId);
      if (error) throw new Error(`Supabase users delete failed: ${error.message}`);
      break;
    }
  }
}

async function recalculateServiceRating(serviceId: string): Promise<void> {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('score')
    .eq('service_id', serviceId);

  if (error || !ratings) return;

  const total = ratings.length;
  const avg = total > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / total : 0;

  await supabase
    .from('services')
    .update({ average_rating: Math.round(avg * 10) / 10, total_ratings: total })
    .eq('id', serviceId);
}

export const supabaseSyncExecutor: SyncExecutor = async (item: SyncQueueItem): Promise<void> => {
  if (!isValidUuid(item.entityId)) {
    throw new Error(
      `Skipping sync: non-UUID entityId "${item.entityId}".`,
    );
  }

  const dataObj = item.data as Record<string, unknown> | undefined;
  if (dataObj && typeof dataObj === 'object') {
    const refId = (dataObj as { serviceId?: string }).serviceId;
    if (typeof refId === 'string' && !isValidUuid(refId)) {
      throw new Error(
        `Skipping sync: non-UUID serviceId "${refId}" in ${item.entityType} payload.`,
      );
    }
  }

  switch (item.entityType) {
    case 'service':
      return syncService(item);
    case 'rating':
      return syncRating(item);
    case 'profile':
      return syncProfile(item);
    default:
      throw new Error(`Unknown entity type: ${item.entityType}`);
  }
};
