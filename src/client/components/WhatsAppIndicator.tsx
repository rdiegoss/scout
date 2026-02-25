import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWhatsAppLink } from '@client/services/whatsAppService';
import styles from '@client/styles/components/WhatsAppIndicator.module.scss';

export interface WhatsAppIndicatorProps {
  hasWhatsApp: boolean;
  whatsAppConfirmed: boolean;
  phone: string;
  onConfirm?: () => void;
}

export const WhatsAppIndicator: React.FC<WhatsAppIndicatorProps> = ({
  hasWhatsApp,
  whatsAppConfirmed,
  phone,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (!hasWhatsApp) {
    return null;
  }

  const handleConfirm = () => {
    setConfirming(true);
    onConfirm?.();
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.statusRow}>
        <span role="img" aria-label="WhatsApp" className={styles.icon}>
          📱
        </span>
        {whatsAppConfirmed ? (
          <span className={styles.confirmed}>{t('whatsapp.confirmed')}</span>
        ) : (
          <span className={styles.unconfirmed}>{t('whatsapp.unconfirmed')}</span>
        )}
      </div>

      {whatsAppConfirmed && (
        <a
          href={getWhatsAppLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={`interactive-btn ${styles.contactLink}`}
          aria-label={t('whatsapp.contactLabel')}
        >
          {t('whatsapp.contact')}
        </a>
      )}

      {!whatsAppConfirmed && (
        <button
          type="button"
          className={`interactive-btn ${styles.confirmBtn}`}
          onClick={handleConfirm}
          disabled={confirming}
          aria-label={t('whatsapp.confirmLabel')}
        >
          {confirming ? t('whatsapp.confirmed_feedback') : t('whatsapp.confirmButton')}
        </button>
      )}
    </div>
  );
};
