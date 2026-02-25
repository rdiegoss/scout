import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '@shared/types/user';
import type { RecommendedService } from './services/recommendationEngine';
import type { PersonalizedUIConfig, SmartInsight } from './services/personalizationEngine';
import type { SearchResult } from './pages/SearchScreen';
import type { ComplementarySuggestion, InteractionHistoryEntry } from './services/differentiationService';
import type { PreferencePrompt, UserContext } from './services/progressiveDataCollector';
import { db } from './services/database';
import { haversineDistanceKm } from './services/vectorDatabaseClient';
import { aiService } from './services/aiService';
import { CATEGORIES } from './services/categoryService';
import { PersonalizationEngine } from './services/personalizationEngine';
import { RatingService } from './services/ratingService';
import { GeolocationService } from './services/geolocation';
import { SyncService } from './services/syncService';
import { supabaseSyncExecutor } from './services/supabaseSyncExecutor';
import { DifferentiationService } from './services/differentiationService';
import { ProgressiveDataCollector } from './services/progressiveDataCollector';
import { supabase } from './services/supabaseClient';
import { confirmWhatsApp } from './services/whatsAppService';
import styles from './styles/App.module.scss';
import { OnboardingFlow } from './components/OnboardingFlow';
import { HomeScreen } from './pages/HomeScreen';
import { ServiceProfileScreen } from './pages/ServiceProfileScreen';
import { ServiceRegistrationForm } from './components/ServiceRegistrationForm';
import { AIStatusScreen } from './pages/AIStatusScreen';
import { InstallPrompt } from './components/InstallPrompt';
import { BottomNavigation } from './components/BottomNavigation';

const personalizationEngine = new PersonalizationEngine();
const ratingService = new RatingService();
const geoService = new GeolocationService();
const syncService = new SyncService(undefined, supabaseSyncExecutor);
const differentiationService = new DifferentiationService();
const progressiveCollector = new ProgressiveDataCollector();

