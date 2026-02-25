import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceProvider } from '@shared/types';
import { StarRating } from '@client/components/StarRating';
import { WhatsAppIndicator } from '@client/components/WhatsAppIndicator';
import { ShareButton } from '@client/components/ShareButton';
import styles from '@client/styles/components/ServiceDetailsCard.module.scss';

export interface ServiceDetailsCardProps {
  service: ServiceProvider;
  onWhatsAppConfirm?: () => Promise<void>;
}

export const ServiceDetailsCard: React.FC<ServiceDetailsCardProps> = ({
  service,
  onWhatsAppConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('serviceProfile.detailsLabel')}
      className={`animate-fade-in-up ${styles.section}`}
    >
      <div className={styles.card}>
        <p className={styles.category}>
          {service.category.replace('_', ' ')}
          {service.subcategory && ` · ${service.subcategory}`}
        </p>

        <div className={styles.ratingRow}>
          <StarRating value={Math.round(service.averageRating)} readOnly size={20} />
          <span className={styles.ratingCount}>
            {service.averageRating.toFixed(1)} (
            {t('serviceProfile.ratings', { count: service.totalRatings })})
          </span>
        </div>

        <div className={styles.phoneRow}>
          <p className={styles.phone}>📞 {service.phone}</p>
          <WhatsAppIndicator
            hasWhatsApp={service.hasWhatsApp}
            whatsAppConfirmed={service.whatsAppConfirmed}
            phone={service.phone}
            onConfirm={onWhatsAppConfirm}
          />
        </div>

        <div className={styles.shareRow}>
          <ShareButton service={service} />
        </div>

        <p className={styles.address}>📍 {service.address}</p>

        {service.description && <p className={styles.description}>{service.description}</p>}
      </div>
    </section>
  );
};
