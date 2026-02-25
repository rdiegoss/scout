/**
 * Unit tests for ShareService - friend referral / service sharing.
 *
 * Tests cover:
 * - Building share data from a ServiceProvider
 * - Deep link URL generation
 * - Category name formatting
 * - Web Share API detection
 * - Clipboard fallback
 * - shareService orchestration logic
 *
 * Validates: Requirements 13.8
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildServiceUrl,
  formatCategoryName,
  buildShareData,
  isWebShareAvailable,
  copyToClipboard,
  shareService,
} from '@client/services/shareService';
import type { ServiceProvider } from '@shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'svc-123',
    name: 'João Eletricista',
    description: 'Serviços elétricos residenciais',
    category: 'reparos_domesticos',
    phone: '(11) 99999-0000',
    hasWhatsApp: true,
    whatsAppConfirmed: true,
    address: 'Rua das Flores, 42',
    location: { latitude: -23.55, longitude: -46.63, accuracy: 10, timestamp: 0 },
    averageRating: 4.5,
    totalRatings: 12,
    recentRatings: [],
    registeredBy: 'user-1',
    neighborhoodScore: 0.8,
    dataSource: 'manual',
    verifiedByUsers: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  };
}

// ── buildServiceUrl ──────────────────────────────────────────────────────────

describe('buildServiceUrl', () => {
  it('should build URL with provided base', () => {
    expect(buildServiceUrl('abc', 'https://myapp.com')).toBe('https://myapp.com/service/abc');
  });

  it('should use window.location.origin when no base provided', () => {
    // In node test env window is undefined, so it falls back to default
    const url = buildServiceUrl('xyz');
    expect(url).toContain('/service/xyz');
  });
});

// ── formatCategoryName ───────────────────────────────────────────────────────

describe('formatCategoryName', () => {
  it('should replace underscores and capitalize words', () => {
    expect(formatCategoryName('reparos_domesticos')).toBe('Reparos Domesticos');
  });

  it('should handle single word', () => {
    expect(formatCategoryName('automotivo')).toBe('Automotivo');
  });

  it('should handle "outros"', () => {
    expect(formatCategoryName('outros')).toBe('Outros');
  });
});

// ── buildShareData ───────────────────────────────────────────────────────────

describe('buildShareData', () => {
  it('should include service name in title', () => {
    const service = makeService();
    const data = buildShareData(service, 'https://app.test');
    expect(data.title).toBe('Indicação: João Eletricista');
  });

  it('should include name, category, phone, and URL in text', () => {
    const service = makeService();
    const data = buildShareData(service, 'https://app.test');
    expect(data.text).toContain('João Eletricista');
    expect(data.text).toContain('Reparos Domesticos');
    expect(data.text).toContain('(11) 99999-0000');
    expect(data.text).toContain('https://app.test/service/svc-123');
  });

  it('should set url to the deep link', () => {
    const service = makeService({ id: 'svc-456' });
    const data = buildShareData(service, 'https://app.test');
    expect(data.url).toBe('https://app.test/service/svc-456');
  });
});

// ── isWebShareAvailable ──────────────────────────────────────────────────────

describe('isWebShareAvailable', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, writable: true });
  });

  it('should return false when navigator.share is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true });
    expect(isWebShareAvailable()).toBe(false);
  });

  it('should return true when navigator.share is a function', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: vi.fn() },
      writable: true,
    });
    expect(isWebShareAvailable()).toBe(true);
  });
});

// ── copyToClipboard ──────────────────────────────────────────────────────────

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when clipboard.writeText succeeds', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      writable: true,
    });
    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('should return false when clipboard.writeText throws', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } },
      writable: true,
    });
    const result = await copyToClipboard('hello');
    expect(result).toBe(false);
  });

  it('should return false when clipboard API is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true });
    const result = await copyToClipboard('hello');
    expect(result).toBe(false);
  });
});

// ── shareService ─────────────────────────────────────────────────────────────

describe('shareService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use Web Share API when available and succeed', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: shareMock, clipboard: { writeText: vi.fn() } },
      writable: true,
    });

    const service = makeService();
    const result = await shareService(service, 'https://app.test');

    expect(result.success).toBe(true);
    expect(result.method).toBe('webshare');
    expect(shareMock).toHaveBeenCalledOnce();
  });

  it('should return cancelled when user aborts Web Share', async () => {
    const abortErr = new DOMException('User cancelled', 'AbortError');
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: vi.fn().mockRejectedValue(abortErr), clipboard: { writeText: vi.fn() } },
      writable: true,
    });

    const result = await shareService(makeService(), 'https://app.test');
    expect(result.success).toBe(false);
    expect(result.method).toBe('webshare');
    expect(result.error).toContain('cancelado');
  });

  it('should fall back to clipboard when Web Share throws non-abort error', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        share: vi.fn().mockRejectedValue(new Error('not supported')),
        clipboard: { writeText: writeTextMock },
      },
      writable: true,
    });

    const result = await shareService(makeService(), 'https://app.test');
    expect(result.success).toBe(true);
    expect(result.method).toBe('clipboard');
  });

  it('should use clipboard when Web Share API is not available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: writeTextMock } },
      writable: true,
    });

    const result = await shareService(makeService(), 'https://app.test');
    expect(result.success).toBe(true);
    expect(result.method).toBe('clipboard');
  });

  it('should return failure when both Web Share and clipboard fail', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
    });

    const result = await shareService(makeService(), 'https://app.test');
    expect(result.success).toBe(false);
    expect(result.method).toBe('none');
  });
});
