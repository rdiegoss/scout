import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CategoryDefinition, ServiceCategory } from '@shared/types';
import { CATEGORY_LABELS } from '@client/utils/categoryHelpers';
import styles from '@client/styles/components/QuickInterestBubbles.module.scss';

export interface QuickInterestBubblesProps {
  categories: CategoryDefinition[];
  onTap: (category: ServiceCategory) => void;
}

export const QuickInterestBubbles: React.FC<QuickInterestBubblesProps> = ({
  categories,
  onTap,
}) => {
  const { t } = useTranslation();
  const [tapped, setTapped] = useState<Set<ServiceCategory>>(new Set());

  const handleTap = (catId: ServiceCategory) => {
    setTapped((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
    onTap(catId);
  };

  return (
    <section
      aria-label={t('home.quickInterests', { defaultValue: 'Selecione seus interesses' })}
      className={`animate-fade-in-up ${styles.section}`}
    >
      <h2 className={styles.heading}>
        ⚡ {t('home.quickInterests', { defaultValue: 'Toque no que te interessa' })}
      </h2>
      <div className={styles.chips}>
        {categories.map((cat) => {
          const isTapped = tapped.has(cat.id);
          const label = CATEGORY_LABELS[cat.id] ?? { emoji: '📦', short: cat.name };
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleTap(cat.id)}
              aria-pressed={isTapped}
              className={styles.chip}
            >
              <span className={styles.emoji}>{label.emoji}</span>
              {label.short}
              {isTapped && <span className={styles.check}>✓</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};
