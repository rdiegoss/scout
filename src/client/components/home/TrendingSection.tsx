import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RecommendedService } from '@client/services/recommendationEngine';
import { LazyLoad } from '@client/components/LazyLoad';
import { FeedbackButton } from '@client/components/FeedbackButton';
import { CATEGORY_NAME_KEYS } from '@client/utils/categoryHelpers';
import styles from '@client/styles/components/TrendingSection.module.scss';

export interface TrendingSectionProps {
  recommendations: RecommendedService[];
  onServiceSelect: (serviceId: string) => void;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  recommendations,
  onServiceSelect,
}) => {
  const { t } = useTranslation();

  if (recommendations.length === 0) return null;

  return (
    <section
      aria-label={t('home.trending', { defaultValue: 'Mais Procurados' })}
      className={styles.section}
    >
      <h2 className={styles.heading}>
        🔥 {t('home.trending', { defaultValue: 'Mais Procurados' })}
      </h2>
      <ul className={`stagger-children ${styles.list}`}>
        {recommendations.map((rec, idx) => (
          <LazyLoad key={rec.service.id}>
            <li className={styles.item}>
              <FeedbackButton
                className={`interactive-card animate-fade-in-up ${styles.card}`}
                onClick={() => onServiceSelect(rec.service.id)}
              >
                <span className={`${styles.rank}${idx < 3 ? ` ${styles.top}` : ''}`}>
                  {idx + 1}
                </span>
                <div className={styles.info}>
                  <strong className={styles.name}>{rec.service.name}</strong>
                  <p className={styles.category}>
                    {t(CATEGORY_NAME_KEYS[rec.service.category] ?? 'home.categoryName.outros')}
                  </p>
                </div>
                <div className={styles.meta}>
                  <span className={styles.rating}>★ {rec.service.averageRating.toFixed(1)}</span>
                  {rec.service.totalRatings > 0 && (
                    <p className={styles.count}>
                      {t('home.ratingsCount', { count: rec.service.totalRatings })}
                    </p>
                  )}
                </div>
              </FeedbackButton>
            </li>
          </LazyLoad>
        ))}
      </ul>
    </section>
  );
};
