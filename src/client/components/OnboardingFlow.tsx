import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/OnboardingFlow.module.scss';

export interface OnboardingFlowProps {
  onComplete: (name: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('onboarding.nameRequired'));
      return;
    }
    setError('');
    onComplete(trimmed);
  };

  return (
    <div className={styles.container}>
      <div className={`onboarding-card ${styles.card}`}>
        <span className={`onboarding-emoji ${styles.emoji}`}>👋</span>
        <h1 className={`onboarding-title ${styles.title}`}>{t('onboarding.welcome')}</h1>
        <p className={`onboarding-subtitle ${styles.subtitle}`}>{t('onboarding.howToCall')}</p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('onboarding.namePlaceholder')}
            aria-label={t('onboarding.nameLabel')}
            autoFocus
            data-error={error ? 'true' : undefined}
            className={styles.input}
          />
          {error && (
            <p role="alert" className={styles.errorMsg}>
              {error}
            </p>
          )}
          <button type="submit" className={`interactive-btn ${styles.submitBtn}`}>
            {t('onboarding.start')}
          </button>
        </form>

        <p className={styles.hint}>{t('onboarding.learningPreferences')}</p>
      </div>
    </div>
  );
};
