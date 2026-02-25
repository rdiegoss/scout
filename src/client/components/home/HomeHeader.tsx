import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/HomeHeader.module.scss';

export interface HomeHeaderProps {
  greeting: string;
  showSubtitle: boolean;
  isLearning?: boolean;
  isOnline?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  greeting,
  showSubtitle,
  isLearning,
  isOnline,
}) => {
  const { t } = useTranslation();

  return (
    <header className={`animate-fade-in-down ${styles.header}`}>
      <div className={styles.row}>
        <h1 className={styles.greeting}>{greeting}</h1>
      </div>
      {showSubtitle && (
        <p className={styles.subtitle}>{t('home.personalizedRecommendations')}</p>
      )}
      {isLearning && (
        <p className={styles.learningHint}>
          {t('home.learningPreferences', { defaultValue: '📚 Aprendendo suas preferências...' })}
        </p>
      )}
      {isOnline === false && (
        <span className={styles.offlineBadge}>
          {t('home.offline', { defaultValue: '📡 Offline' })}
        </span>
      )}
    </header>
  );
};
