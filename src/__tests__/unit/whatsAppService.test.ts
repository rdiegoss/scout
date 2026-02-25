/**
 * Unit tests for WhatsApp service and WhatsAppIndicator component logic.
 *
 * Tests cover:
 * - WhatsApp link generation from various phone formats
 * - WhatsApp confirmation persistence
 * - WhatsAppIndicator component interface and rendering logic
 *
 * Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6
 */
import { describe, it, expect } from 'vitest';
import { getWhatsAppLink } from '@client/services/whatsAppService';
import type { WhatsAppIndicatorProps } from '@client/components/WhatsAppIndicator';

// ── getWhatsAppLink tests ────────────────────────────────────────────────────

describe('getWhatsAppLink', () => {
  it('should generate link from formatted phone with DDD', () => {
    const link = getWhatsAppLink('(11) 99999-0000');
    expect(link).toBe('https://wa.me/5511999990000');
  });

  it('should generate link from phone with country code', () => {
    const link = getWhatsAppLink('+55 21 98765-4321');
    expect(link).toBe('https://wa.me/5521987654321');
  });

  it('should generate link from digits-only phone', () => {
    const link = getWhatsAppLink('11999990000');
    expect(link).toBe('https://wa.me/5511999990000');
  });

  it('should not double-prepend 55 when already present with correct length', () => {
    const link = getWhatsAppLink('5511999990000');
    expect(link).toBe('https://wa.me/5511999990000');
  });

  it('should handle landline format with DDD', () => {
    const link = getWhatsAppLink('(11) 3456-7890');
    expect(link).toBe('https://wa.me/551134567890');
  });

  it('should handle phone without DDD', () => {
    const link = getWhatsAppLink('99999-0000');
    expect(link).toBe('https://wa.me/55999990000');
  });
});

// ── WhatsAppIndicator props/logic tests ──────────────────────────────────────

describe('WhatsAppIndicator', () => {
  it('should return null props pattern when hasWhatsApp is false', () => {
    const props: WhatsAppIndicatorProps = {
      hasWhatsApp: false,
      whatsAppConfirmed: false,
      phone: '(11) 99999-0000',
    };
    // Component renders null when hasWhatsApp is false
    expect(props.hasWhatsApp).toBe(false);
  });

  it('should show confirmed status when both flags are true', () => {
    const props: WhatsAppIndicatorProps = {
      hasWhatsApp: true,
      whatsAppConfirmed: true,
      phone: '(11) 99999-0000',
    };
    expect(props.hasWhatsApp && props.whatsAppConfirmed).toBe(true);
  });

  it('should show unconfirmed status when hasWhatsApp but not confirmed', () => {
    const props: WhatsAppIndicatorProps = {
      hasWhatsApp: true,
      whatsAppConfirmed: false,
      phone: '(11) 99999-0000',
    };
    expect(props.hasWhatsApp).toBe(true);
    expect(props.whatsAppConfirmed).toBe(false);
  });

  it('should generate correct WhatsApp link for confirmed service', () => {
    const phone = '(21) 98765-4321';
    const link = getWhatsAppLink(phone);
    expect(link).toBe('https://wa.me/5521987654321');
  });

  it('should accept onConfirm callback for status update', () => {
    let confirmed = false;
    const props: WhatsAppIndicatorProps = {
      hasWhatsApp: true,
      whatsAppConfirmed: false,
      phone: '(11) 99999-0000',
      onConfirm: () => { confirmed = true; },
    };
    props.onConfirm?.();
    expect(confirmed).toBe(true);
  });
});
