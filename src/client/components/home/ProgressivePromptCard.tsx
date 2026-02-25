import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PreferencePrompt } from '@client/services/progressiveDataCollector';
import styles from '@client/styles/components/ProgressivePromptCard.module.scss';

export interface ProgressivePromptCardProps {
  prompt: PreferencePrompt;
  onDismiss: () => void;
}

export const ProgressivePromptCard: React.FC<ProgressivePromptCardProps> = ({
  prompt,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`animate-fade-in-up ${styles.card}`}>
      <div className={styles.body}>
        <p className={styles.message}>{prompt.message}</p>
        {prompt.options && prompt.options.length > 0 && (
          <div className={styles.options}>
            {prompt.options.map((opt) => (
              <span key={opt} className={styles.option}>
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={styles.dismiss}
        aria-label={t('common.dismiss', { defaultValue: 'Fechar' })}
      >
        ✕
      </button>
    </div>
  );
};