type Screen =
  | { name: 'home' }
  | { name: 'service'; serviceId: string }
  | { name: 'register' }
  | { name: 'ai-status' };

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const [recommendations, setRecommendations] = useState<RecommendedService[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<import('@shared/types').ServiceProvider | null>(null);
  const [uiConfig, setUiConfig] = useState<PersonalizedUIConfig | null>(null);
  const [aiReady, setAiReady] = useState(false);

  const [isOnline, setIsOnline] = useState(syncService.isOnline());
  const [complementarySuggestions, setComplementarySuggestions] = useState<ComplementarySuggestion[]>([]);
  const [interactionHistory, setInteractionHistory] = useState<InteractionHistoryEntry[]>([]);
  const [smartInsight, setSmartInsight] = useState<SmartInsight | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activePrompt, setActivePrompt] = useState<PreferencePrompt | null>(null);
  const [isLearning, setIsLearning] = useState(true);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = userProfile;

  useEffect(() => {
    const pullFromCloud = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .limit(500);

        if (error || !data || data.length === 0) return;

        const now = Date.now();
        const localServices = await db.services.toArray();
        const localByName = new Map(
          localServices.map((s) => [s.name.toLowerCase().trim(), s.id]),
        );

        for (const row of data) {
          const existing = await db.services.get(row.id);
          if (existing && existing.updatedAt > now - 60_000) continue;

          const nameKey = (row.name ?? '').toLowerCase().trim();
          const localDuplicateId = localByName.get(nameKey);
          if (localDuplicateId && localDuplicateId !== row.id) {
            await db.services.delete(localDuplicateId);
            localByName.set(nameKey, row.id);
          }

          await db.services.put({
            id: row.id,
            name: row.name ?? '',
            description: row.description ?? '',
            category: row.category ?? 'outros',
            subcategory: row.subcategory,
            phone: row.phone ?? '',
            hasWhatsApp: row.has_whatsapp ?? false,
            whatsAppConfirmed: row.whatsapp_confirmed ?? false,
            address: row.address ?? '',
            location: {
              latitude: row.latitude ?? 0,
              longitude: row.longitude ?? 0,
              accuracy: 0,
              timestamp: now,
            },
            averageRating: row.average_rating ?? 0,
            totalRatings: row.total_ratings ?? 0,
            recentRatings: existing?.recentRatings ?? [],
            registeredBy: row.registered_by ?? 'system',
            neighborhoodScore: row.neighborhood_score ?? 0,
            dataSource: row.data_source ?? 'manual',
            verifiedByUsers: row.verified_by_users ?? 0,
            embedding: existing?.embedding,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            isActive: row.is_active ?? true,
          });
        }

        console.log(`[App] Pulled ${data.length} services from Supabase`);
        aiService.indexServices().catch(() => {});
      } catch {
      }
    };
    pullFromCloud();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profiles = await db.userProfile.toArray();
        if (profiles.length > 0) {
          setUserProfile(profiles[0]);
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      } catch {
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initAI = async () => {
      try {
        await aiService.initialize();
        await aiService.indexServices();
        if (!cancelled) {
          setAiReady(true);
          console.log('[App] AI service ready');
        }
      } catch (err) {
        console.warn('[App] AI init failed, using fallback ranking:', err);
        if (!cancelled) setAiReady(false);
      }
    };
    initAI();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;
    const updateLocation = async () => {
      try {
        const pos = await geoService.getCurrentPositionWithFallback();
        if (!cancelled && pos) {
          const updated = { ...userProfile, location: pos, lastActiveAt: Date.now() };
          await db.userProfile.update(userProfile.id, { location: pos, lastActiveAt: Date.now() });
          setUserProfile(updated);
        }
      } catch {
      }
    };
    updateLocation();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  useEffect(() => {
    if (!userProfile) return;
    try {
      const config = personalizationEngine.generateUIConfig(userProfile);
      setUiConfig(config);
      const insight = personalizationEngine.generateSmartInsight(userProfile);
      setSmartInsight(insight);
    } catch {
    }
  }, [userProfile]);

  useEffect(() => {
    db.searchHistory
      .orderBy('timestamp')
      .reverse()
      .limit(10)
      .toArray()
      .then((entries) => setRecentSearches(entries.map((e) => e.query)))
      .catch(() => {});
  }, [userProfile]);

  useEffect(() => {
    const handleOnline = () => {
      syncService.setOnline(true);
      setIsOnline(true);
      syncService.syncPendingData().catch(() => {});
    };
    const handleOffline = () => { syncService.setOnline(false); setIsOnline(false); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    syncService.onConnectivityChange((online) => setIsOnline(online));
    syncService.syncPendingData().catch(() => {});
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    const count = (userProfile.searchHistory?.length ?? 0) +
      (userProfile.viewedServices?.length ?? 0) +
      (userProfile.ratings?.length ?? 0);
    setIsLearning(count < 5);

    if (progressiveCollector.canAskInSession(userProfile)) {
      const ctx: UserContext = {
        searchCount: userProfile.searchHistory?.length ?? 0,
        viewDuration: 0,
        sessionNumber: userProfile.sessionCount ?? 1,
        lastPromptDate: userProfile.promptHistory?.slice(-1)[0]?.shownAt,
        recentSearches: userProfile.searchHistory?.slice(-5).map(s => s.query) ?? [],
      };
      const prompt = progressiveCollector.generateContextualPrompt(userProfile, ctx);
      setActivePrompt(prompt);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;

    const loadRecommendations = async () => {
      try {
        let recs: RecommendedService[] = [];

        if (aiReady) {
          const loc = userProfile.location;
          const aiRecs = await aiService.getRecommendations(userProfile, loc, 10);
          if (aiRecs.length > 0) {
            recs = aiRecs;
            console.log(`[App] Loaded ${aiRecs.length} AI recommendations`);
          }
        }

        if (recs.length === 0) {
          const allServices = await db.services.filter((s) => s.isActive && !!s.name && s.name.trim().length > 0).toArray();
          if (allServices.length === 0) {
            setRecommendations([]);
            return;
          }

          const loc = userProfile.location;
          const hasLocation = loc.latitude !== 0 || loc.longitude !== 0;

          recs = allServices.map((service) => {
            const distanceKm = hasLocation
              ? haversineDistanceKm(loc.latitude, loc.longitude, service.location.latitude, service.location.longitude)
              : 0;

            const matchReasons: string[] = [];
            if (service.averageRating >= 4) matchReasons.push(t('recommendation.wellRated'));
            if (hasLocation && distanceKm <= 5) matchReasons.push(t('recommendation.nearby'));

            const proximityBonus = hasLocation ? Math.max(0, 1 - distanceKm / 50) * 0.3 : 0;
            return { service, relevanceScore: service.averageRating + proximityBonus, distanceKm, matchReasons };
          });
          recs.sort((a, b) => b.relevanceScore - a.relevanceScore);
          recs = recs.slice(0, 10);
        }

        try {
          const scoreMap = new Map(recs.map(r => [r.service.id, r.relevanceScore]));
          const boosted = differentiationService.applyCommunityBoost(
            recs.map(r => r.service),
            scoreMap,
          );
          const boostedWithNeighbor = await differentiationService.markNeighborRecommended(boosted);

          const boostedMap = new Map(boostedWithNeighbor.map(b => [b.id, b]));
          recs = recs.map(rec => {
            const b = boostedMap.get(rec.service.id);
            if (b) {
              const reasons = [...rec.matchReasons];
              if (b.isNeighborRecommended) reasons.push(t('recommendation.neighborRecommended'));
              return { ...rec, service: b, relevanceScore: b.boostedScore, matchReasons: reasons };
            }
            return rec;
          });
          recs.sort((a, b) => b.relevanceScore - a.relevanceScore);
        } catch {
        }

        setRecommendations(recs);
      } catch {
        setRecommendations([]);
      }
    };

    loadRecommendations();
  }, [userProfile, aiReady, t]);

  const goHome = useCallback(() => {
    setScreen({ name: 'home' });
    setComplementarySuggestions([]);
  }, []);
  const goService = useCallback(
    (serviceId: string) => {
      db.services.get(serviceId).then(async (svc) => {
        setSelectedService(svc ?? null);
        setScreen({ name: 'service', serviceId });
        if (svc && userProfile) {
          differentiationService.recordInteraction(userProfile.id, serviceId, 'view').catch(() => {});
          personalizationEngine.recordInteraction(userProfile.id, {
            type: 'view',
            serviceId,
            category: svc.category,
            timestamp: Date.now(),
          }).catch(() => {});
          differentiationService
            .suggestComplementaryServices(svc, userProfile.location, 5)
            .then(setComplementarySuggestions)
            .catch(() => setComplementarySuggestions([]));
          differentiationService
            .getInteractionHistory(userProfile.id, 20)
            .then(setInteractionHistory)
            .catch(() => setInteractionHistory([]));
        }
      });
    },
    [userProfile],
  );
  const goRegister = useCallback(() => setScreen({ name: 'register' }), []);
  const goAiStatus = useCallback(() => setScreen({ name: 'ai-status' }), []);

  const handleOnboardingComplete = useCallback(async (name: string) => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      firstName: name,
      location: { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() },
      searchHistory: [],
      viewedServices: [],
      registeredServices: [],
      favoriteCategories: [],
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
    };

    try {
      const pos = await geoService.getCurrentPositionWithFallback();
      if (pos) profile.location = pos;
    } catch {
    }

    await db.userProfile.put(profile);
    setUserProfile(profile);
    setShowOnboarding(false);
    progressiveCollector.resetSession();

    syncService.queueOperation({
      id: profile.id,
      type: 'create',
      entity: 'profile',
      data: profile,
      timestamp: Date.now(),
      retryCount: 0,
    }).catch(() => {});
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      if (userProfile) {
        personalizationEngine.recordInteraction(userProfile.id, {
          type: 'search',
          searchQuery: query,
          timestamp: Date.now(),
        }).catch(() => {});
        db.searchHistory.add({ query, timestamp: Date.now(), resultsCount: 0 } as never)
          .then(() => db.searchHistory.orderBy('timestamp').reverse().limit(10).toArray())
          .then((entries) => setRecentSearches(entries.map((e) => e.query)))
          .catch(() => {});
      }

      const sitResult = await differentiationService.searchBySituationalContext(
        query,
        userProfile?.location,
        10,
      );
      if (sitResult && sitResult.services.length > 0) {
        setSearchResults(sitResult.services.map(s => ({ service: s, similarity: 1, distanceKm: 0 })));
        console.log(`[App] Situational search matched: ${sitResult.context.label}`);
        return;
      }

      let aiResults: SearchResult[] = [];
      if (aiReady) {
        const loc = userProfile?.location;
        aiResults = await aiService.semanticSearch(query, 20, {
          userLatitude: loc?.latitude,
          userLongitude: loc?.longitude,
        });
        if (aiResults.length > 0) {
          console.log(`[App] Semantic search returned ${aiResults.length} results`);
        }
      }

      const allServices = await db.services.filter((s) => s.isActive).toArray();
      const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const aiIds = new Set(aiResults.map((r) => r.service.id));
      const textResults = allServices
        .filter((s) => !aiIds.has(s.id))
        .map((service) => {
          const name = service.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const desc = service.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const cat = service.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const subcat = (service.subcategory ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          let score = 0;
          if (name.includes(q)) score = 1.0;
          else if (subcat.includes(q)) score = 0.8;
          else if (cat.includes(q)) score = 0.7;
          else if (desc.includes(q)) score = 0.6;

          return { service, similarity: score, distanceKm: 0 };
        })
        .filter((r) => r.similarity > 0);

      const seen = new Map<string, SearchResult>();
      for (const r of [...aiResults, ...textResults]) {
        const key = r.service.name.toLowerCase().trim();
        if (!seen.has(key) || r.similarity > seen.get(key)!.similarity) {
          seen.set(key, r);
        }
      }
      const merged = Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);
      setSearchResults(merged);
    } finally {
      setSearchLoading(false);
    }
  }, [aiReady, userProfile]);

  const handleSubmitRating = useCallback(
    async (score: number, comment?: string) => {
      if (!selectedService || !userProfile) return;

      const result = await ratingService.submitRating({
        serviceId: selectedService.id,
        userId: userProfile.id,
        score,
        comment,
        userLocation: userProfile.location,
        isNeighbor: differentiationService.isNeighborRating(
          userProfile.location,
          selectedService.location,
        ),
      });

      setSelectedService(prev => prev ? {
        ...prev,
        averageRating: result.newAverageRating,
        totalRatings: result.newTotalRatings,
      } : null);

      differentiationService.recordInteraction(userProfile.id, selectedService.id, 'rating').catch(() => {});
      personalizationEngine.recordInteraction(userProfile.id, {
        type: 'rating',
        serviceId: selectedService.id,
        category: selectedService.category,
        timestamp: Date.now(),
      }).catch(() => {});

      syncService.queueOperation({
        id: result.rating.id,
        type: 'create',
        entity: 'rating',
        data: result.rating,
        timestamp: Date.now(),
        retryCount: 0,
      }).catch(() => {});
    },
    [selectedService, userProfile],
  );

  const handleWhatsAppConfirm = useCallback(async (serviceId: string) => {
    await confirmWhatsApp(serviceId);
    const updated = await db.services.get(serviceId);
    if (updated) setSelectedService(updated);
    if (userProfile) {
      differentiationService.recordInteraction(userProfile.id, serviceId, 'contact').catch(() => {});
    }
  }, [userProfile]);

  const handlePromptDismiss = useCallback(async () => {
    if (activePrompt && userProfile) {
      await progressiveCollector.markPromptAsShown(userProfile.id, activePrompt.id, activePrompt.type);
    }
    setActivePrompt(null);
  }, [activePrompt, userProfile]);

  const handleQuickInterestTap = useCallback(async (category: import('@shared/types').ServiceCategory) => {
    if (!userProfile) return;
    personalizationEngine.recordInteraction(userProfile.id, {
      type: 'view',
      category,
      timestamp: Date.now(),
    }).catch(() => {});
    const updated: import('@shared/types/user').UserProfile = {
      ...userProfile,
      favoriteCategories: userProfile.favoriteCategories.includes(category)
        ? userProfile.favoriteCategories.filter((c) => c !== category)
        : [...userProfile.favoriteCategories, category],
      lastActiveAt: Date.now(),
    };
    await db.userProfile.update(userProfile.id, {
      favoriteCategories: updated.favoriteCategories,
      lastActiveAt: updated.lastActiveAt,
    });
    setUserProfile(updated);
  }, [userProfile]);

  if (loading) {
    return (
      <div className={`animate-fade-in ${styles.loadingContainer}`}>
        <p className={styles.loadingText}>{t('common.loading')}</p>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className={styles.appContainer}>
      <BottomNavigation activeScreen={screen.name} onHome={goHome} onRegister={goRegister} onAiStatus={goAiStatus} />

      <div key={screen.name} className={`page-enter ${styles.screenContent}`}>
        {screen.name === 'home' && (
          <HomeScreen
            userProfile={userProfile}
            uiConfig={uiConfig}
            recommendations={recommendations}
            searchResults={searchResults}
            searchLoading={searchLoading}
            categories={CATEGORIES}
            loading={false}
            aiReady={aiReady}
            isOnline={isOnline}
            isLearning={isLearning}
            activePrompt={activePrompt}
            interactionHistory={interactionHistory}
            smartInsight={smartInsight}
            recentSearches={recentSearches}
            onSearch={handleSearch}
            onClearSearch={() => setSearchResults([])}
            onServiceSelect={goService}
            onPromptDismiss={handlePromptDismiss}
            onQuickInterestTap={handleQuickInterestTap}
          />
        )}

        {screen.name === 'service' && (
          <ServiceProfileScreen
            service={selectedService}
            loading={false}
            complementarySuggestions={complementarySuggestions}
            onBack={goHome}
            onSubmitRating={handleSubmitRating}
            onWhatsAppConfirm={handleWhatsAppConfirm}
            onServiceSelect={goService}
          />
        )}

        {screen.name === 'ai-status' && <AIStatusScreen />}

        {screen.name === 'register' && (
          <ServiceRegistrationForm
            onBack={goHome}
            registeredBy={userProfile?.id}
            onSuccess={(serviceId) => {
              db.services.get(serviceId).then((svc) => {
                if (svc) {
                  aiService.indexSingleService(svc);
                  syncService.queueOperation({
                    id: serviceId,
                    type: 'create',
                    entity: 'service',
                    data: svc,
                    timestamp: Date.now(),
                    retryCount: 0,
                  }).catch(() => {});
                  if (userProfile) {
                    personalizationEngine.recordInteraction(userProfile.id, {
                      type: 'register',
                      serviceId,
                      category: svc.category,
                      timestamp: Date.now(),
                    }).catch(() => {});
                  }
                }
              });
              goService(serviceId);
            }}
          />
        )}
      </div>

      <InstallPrompt />
    </div>
  );
};
