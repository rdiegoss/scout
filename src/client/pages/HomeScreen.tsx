import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceCategory, CategoryDefinition } from '@shared/types';
import type { UserProfile } from '@shared/types/user';
import type { RecommendedService } from '@client/services/recommendationEngine';
import type { PersonalizedUIConfig, SmartInsight } from '@client/services/personalizationEngine';
import type { InteractionHistoryEntry } from '@client/services/differentiationService';
import type { PreferencePrompt } from '@client/services/progressiveDataCollector';
import type { SearchResult } from './SearchScreen';
import { SkeletonLoader } from '@client/components/SkeletonLoader';
import { HomeHeader } from '@client/components/home/HomeHeader';
import { SearchBar } from '@client/components/home/SearchBar';
import { RecentSearchChips } from '@client/components/home/RecentSearchChips';
import { AIInsightCard } from '@client/components/home/AIInsightCard';
import { ProgressivePromptCard } from '@client/components/home/ProgressivePromptCard';
import { QuickInterestBubbles } from '@client/components/home/QuickInterestBubbles';
import { SearchResultsList } from '@client/components/home/SearchResultsList';
import { ForYouSection } from '@client/components/home/ForYouSection';
import { TrendingSection } from '@client/components/home/TrendingSection';
import { CategoryChips } from '@client/components/home/CategoryChips';
import styles from '@client/styles/HomeScreen.module.scss';

export interface HomeScreenProps {
  userProfile: UserProfile | null;
  uiConfig: PersonalizedUIConfig | null;
  recommendations: RecommendedService[];
  searchResults: SearchResult[];
  searchLoading: boolean;
  categories: CategoryDefinition[];
  loading: boolean;
  aiReady: boolean;
  isOnline?: boolean;
  isLearning?: boolean;
  activePrompt?: PreferencePrompt | null;
  interactionHistory?: InteractionHistoryEntry[];
  smartInsight?: SmartInsight | null;
  recentSearches?: string[];
  onSearch: (query: string) => Promise<void>;
  onClearSearch?: () => void;
  onServiceSelect: (serviceId: string) => void;
  onPromptDismiss?: () => void;
  onQuickInterestTap?: (category: ServiceCategory) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userProfile,
  uiConfig,
  recommendations,
  searchResults,
  searchLoading,
  categories,
  loading,
  isOnline,
  isLearning,
  activePrompt,
  smartInsight,
  recentSearches,
  onSearch,
  onClearSearch,
  onServiceSelect,
  onPromptDismiss,
  onQuickInterestTap,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | null>(null);

  const isSearching = query.trim().length > 0;
  const isNewUser = smartInsight?.isNewUser ?? false;

  const greeting =
    uiConfig?.greeting ??
    (userProfile?.firstName
      ? t('home.greetingWithName', { name: userProfile.firstName })
      : t('home.defaultGreeting'));

  const viewedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of userProfile?.viewedServices ?? []) ids.add(v.serviceId);
    return ids;
  }, [userProfile]);

  const { forYou, trending } = useMemo(() => {
    let filtered = recommendations.filter(
      (r) => r.service.name && r.service.name.trim().length > 0,
    );
    if (activeCategory) {
      filtered = filtered.filter((r) => r.service.category === activeCategory);
    }
    const forYou = filtered.slice(0, 6);
    const forYouIds = new Set(forYou.map((r) => r.service.id));
    const trending = [...filtered]
      .filter(
        (r) =>
          !forYouIds.has(r.service.id) &&
          r.service.averageRating > 0 &&
          r.service.totalRatings > 0,
      )
      .sort((a, b) => b.service.averageRating - a.service.averageRating)
      .slice(0, 6);
    return { forYou, trending };
  }, [recommendations, activeCategory]);

  const filteredSearchResults = useMemo(() => {
    if (!activeCategory) return searchResults;
    return searchResults.filter((r) => r.service.category === activeCategory);
  }, [searchResults, activeCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length > 0) onSearch(trimmed);
  };

  const handleClearSearch = () => {
    setQuery('');
    onClearSearch?.();
  };

  const handleRecentSearchTap = (q: string) => {
    setQuery(q);
    onSearch(q);
  };

  const handleCategoryToggle = (catId: ServiceCategory) => {
    setActiveCategory((prev) => (prev === catId ? null : catId));
  };

  return (
    <main className={styles.main}>
      <HomeHeader
        greeting={greeting}
        showSubtitle={!!(userProfile && !loading)}
        isLearning={isLearning}
        isOnline={isOnline}
      />

      <SearchBar
        query={query}
        loading={searchLoading}
        onQueryChange={setQuery}
        onSubmit={handleSubmit}
      />

      {!isSearching && (
        <RecentSearchChips recentSearches={recentSearches ?? []} onTap={handleRecentSearchTap} />
      )}

      {!isSearching && smartInsight && <AIInsightCard insight={smartInsight} />}

      {activePrompt && onPromptDismiss && (
        <ProgressivePromptCard prompt={activePrompt} onDismiss={onPromptDismiss} />
      )}

      {!isSearching && isNewUser && onQuickInterestTap && (
        <QuickInterestBubbles categories={categories} onTap={onQuickInterestTap} />
      )}

      {loading || searchLoading ? (
        <SkeletonLoader count={3} height="100px" />
      ) : isSearching ? (
        <SearchResultsList
          results={filteredSearchResults}
          onClear={handleClearSearch}
          onServiceSelect={onServiceSelect}
        />
      ) : (
        <>
          <ForYouSection
            recommendations={forYou}
            isNewUser={isNewUser}
            viewedServiceIds={viewedIds}
            onServiceSelect={onServiceSelect}
          />

          <TrendingSection recommendations={trending} onServiceSelect={onServiceSelect} />

          {forYou.length === 0 && trending.length === 0 && (
            <p className={styles.emptyState}>
              {activeCategory ? t('home.noCategoryResults') : t('home.noRecommendations')}
            </p>
          )}

          <CategoryChips
            categories={categories}
            activeCategory={activeCategory}
            highlightCategories={uiConfig?.highlightCategories as import('@shared/types').ServiceCategory[] | undefined}
            onToggle={handleCategoryToggle}
          />
        </>
      )}
    </main>
  );
};
