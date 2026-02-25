import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Rating } from '@shared/types';
import { StarRating } from '@client/components/StarRating';
import styles from '@client/styles/components/RecentRatingsList.module.scss';

export interface RecentRatingsListProps {
  ratings: Rating[];
  locale: string;
}

export const RecentRatingsList: React.FC<RecentRatingsListProps> = ({ ratings, locale }) => {
  const { t } = useTranslation();

  return (
    <section aria-label={t('serviceProfile.recentRatings')} className={styles.section}>
      <h2 className={styles.heading}>{t('serviceProfile.recentRatings')}</h2>
      {ratings.length === 0 ? (
        <p className={styles.empty}>{t('serviceProfile.noRatings')}</p>
      ) : (
        <ul className={`stagger-children ${styles.list}`}>
          {ratings.map((rating) => (
            <li key={rating.id} className={`animate-fade-in-up ${styles.item}`}>
              <div className={styles.itemHeader}>
                <StarRating value={rating.score} readOnly size={16} />
                <span className={styles.date}>
                  {new Date(rating.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
              {rating.isNeighbor && (
                <span className={styles.neighborBadge}>
                  {t('serviceProfile.neighborRecommended')}
                </span>
              )}
              {rating.comment && <p className={styles.comment}>{rating.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
