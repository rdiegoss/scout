import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/RecentSearchChips.module.scss';

export interface RecentSearchChipsProps {
  recentSearches: string[];
  onTap: (query: string) => void;
}

export const RecentSearchChips: React.FC<RecentSearchChipsProps> = ({ recentSearches, onTap }) => {
  const { t } = useTranslation();

  const unique = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const q of [...recentSearches].reverse()) {
      const norm = q.toLowerCase().trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        result.push(q);
      }
      if (result.length >= 5) break;
    }
    return result;
  }, [recentSearches]);

  if (unique.length === 0) return null;

  return (
    <section
      aria-label={t('home.recentSearches', { defaultValue: 'Buscas recentes' })}
      className={styles.section}
    >
      <div className={styles.chips}>
        <span className={styles.icon}>🕐</span>
        {unique.map((q) => (
          <button key={q} type="button" onClick={() => onTap(q)} className={styles.chip}>
            {q}
          </button>
        ))}
      </div>
    </section>
  );
};
