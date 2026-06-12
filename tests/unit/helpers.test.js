import { describe, it, expect } from 'vitest';
const { formatTime, escapeHtml, decodeHtmlEntities } = require('../../helpers.js');

describe('helpers.js unit tests', () => {
  
  describe('formatTime', () => {
    it('should format seconds to M:SS (no hours)', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(5.123)).toBe('0:05');
      expect(formatTime(59.99)).toBe('0:59');
      expect(formatTime(65.5)).toBe('1:05');
      expect(formatTime(119)).toBe('1:59');
    });

    it('should format hours correctly (H:MM:SS)', () => {
      expect(formatTime(3600)).toBe('1:00:00');
      expect(formatTime(3661.05)).toBe('1:01:01');
      expect(formatTime(7322.9)).toBe('2:02:02');
    });

    it('should handle null/undefined gracefully', () => {
      expect(formatTime(null)).toBe('0:00');
      expect(formatTime(undefined)).toBe('0:00');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML tags and special characters', () => {
      expect(escapeHtml('<div>Hello World</div>')).toBe('&lt;div&gt;Hello World&lt;/div&gt;');
      expect(escapeHtml('Click & Win "Prize"')).toBe('Click &amp; Win &quot;Prize&quot;');
      expect(escapeHtml("It's beautiful")).toBe('It&#039;s beautiful');
    });

    it('should return empty string if empty string passed', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('decodeHtmlEntities', () => {
    it('should decode entities correctly using document textarea', () => {
      expect(decodeHtmlEntities('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;')).toBe('<div>Hello & "World"</div>');
      expect(decodeHtmlEntities('&#039;')).toBe("'");
    });
  });
});
