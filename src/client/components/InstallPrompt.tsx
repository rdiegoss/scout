import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@client/styles/components/InstallPrompt.module.scss';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }, []);

  if (!showBanner) return null;

  return (
    <div
      role="banner"
      className={`banner-slide-up ${styles.banner}`}
      aria-label={t('install.bannerLabel')}
    >
      <span className={styles.message}>{t('install.message')}</span>
      <div className={styles.actions}>
        <button
          onClick={handleDismiss}
          className={`interactive-btn ${styles.dismissBtn}`}
          aria-label={t('install.dismissLabel')}
        >
          {t('install.dismiss')}
        </button>
        <button
          onClick={handleInstall}
          className={`interactive-btn ${styles.installBtn}`}
          aria-label={t('install.installLabel')}
        >
          {t('install.install')}
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
