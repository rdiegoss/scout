import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/BottomNavigation.module.scss';

export interface BottomNavigationProps {
  activeScreen: string;
  onHome: () => void;
  onRegister: () => void;
  onAiStatus: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeScreen,
  onHome,
  onRegister,
  onAiStatus,
}) => {
  const { t } = useTranslation();

  const items = [
    { label: t('nav.home'), target: 'home', onClick: onHome },
    { label: t('nav.register'), target: 'register', onClick: onRegister },
    { label: 'AI Status', target: 'ai-status', onClick: onAiStatus },
  ];

  return (
    <nav className={styles.nav}>
      {items.map((item) => (
        <button
          key={item.target}
          type="button"
          className={`nav-item ${styles.btn}`}
          data-active={activeScreen === item.target}
          onClick={item.onClick}
          aria-label={item.label}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
