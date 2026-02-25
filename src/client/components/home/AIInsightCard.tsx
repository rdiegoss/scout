import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SmartInsight } from '@client/services/personalizationEngine';
import styles from '@client/styles/components/AIInsightCard.module.scss';

export interface AIInsightCardProps {
  insight: SmartInsight;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({ insight }) => {
  const { t } = useTranslation();

  return (
    <section
      className={`animate-fade-in-up ${styles.card}`}
      aria-label={t('home.aiInsight', { defaultValue: 'Insight da IA' })}
    >
      <h3 className={styles.headline}>
        {t(insight.headlineKey, insight.headlineParams as Record<string, string>)}
      </h3>
      <p className={styles.desc}>
        {t(insight.descriptionKey, insight.descriptionParams as Record<string, string>)}
      </p>
      {insight.confidence > 0 && !insight.isNewUser && (
        <div className={styles.confidenceRow}>
          <div className={styles.confidenceTrack}>
            <div
              className={styles.confidenceFill}
              style={{ width: `${Math.round(insight.confidence * 100)}%` }}
            />
          </div>
          <span className={styles.confidenceLabel}>
            {Math.round(insight.confidence * 100)}%{' '}
            {t('home.confidence', { defaultValue: 'confiança' })}
          </span>
        </div>
      )}
    </section>
  );
};
