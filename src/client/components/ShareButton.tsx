import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceProvider } from '@shared/types';
import { shareService, type ShareResult } from '@client/services/shareService';
import styles from '@client/styles/components/ShareButton.module.scss';

export interface ShareButtonProps {
  service: ServiceProvider;
  baseUrl?: string;
  onShareComplete?: (result: ShareResult) => void;
}

type FeedbackState = 'idle' | 'copied' | 'shared' | 'error';

export const ShareButton: React.FC<ShareButtonProps> = ({ service, baseUrl, onShareComplete }) => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackState>('idle');

  const handleShare = useCallback(async () => {
    const result = await shareService(service, baseUrl);

    if (result.success) {
      setFeedback(result.method === 'clipboard' ? 'copied' : 'shared');
    } else {
      setFeedback('error');
    }

    onShareComplete?.(result);

    setTimeout(() => setFeedback('idle'), 2500);
  }, [service, baseUrl, onShareComplete]);

  const label =
    feedback === 'copied'
      ? t('share.copied')
      : feedback === 'shared'
        ? t('share.shared')
        : feedback === 'error'
          ? t('share.error')
          : t('share.share');

  return (
    <button
      type="button"
      className={`interactive-btn ${styles.btn}`}
      onClick={handleShare}
      aria-label={t('share.label')}
      data-state={feedback}
    >
      {label}
    </button>
  );
};
