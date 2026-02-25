import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ComplementarySuggestion } from '@client/services/differentiationService';
import { FeedbackButton } from '@client/components/FeedbackButton';
import styles from '@client/styles/components/ComplementarySuggestionsList.module.scss';

export interface ComplementarySuggestionsListProps {
  suggestions: ComplementarySuggestion[];
  onServiceSelect: (serviceId: string) => void;
}

export const ComplementarySuggestionsList: React.FC<ComplementarySuggestionsListProps> = ({
  suggestions,
  onServiceSelect,
}) => {
  const { t } = useTranslation();

  if (suggestions.length === 0) return null;

  return (
    <section
      aria-label={t('serviceProfile.complementary', { defaultValue: 'Serviços complementares' })}
      className={styles.section}
    >
      <h2 className={styles.heading}>
        {t('serviceProfile.complementary', { defaultValue: 'Serviços complementares' })}
      </h2>
      <ul className={`stagger-children ${styles.list}`}>
        {suggestions.map((cs) => (
          <li key={cs.service.id} className={styles.item}>
            <FeedbackButton
              className={`interactive-card animate-fade-in-up ${styles.card}`}
              onClick={() => onServiceSelect(cs.service.id)}
            >
              <strong className={styles.name}>{cs.service.name}</strong>
              <p className={styles.meta}>
                {cs.reason} · {cs.relatedCategory.replace('_', ' ')}
              </p>
              <span className={styles.rating}>★ {cs.service.averageRating.toFixed(1)}</span>
            </FeedbackButton>
          </li>
        ))}
      </ul>
    </section>
  );
};
