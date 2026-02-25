import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceProvider } from '@shared/types';
import type { ComplementarySuggestion } from '@client/services/differentiationService';
import { ServiceDetailsCard } from '@client/components/service/ServiceDetailsCard';
import { RecentRatingsList } from '@client/components/service/RecentRatingsList';
import { RatingSubmissionForm } from '@client/components/service/RatingSubmissionForm';
import { ComplementarySuggestionsList } from '@client/components/service/ComplementarySuggestionsList';
import styles from '@client/styles/ServiceProfileScreen.module.scss';

export interface ServiceProfileScreenProps {
  service: ServiceProvider | null;
  loading: boolean;
  complementarySuggestions?: ComplementarySuggestion[];
  onBack: () => void;
  onSubmitRating: (score: number, comment?: string) => Promise<void>;
  onWhatsAppConfirm?: (serviceId: string) => Promise<void>;
  onServiceSelect?: (serviceId: string) => void;
}

export const ServiceProfileScreen: React.FC<ServiceProfileScreenProps> = ({
  service,
  loading,
  complementarySuggestions = [],
  onBack,
  onSubmitRating,
  onWhatsAppConfirm,
  onServiceSelect,
}) => {
  const { t, i18n } = useTranslation();

  if (loading || !service) {
    return (
      <main className={styles.main}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className={styles.backBtn}
        >
          ←
        </button>
        <p className={styles.loadingText}>
          {loading ? t('common.loading') : t('serviceProfile.notFound')}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={`animate-slide-in-left ${styles.header}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className={styles.backBtn}
        >
          ←
        </button>
        <h1 className={styles.title}>{service.name}</h1>
      </header>

      <ServiceDetailsCard
        service={service}
        onWhatsAppConfirm={onWhatsAppConfirm ? () => onWhatsAppConfirm(service.id) : undefined}
      />

      <RecentRatingsList ratings={service.recentRatings} locale={i18n.language} />

      <RatingSubmissionForm key={service.id} onSubmit={onSubmitRating} />

      <ComplementarySuggestionsList
        suggestions={complementarySuggestions}
        onServiceSelect={onServiceSelect ?? (() => {})}
      />
    </main>
  );
};
