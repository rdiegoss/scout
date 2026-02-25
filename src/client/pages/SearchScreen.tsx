import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceProvider } from '@shared/types';
import { SkeletonLoader } from '@client/components/SkeletonLoader';
import styles from '@client/styles/SearchScreen.module.scss';

export interface SearchResult {
  service: ServiceProvider;
  similarity: number;
  distanceKm: number;
}

export interface SearchScreenProps {
  onSearch: (query: string) => Promise<void>;
  results: SearchResult[];
  loading: boolean;
  onServiceSelect: (serviceId: string) => void;
  onBack: () => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onSearch,
  results,
  loading,
  onServiceSelect,
  onBack,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      onSearch(trimmed);
    }
  };

  return (
    <main className={styles.main}>
      <header className={`animate-slide-in-left ${styles.header}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className={styles.backBtn}
        >
          ←
        </button>
        <h1 className={styles.title}>{t('search.title')}</h1>
      </header>

      <form onSubmit={handleSubmit} className={`animate-fade-in-up ${styles.form}`}>
        <div className={styles.row}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.label')}
            className={styles.input}
          />
          <button
            type="submit"
            disabled={loading || query.trim().length === 0}
            aria-label={t('common.search')}
            className={`interactive-btn ${styles.btn}`}
          >
            🔍
          </button>
        </div>
      </form>

      <section aria-label={t('search.resultsLabel')}>
        {loading ? (
          <SkeletonLoader count={4} height="80px" />
        ) : results.length === 0 && query.trim().length > 0 ? (
          <p className={styles.empty}>{t('search.noResults')}</p>
        ) : (
          <ul className={`stagger-children ${styles.list}`}>
            {results.map((result) => (
              <li key={result.service.id} className={styles.item}>
                <button
                  type="button"
                  className={`interactive-card animate-fade-in-up ${styles.card}`}
                  onClick={() => onServiceSelect(result.service.id)}
                >
                  <div className={styles.cardRow}>
                    <div>
                      <strong className={styles.cardName}>{result.service.name}</strong>
                      <p className={styles.cardCategory}>
                        {result.service.category.replace('_', ' ')}
                      </p>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardRating}>
                        ★ {result.service.averageRating.toFixed(1)}
                      </span>
                      <p className={styles.cardDistance}>{result.distanceKm.toFixed(1)} km</p>
                    </div>
                  </div>
                  {result.service.hasWhatsApp && (
                    <span className={styles.whatsappBadge}>{t('search.whatsapp')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};
