import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CategoryDefinition, ServiceCategory } from '@shared/types';
import styles from '@client/styles/components/CategoryChips.module.scss';

export interface CategoryChipsProps {
  categories: CategoryDefinition[];
  activeCategory: ServiceCategory | null;
  highlightCategories?: ServiceCategory[];
  onToggle: (categoryId: ServiceCategory) => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  activeCategory,
  highlightCategories,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <section aria-label={t('home.categories')} className={styles.section}>
      <h2 className={styles.heading}>
        📂 {t('home.exploreCategories', { defaultValue: 'Explorar Categorias' })}
      </h2>
      <div className={styles.scroll}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          const highlight = highlightCategories?.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              className={`category-chip ${styles.chip}${highlight ? ` ${styles.highlighted}` : ''}`}
              onClick={() => onToggle(cat.id)}
              aria-label={cat.name}
              aria-pressed={isActive}
            >
              <span className={styles.icon}>{cat.icon}</span>
              {cat.name}
              {highlight && !isActive && <span className={styles.dot}>●</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};
