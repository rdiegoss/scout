import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StarRating } from '@client/components/StarRating';
import styles from '@client/styles/components/RatingSubmissionForm.module.scss';

export interface RatingSubmissionFormProps {
  onSubmit: (score: number, comment?: string) => Promise<void>;
}

export const RatingSubmissionForm: React.FC<RatingSubmissionFormProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (score < 1 || score > 5) return;
    setSubmitting(true);
    try {
      await onSubmit(score, comment || undefined);
      setSubmitted(true);
      setScore(0);
      setComment('');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.success}>
        <span className={`success-icon ${styles.successIcon}`}>✓</span>
        <span className="success-text">{t('serviceProfile.ratingSuccess')}</span>
      </div>
    );
  }

  return (
    <section
      aria-label={t('serviceProfile.rateService')}
      className={`animate-fade-in-up ${styles.section}`}
    >
      <h2 className={styles.heading}>{t('serviceProfile.rateService')}</h2>
      <div className={styles.starRow}>
        <StarRating value={score} onChange={setScore} size={32} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('serviceProfile.commentPlaceholder')}
        maxLength={500}
        aria-label={t('serviceProfile.commentLabel')}
        className={styles.textarea}
      />
      <p className={styles.charCount}>
        {t('serviceProfile.charCount', { current: comment.length, max: 500 })}
      </p>
      <button
        type="button"
        className={`interactive-btn ${styles.submitBtn}${score >= 1 ? ` ${styles.active}` : ''}`}
        onClick={handleSubmit}
        disabled={score < 1 || submitting}
      >
        {submitting ? t('serviceProfile.submitting') : t('serviceProfile.submitRating')}
      </button>
    </section>
  );
};
