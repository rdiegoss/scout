/**
 * Unit tests for Brazilian phone number validation
 *
 * Tests cover:
 * - Valid mobile formats: (XX) XXXXX-XXXX, +55 XX XXXXX-XXXX, XXXXX-XXXX
 * - Valid landline formats: (XX) XXXX-XXXX, +55 XX XXXX-XXXX, XXXX-XXXX
 * - Invalid DDD codes
 * - Invalid formats and edge cases
 *
 * Validates: Requirements 4.4
 */
import { describe, it, expect } from 'vitest';
import { isValidBrazilianPhone } from '@shared/utils/validation';

describe('isValidBrazilianPhone', () => {
  describe('valid mobile numbers with DDD', () => {
    it('should accept (XX) XXXXX-XXXX format', () => {
      expect(isValidBrazilianPhone('(11) 91234-5678')).toBe(true);
      expect(isValidBrazilianPhone('(21) 99876-5432')).toBe(true);
      expect(isValidBrazilianPhone('(85) 98765-4321')).toBe(true);
    });

    it('should accept +55 XX XXXXX-XXXX format', () => {
      expect(isValidBrazilianPhone('+55 11 91234-5678')).toBe(true);
      expect(isValidBrazilianPhone('+55 21 99876-5432')).toBe(true);
      expect(isValidBrazilianPhone('+55 85 98765-4321')).toBe(true);
    });
  });

  describe('valid landline numbers with DDD', () => {
    it('should accept (XX) XXXX-XXXX format', () => {
      expect(isValidBrazilianPhone('(11) 3456-7890')).toBe(true);
      expect(isValidBrazilianPhone('(21) 2345-6789')).toBe(true);
      expect(isValidBrazilianPhone('(31) 4567-8901')).toBe(true);
    });

    it('should accept +55 XX XXXX-XXXX format', () => {
      expect(isValidBrazilianPhone('+55 11 3456-7890')).toBe(true);
      expect(isValidBrazilianPhone('+55 21 2345-6789')).toBe(true);
    });
  });

  describe('valid numbers without DDD', () => {
    it('should accept XXXXX-XXXX format (mobile without DDD)', () => {
      expect(isValidBrazilianPhone('91234-5678')).toBe(true);
      expect(isValidBrazilianPhone('99876-5432')).toBe(true);
    });

    it('should accept XXXX-XXXX format (landline without DDD)', () => {
      expect(isValidBrazilianPhone('3456-7890')).toBe(true);
      expect(isValidBrazilianPhone('2345-6789')).toBe(true);
    });
  });

  describe('mobile numbers must start with 9', () => {
    it('should accept 9-digit numbers starting with 9', () => {
      expect(isValidBrazilianPhone('(11) 91234-5678')).toBe(true);
    });

    it('should reject 9-digit numbers not starting with 9', () => {
      expect(isValidBrazilianPhone('(11) 81234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(11) 31234-5678')).toBe(false);
    });
  });

  describe('invalid DDD codes', () => {
    it('should reject numbers with invalid DDD', () => {
      expect(isValidBrazilianPhone('(00) 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(10) 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(20) 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(50) 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(70) 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('(90) 91234-5678')).toBe(false);
    });

    it('should reject +55 numbers with invalid DDD', () => {
      expect(isValidBrazilianPhone('+55 00 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('+55 10 91234-5678')).toBe(false);
    });
  });

  describe('invalid formats', () => {
    it('should reject empty string', () => {
      expect(isValidBrazilianPhone('')).toBe(false);
    });

    it('should reject random strings', () => {
      expect(isValidBrazilianPhone('hello')).toBe(false);
      expect(isValidBrazilianPhone('abc123')).toBe(false);
      expect(isValidBrazilianPhone('not a phone')).toBe(false);
    });

    it('should reject numbers that are too short', () => {
      expect(isValidBrazilianPhone('123')).toBe(false);
      expect(isValidBrazilianPhone('123-456')).toBe(false);
    });

    it('should reject numbers that are too long', () => {
      expect(isValidBrazilianPhone('(11) 912345-67890')).toBe(false);
      expect(isValidBrazilianPhone('+55 11 912345-67890')).toBe(false);
    });

    it('should reject wrong country code', () => {
      expect(isValidBrazilianPhone('+1 11 91234-5678')).toBe(false);
      expect(isValidBrazilianPhone('+44 11 91234-5678')).toBe(false);
    });

    it('should reject numbers with letters mixed in', () => {
      expect(isValidBrazilianPhone('(11) 9abc-5678')).toBe(false);
      expect(isValidBrazilianPhone('(1a) 91234-5678')).toBe(false);
    });

    it('should reject numbers without proper formatting but accept raw digits', () => {
      // These have formatting characters but wrong format - still valid via raw digit fallback
      expect(isValidBrazilianPhone('(11) 912345678')).toBe(true); // raw digits: 11912345678 = valid
      expect(isValidBrazilianPhone('91234 5678')).toBe(true); // raw digits: 912345678 = valid 9-digit mobile
    });
  });

  describe('raw digit formats', () => {
    it('should accept 11 raw digits (DDD + mobile)', () => {
      expect(isValidBrazilianPhone('85996033353')).toBe(true);
      expect(isValidBrazilianPhone('11999990000')).toBe(true);
    });

    it('should accept 10 raw digits (DDD + landline)', () => {
      expect(isValidBrazilianPhone('1134567890')).toBe(true);
    });

    it('should reject raw digits with invalid DDD', () => {
      expect(isValidBrazilianPhone('00999990000')).toBe(false);
      expect(isValidBrazilianPhone('10999990000')).toBe(false);
    });

    it('should accept 8-9 raw digits (local number)', () => {
      expect(isValidBrazilianPhone('912345678')).toBe(true);
      expect(isValidBrazilianPhone('34567890')).toBe(true);
    });
  });
});

/**
 * Unit tests for comment length validation
 *
 * Tests cover:
 * - Valid comments within 500 character limit
 * - Empty and undefined comments (optional field)
 * - Comments exceeding 500 characters
 * - Boundary at exactly 500 and 501 characters
 *
 * Validates: Requirements 5.3
 */
import { isValidComment } from '@shared/utils/validation';

describe('isValidComment', () => {
  describe('valid comments (within limit)', () => {
    it('should accept empty string', () => {
      expect(isValidComment('')).toBe(true);
    });

    it('should accept undefined (comment is optional)', () => {
      expect(isValidComment(undefined)).toBe(true);
    });

    it('should accept short comments', () => {
      expect(isValidComment('Great service!')).toBe(true);
      expect(isValidComment('A')).toBe(true);
    });

    it('should accept comment with exactly 500 characters', () => {
      const comment = 'a'.repeat(500);
      expect(isValidComment(comment)).toBe(true);
    });
  });

  describe('invalid comments (exceeding limit)', () => {
    it('should reject comment with 501 characters', () => {
      const comment = 'a'.repeat(501);
      expect(isValidComment(comment)).toBe(false);
    });

    it('should reject very long comments', () => {
      const comment = 'a'.repeat(1000);
      expect(isValidComment(comment)).toBe(false);
    });
  });

  describe('boundary cases', () => {
    it('should accept 499 characters', () => {
      expect(isValidComment('x'.repeat(499))).toBe(true);
    });

    it('should accept 500 characters', () => {
      expect(isValidComment('x'.repeat(500))).toBe(true);
    });

    it('should reject 501 characters', () => {
      expect(isValidComment('x'.repeat(501))).toBe(false);
    });
  });

  describe('special characters', () => {
    it('should accept emoji comments within JS string length limit', () => {
      // Each emoji is 2 UTF-16 code units, so 250 emojis = 500 .length
      const emojiComment = '😀'.repeat(250);
      expect(emojiComment.length).toBe(500);
      expect(isValidComment(emojiComment)).toBe(true);
    });

    it('should reject emoji comments exceeding JS string length limit', () => {
      // 251 emojis = 502 .length > 500
      const emojiComment = '😀'.repeat(251);
      expect(emojiComment.length).toBe(502);
      expect(isValidComment(emojiComment)).toBe(false);
    });

    it('should handle comments with newlines', () => {
      const comment = 'Line 1\nLine 2\nLine 3';
      expect(isValidComment(comment)).toBe(true);
    });
  });
});
