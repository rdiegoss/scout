import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceCategory, CategoryDefinition, SubcategoryDefinition } from '@shared/types';
import type { CategoryCount } from '@client/services/categoryService';
import styles from '@client/styles/CategoriesScreen.module.scss';

export interface CategoriesScreenProps {
  categories: CategoryDefinition[];
  categoryCounts: CategoryCount[];
  loading: boolean;
  onBack: () => void;
  onSubcategorySelect: (categoryId: ServiceCategory, subcategoryId: string) => void;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  categories,
  categoryCounts,
  loading,
  onBack,
  onSubcategorySelect,
}) => {
  const { t } = useTranslation();
  const [expandedCategory, setExpandedCategory] = useState<ServiceCategory | null>(null);

  const getCount = (categoryId: ServiceCategory): number => {
    return categoryCounts.find((c) => c.categoryId === categoryId)?.count ?? 0;
  };

  const toggleCategory = (categoryId: ServiceCategory) => {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
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
        <h1 className={styles.title}>{t('categories.title')}</h1>
      </header>

      {loading ? (
        <p className={styles.loadingText}>{t('categories.loading')}</p>
      ) : (
        <ul className={`stagger-children ${styles.list}`}>
          {categories.map((cat) => {
            const isExpanded = expandedCategory === cat.id;
            const count = getCount(cat.id);

            return (
              <li key={cat.id} className={`animate-fade-in-up ${styles.item}`}>
                <button
                  type="button"
                  className={`interactive-card ${styles.categoryBtn}`}
                  onClick={() => toggleCategory(cat.id)}
                  aria-expanded={isExpanded}
                  aria-label={t('categories.servicesLabel', { name: cat.name, count })}
                >
                  <div className={styles.categoryLeft}>
                    <span className={styles.categoryIcon}>{cat.icon}</span>
                    <span className={styles.categoryName}>{cat.name}</span>
                  </div>
                  <div className={styles.categoryRight}>
                    <span className={styles.countBadge}>
                      {t('categories.servicesCount', { count })}
                    </span>
                    <span className={`${styles.chevron}${isExpanded ? ` ${styles.expanded}` : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className={`expand-section ${styles.subcategories}`}>
                    {cat.subcategories.map((sub: SubcategoryDefinition) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSubcategorySelect(cat.id, sub.id)}
                        aria-label={sub.name}
                        className={styles.subBtn}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};
