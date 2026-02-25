import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchResult } from '@client/pages/SearchScreen';
import { LazyLoad } from '@client/components/LazyLoad';
import { FeedbackButton } from '@client/components/FeedbackButton';
import { CATEGORY_NAME_KEYS } from '@client/utils/categoryHelpers';
import styles from '@client/styles/components/SearchResultsList.module.scss';

export interface SearchResultsListProps {
  results: SearchResult[];
  onClear: () => void;
  onServiceSelect: (serviceId: string) => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  onClear,
  onServiceSelect,
}) => {
  const { t } = useTranslation();

  return (
    <section aria-label={t('search.resultsLabel')}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{t('search.resultsLabel')}</h2>
        <button type="button" onClick={onClear} className={styles.clearBtn}>
          ✕ {t('common.clearSearch', { defaultValue: 'Limpar' })}
        </button>
      </div>
      {results.length === 0 ? (
        <p className={styles.empty}>{t('search.noResults')}</p>
      ) : (
        <ul className={`stagger-children ${styles.list}`}>
          {results.map((result) => (
            <LazyLoad key={result.service.id}>
              <li className={styles.item}>
                <FeedbackButton
                  className={`interactive-card animate-fade-in-up ${styles.card}`}
                  onClick={() => onServiceSelect(result.service.id)}
                >
                  <div className={styles.row}>
                    <div className={styles.info}>
                      <strong className={styles.name}>{result.service.name}</strong>
                      <p className={styles.category}>
                        {t(CATEGORY_NAME_KEYS[result.service.category] ?? 'home.categoryName.outros')}
                      </p>
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.rating}>
                        ★ {result.service.averageRating.toFixed(1)}
                      </span>
                      <p className={styles.relevance}>
                        {Math.round(result.similarity * 100)}% {t('home.relevant')}
                      </p>
                    </div>
                  </div>
                </FeedbackButton>
              </li>
            </LazyLoad>
          ))}
        </ul>
      )}
    </section>
  );
};
