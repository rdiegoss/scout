import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RecommendedService } from '@client/services/recommendationEngine';
import { FeedbackButton } from '@client/components/FeedbackButton';
import { CATEGORY_NAME_KEYS } from '@client/utils/categoryHelpers';
import styles from '@client/styles/components/ForYouSection.module.scss';

function getSmartMatchLabelKey(rec: RecommendedService, viewedIds: Set<string>): string {
  if (rec.matchReasons.some((r) => r.includes('histórico') || r.includes('history')))
    return 'home.match.fromSearches';
  if (
    rec.matchReasons.some(
      (r) => r.includes('perfil') || r.includes('Compatível') || r.includes('profile'),
    )
  )
    return 'home.match.aiMatch';
  if (rec.matchReasons.some((r) => r.includes('vizinho') || r.includes('neighbor')))
    return 'home.match.neighbors';
  if (rec.service.averageRating >= 4.0) return 'home.match.highlight';
  if (viewedIds.has(rec.service.id)) return 'home.match.recentlyViewed';
  return 'home.match.aiSuggestion';
}

function matchPercent(score: number): number {
  return Math.min(99, Math.round((score / 5) * 100));
}

export interface ForYouSectionProps {
  recommendations: RecommendedService[];
  isNewUser: boolean;
  viewedServiceIds: Set<string>;
  onServiceSelect: (serviceId: string) => void;
}

export const ForYouSection: React.FC<ForYouSectionProps> = ({
  recommendations,
  isNewUser,
  viewedServiceIds,
  onServiceSelect,
}) => {
  const { t } = useTranslation();

  if (recommendations.length === 0) return null;

  return (
    <section
      aria-label={isNewUser ? t('home.highlights') : t('home.forYou')}
      className={styles.section}
    >
      <h2 className={styles.heading}>
        {isNewUser ? `⭐ ${t('home.highlights')}` : `🎯 ${t('home.forYou')}`}
      </h2>
      {isNewUser && <p className={styles.subtitle}>{t('home.highlightsSubtitle')}</p>}
      <div className={`stagger-children ${styles.scroll}`}>
        {recommendations.map((rec) => {
          const pct = matchPercent(rec.relevanceScore);
          const smartLabelKey = getSmartMatchLabelKey(rec, viewedServiceIds);
          const showMatchPct = !isNewUser && pct > 0;
          return (
            <FeedbackButton
              key={rec.service.id}
              className={`interactive-card animate-fade-in-scale ${styles.card}`}
              onClick={() => onServiceSelect(rec.service.id)}
            >
              <span className={`${styles.matchChip}${isNewUser ? ` ${styles.isNewUser}` : ''}`}>
                {isNewUser
                  ? `⭐ ${t(CATEGORY_NAME_KEYS[rec.service.category] ?? 'home.categoryName.outros')}`
                  : t(smartLabelKey)}
              </span>

              <strong className={styles.name}>
                {rec.service.name || t('home.unknownService')}
              </strong>

              <p className={styles.desc}>
                {rec.service.description?.slice(0, 80) ||
                  rec.service.address ||
                  t(CATEGORY_NAME_KEYS[rec.service.category] ?? 'home.categoryName.outros')}
                {(rec.service.description?.length ?? 0) > 80 ? '...' : ''}
              </p>

              {isNewUser && rec.service.hasWhatsApp && (
                <span className={styles.whatsapp}>📱 WhatsApp</span>
              )}

              <div className={styles.footer}>
                <span className={styles.rating}>
                  {rec.service.averageRating > 0
                    ? `★ ${rec.service.averageRating.toFixed(1)}`
                    : `🆕 ${t('home.newService')}`}
                </span>
                {showMatchPct && (
                  <span
                    className={`${styles.matchPct} ${pct >= 70 ? styles.high : pct >= 40 ? styles.medium : styles.low}`}
                  >
                    {pct}% match
                  </span>
                )}
              </div>
            </FeedbackButton>
          );
        })}
      </div>
    </section>
  );
};
