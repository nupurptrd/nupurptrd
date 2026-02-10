/**
 * @file AI Service Tests
 * @description Unit tests for AI content validation and helper functions
 */

import { BadRequestException } from '@nestjs/common';

describe('AI Service Utilities', () => {
  describe('content validation', () => {
    const MAX_TITLE_LENGTH = 200;
    const MAX_CONTENT_LENGTH = 50000;

    const validateTitle = (title: string): boolean => {
      if (!title || title.trim().length === 0) {
        throw new BadRequestException('Title is required');
      }
      if (title.length > MAX_TITLE_LENGTH) {
        throw new BadRequestException('Title too long');
      }
      return true;
    };

    const validateContent = (content: string): boolean => {
      if (content && content.length > MAX_CONTENT_LENGTH) {
        throw new BadRequestException('Content too long');
      }
      return true;
    };

    it('should validate title is required', () => {
      expect(() => validateTitle('')).toThrow(BadRequestException);
    });

    it('should enforce maximum title length', () => {
      const longTitle = 'a'.repeat(MAX_TITLE_LENGTH + 1);
      expect(() => validateTitle(longTitle)).toThrow(BadRequestException);
    });

    it('should accept valid titles', () => {
      expect(validateTitle('Valid Episode Title')).toBe(true);
    });

    it('should enforce maximum content length', () => {
      const longContent = 'a'.repeat(MAX_CONTENT_LENGTH + 1);
      expect(() => validateContent(longContent)).toThrow(BadRequestException);
    });

    it('should accept valid content', () => {
      expect(validateContent('Some valid content')).toBe(true);
    });
  });

  describe('error handling', () => {
    const handleApiError = (status: number) => {
      if (status === 429) return { type: 'rate_limit', retryAfter: 60 };
      if (status === 503)
        return { type: 'service_unavailable', retryAfter: 300 };
      if (status === 401 || status === 403)
        return { type: 'auth_error', retryAfter: null };
      return { type: 'unknown', retryAfter: null };
    };

    it('should identify rate limit errors', () => {
      const result = handleApiError(429);
      expect(result.type).toBe('rate_limit');
      expect(result.retryAfter).toBe(60);
    });

    it('should identify service unavailable errors', () => {
      const result = handleApiError(503);
      expect(result.type).toBe('service_unavailable');
    });

    it('should identify auth errors', () => {
      expect(handleApiError(401).type).toBe('auth_error');
      expect(handleApiError(403).type).toBe('auth_error');
    });

    it('should handle unknown errors', () => {
      const result = handleApiError(500);
      expect(result.type).toBe('unknown');
    });
  });
});
