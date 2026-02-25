import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/SearchBar.module.scss';

export interface SearchBarProps {
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  loading,
  onQueryChange,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className={`animate-fade-in-up ${styles.form}`}>
      <div className={styles.row}>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('home.searchLabel')}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={loading || query.trim().length === 0}
          aria-label={t('common.search')}
          className={`interactive-btn ${styles.btn}`}
        >
          🔍
        </button>
      </div>
    </form>
  );
};
