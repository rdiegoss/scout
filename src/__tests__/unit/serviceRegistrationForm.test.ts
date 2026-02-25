/**
 * Unit tests for ServiceRegistrationForm component.
 *
 * Tests form validation logic, data structures, and form field requirements.
 * Since the test environment is node (no jsdom), we test the exported
 * validation function and type contracts.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6
 */
import { describe, it, expect } from 'vitest';
import {
  validateServiceForm,
  type ServiceFormData,
} from '@client/components/ServiceRegistrationForm';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simple passthrough t function for tests */
const t = (key: string) => key;

function makeValidFormData(overrides: Partial<ServiceFormData> = {}): ServiceFormData {
  return {
    name: 'João Eletricista',
    category: 'reparos_domesticos',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    address: 'Rua das Flores, 123, Centro',
    description: 'Serviços elétricos residenciais e comerciais',
    ...overrides,
  };
}

// ── Validation tests ─────────────────────────────────────────────────────────

describe('validateServiceForm', () => {
  it('should return no errors for valid form data', () => {
    const errors = validateServiceForm(makeValidFormData(), t);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should not require name field (name is optional)', () => {
    const errors = validateServiceForm(makeValidFormData({ name: '' }), t);
    expect(errors.name).toBeUndefined();
  });

  it('should not require name to be non-whitespace (name is optional)', () => {
    const errors = validateServiceForm(makeValidFormData({ name: '   ' }), t);
    expect(errors.name).toBeUndefined();
  });

  it('should not require category field (category is optional)', () => {
    const errors = validateServiceForm(makeValidFormData({ category: '' }), t);
    expect(errors.category).toBeUndefined();
  });

  it('should require phone field (Req 4.3)', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '' }), t);
    expect(errors.phone).toBeDefined();
  });

  it('should reject invalid phone format (Req 4.4)', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '12345' }), t);
    expect(errors.phone).toBeDefined();
  });

  it('should accept valid phone with DDD', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '(21) 98765-4321' }), t);
    expect(errors.phone).toBeUndefined();
  });

  it('should accept valid phone with country code', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '+55 11 99999-0000' }), t);
    expect(errors.phone).toBeUndefined();
  });

  it('should accept valid landline phone', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '(11) 3456-7890' }), t);
    expect(errors.phone).toBeUndefined();
  });

  it('should accept valid mobile phone (11 digits formatted)', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '(85) 99603-3353' }), t);
    expect(errors.phone).toBeUndefined();
  });

  it('should accept valid landline phone (10 digits formatted)', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '(11) 3456-7890' }), t);
    expect(errors.phone).toBeUndefined();
  });

  it('should not require address field (optional)', () => {
    const errors = validateServiceForm(makeValidFormData({ address: '' }), t);
    expect(errors.address).toBeUndefined();
  });

  it('should not require description field (optional)', () => {
    const errors = validateServiceForm(makeValidFormData({ description: '' }), t);
    expect(errors.description).toBeUndefined();
  });

  it('should return phone error when all fields are empty (only phone required)', () => {
    const errors = validateServiceForm({
      name: '',
      category: '',
      phone: '',
      hasWhatsApp: false,
      address: '',
      description: '',
    }, t);
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(1);
    expect(errors.phone).toBeDefined();
  });

  it('should not validate hasWhatsApp as it is optional (Req 4.6)', () => {
    const errorsWithWhatsApp = validateServiceForm(makeValidFormData({ hasWhatsApp: true }), t);
    const errorsWithoutWhatsApp = validateServiceForm(makeValidFormData({ hasWhatsApp: false }), t);
    expect(Object.keys(errorsWithWhatsApp)).toHaveLength(0);
    expect(Object.keys(errorsWithoutWhatsApp)).toHaveLength(0);
  });
});

// ── Form data structure tests ────────────────────────────────────────────────

describe('ServiceFormData structure (Req 4.1)', () => {
  it('should have all required fields per Requirement 4.1', () => {
    const data = makeValidFormData();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('category');
    expect(data).toHaveProperty('phone');
    expect(data).toHaveProperty('hasWhatsApp');
    expect(data).toHaveProperty('address');
    expect(data).toHaveProperty('description');
  });

  it('should support all service categories', () => {
    const categories = [
      'reparos_domesticos',
      'servicos_pessoais',
      'automotivo',
      'construcao',
      'outros',
    ] as const;

    for (const cat of categories) {
      const data = makeValidFormData({ category: cat });
      const errors = validateServiceForm(data, t);
      expect(errors.category).toBeUndefined();
    }
  });

  it('should support WhatsApp checkbox toggle (Req 4.6)', () => {
    const dataWith = makeValidFormData({ hasWhatsApp: true });
    const dataWithout = makeValidFormData({ hasWhatsApp: false });
    expect(dataWith.hasWhatsApp).toBe(true);
    expect(dataWithout.hasWhatsApp).toBe(false);
  });
});

// ── FormErrors structure tests ───────────────────────────────────────────────

describe('FormErrors structure (Req 4.3)', () => {
  it('should return error messages as strings for phone errors', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '' }), t);
    expect(typeof errors.phone).toBe('string');
    expect((errors.phone as string).length).toBeGreaterThan(0);
  });

  it('should return undefined for valid fields', () => {
    const errors = validateServiceForm(makeValidFormData({ phone: '' }), t);
    // Only phone should have error, others should be undefined
    expect(errors.name).toBeUndefined();
    expect(errors.category).toBeUndefined();
    expect(errors.address).toBeUndefined();
    expect(errors.description).toBeUndefined();
  });
});
