import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMaskInput } from 'react-imask';
import type { ServiceCategory } from '@shared/types';
import { isValidBrazilianPhone } from '@shared/utils/validation';
import { CATEGORIES } from '@client/services/categoryService';
import { db } from '@client/services/database';

export interface ServiceFormData {
  name: string;
  category: ServiceCategory | '';
  phone: string;
  hasWhatsApp: boolean;
  address: string;
  description: string;
}

export interface ServiceRegistrationFormProps {
  onBack: () => void;
  onSuccess?: (serviceId: string) => void;

  registeredBy?: string;
}

export interface FormErrors {
  name?: string;
  category?: string;
  phone?: string;
  address?: string;
  description?: string;
}

export function validateServiceForm(data: ServiceFormData, t: (key: string) => string): FormErrors {
  const errors: FormErrors = {};

  if (!data.phone.trim()) {
    errors.phone = t('validation.phoneRequired');
  } else if (!isValidBrazilianPhone(data.phone)) {
    errors.phone = t('validation.phoneInvalid');
  }

  return errors;
}

const fieldStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--color-border)'}`,
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box',
  background: hasError ? 'var(--color-error, #ef4444)11' : 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '4px',
  color: 'var(--color-text-primary)',
};

const errorTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-error)',
  marginTop: '4px',
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const INITIAL_FORM_DATA: ServiceFormData = {
  name: '',
  category: '',
  phone: '',
  hasWhatsApp: false,
  address: '',
  description: '',
};

export const ServiceRegistrationForm: React.FC<ServiceRegistrationFormProps> = ({
  onBack,
  onSuccess,
  registeredBy = 'anonymous',
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ServiceFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = <K extends keyof ServiceFormData>(
    field: K,
    value: ServiceFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateServiceForm(formData, t);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      const serviceId = crypto.randomUUID();

      await db.services.add({
        id: serviceId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category as ServiceCategory,
        phone: formData.phone.trim(),
        hasWhatsApp: formData.hasWhatsApp,
        whatsAppConfirmed: false,
        address: formData.address.trim(),
        location: { latitude: 0, longitude: 0, accuracy: 0, timestamp: now },
        averageRating: 0,
        totalRatings: 0,
        recentRatings: [],
        registeredBy,
        neighborhoodScore: 0,
        dataSource: 'manual',
        verifiedByUsers: 0,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      });

      setSubmitted(true);
      onSuccess?.(serviceId);
    } catch {
      setErrors({ name: t('registration.saveError') });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', color: 'var(--color-text-primary)' }}>
        <div style={{ padding: '48px 16px' }}>
          <span className="success-icon" style={{ fontSize: '48px', display: 'block' }}>✅</span>
          <h2 className="success-text" style={{ fontSize: '20px', fontWeight: 700, marginTop: '16px' }}>
            {t('registration.successTitle')}
          </h2>
          <p className="animate-fade-in" style={{ color: 'var(--color-text-secondary)', marginTop: '8px', animationDelay: '0.4s' }}>
            {t('registration.successMessage')}
          </p>
          <button
            type="button"
            className="interactive-btn animate-fade-in-up"
            onClick={onBack}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              animationDelay: '0.5s',
            }}
          >
            {t('common.back')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <header className="animate-slide-in-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px', color: 'var(--color-text-primary)' }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{t('registration.title')}</h1>
      </header>

      <form onSubmit={handleSubmit} className="animate-fade-in-up" noValidate>
        <div style={fieldGroupStyle}>
          <label htmlFor="service-name" style={labelStyle}>
            {t('registration.nameLabel')}
          </label>
          <input
            id="service-name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t('registration.namePlaceholder')}
            style={fieldStyle(!!errors.name)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <span id="name-error" style={errorTextStyle} role="alert">
              {errors.name}
            </span>
          )}
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="service-category" style={labelStyle}>
            {t('registration.categoryLabel')}
          </label>
          <select
            id="service-category"
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value as ServiceCategory | '')}
            style={fieldStyle(!!errors.category)}
            aria-invalid={!!errors.category}
            aria-describedby={errors.category ? 'category-error' : undefined}
          >
            <option value="">{t('registration.categoryPlaceholder')}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          {errors.category && (
            <span id="category-error" style={errorTextStyle} role="alert">
              {errors.category}
            </span>
          )}
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="service-phone" style={labelStyle}>
            {t('registration.phoneLabel')}
          </label>
          <IMaskInput
            id="service-phone"
            mask={[
              { mask: '(00) 0000-0000' },
              { mask: '(00) 00000-0000' },
            ]}
            value={formData.phone}
            unmask={false}
            onAccept={(value: string) => updateField('phone', value)}
            placeholder={t('registration.phonePlaceholder')}
            style={fieldStyle(!!errors.phone)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
          />
          {errors.phone && (
            <span id="phone-error" style={errorTextStyle} role="alert">
              {errors.phone}
            </span>
          )}
        </div>

        <div style={{ ...fieldGroupStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            id="service-whatsapp"
            type="checkbox"
            checked={formData.hasWhatsApp}
            onChange={(e) => updateField('hasWhatsApp', e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="service-whatsapp" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
            {t('registration.whatsappLabel')}
          </label>
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="service-address" style={labelStyle}>
            {t('registration.addressLabel')}
          </label>
          <input
            id="service-address"
            type="text"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder={t('registration.addressPlaceholder')}
            style={fieldStyle(false)}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="service-description" style={labelStyle}>
            {t('registration.descriptionLabel')}
          </label>
          <textarea
            id="service-description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder={t('registration.descriptionPlaceholder')}
            rows={4}
            style={{ ...fieldStyle(false), resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          className="interactive-btn"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: submitting ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {submitting ? t('registration.submitting') : t('registration.submit')}
        </button>
      </form>
    </main>
  );
};
