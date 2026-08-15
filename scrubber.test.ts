import { describe, it, expect } from 'vitest';
import { PiiScrubber } from '../src/scrubber/scrubber.js';
import { Review } from '../src/importer/importer.js';

describe('PiiScrubber Tests', () => {
  const scrubber = new PiiScrubber();

  it('should redact email addresses', () => {
    const text = 'Hello, please email me at contact-us.test_123@sub.domain.co.uk for details.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('Hello, please email me at [REDACTED_EMAIL] for details.');
  });

  it('should redact usernames starting with @', () => {
    const text = 'Please reach out to @anita_smith-123 or @john.doe for verification.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('Please reach out to [REDACTED_USER] or [REDACTED_USER] for verification.');
  });

  it('should redact UUIDs', () => {
    const text = 'My user session ID is f81d4fae-7dec-11d0-a765-00a0c91e6bf6.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('My user session ID is [REDACTED_ID].');
  });

  it('should redact IPv4 and IPv6 addresses', () => {
    const text = 'Connected from 192.168.1.100 and ipv6 2001:0db8:85a3:0000:0000:8a2e:0370:7334.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('Connected from [REDACTED_IP] and ipv6 [REDACTED_IP].');
  });

  it('should redact standard format phone numbers', () => {
    const text = 'Call me at +1-234-567-8901 or (123) 456-7890 or 1234567890.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('Call me at [REDACTED_PHONE] or [REDACTED_PHONE] or [REDACTED_PHONE].');
  });

  it('should redact sneaky word-based phone numbers', () => {
    const text = 'Call me at nine one seven 555 zero one two three or nine-one-seven-five-five-five-zero-one-two-three.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('Call me at [REDACTED_PHONE] or [REDACTED_PHONE].');
  });

  it('should redact long system IDs (10+ digits or 12+ hex characters)', () => {
    const text = 'My customer account is 100004829103 and device is a1b2c3d4e5f6a1b2.';
    const result = scrubber.scrubText(text);
    expect(result).toBe('My customer account is [REDACTED_ID] and device is [REDACTED_ID].');
  });

  it('should scrub whole Review objects', () => {
    const review: Review = {
      source: 'Play Store',
      rating: 1,
      title: 'KYC failed for user@example.com',
      text: 'My phone number is 9876543210 and I need help.',
      date: '2026-07-16T12:00:00Z',
      version: '1.0.0'
    };

    const scrubbed = scrubber.scrubReview(review);
    expect(scrubbed.title).toBe('KYC failed for [REDACTED_EMAIL]');
    expect(scrubbed.text).toBe('My phone number is [REDACTED_PHONE] and I need help.');
    expect(scrubbed.source).toBe(review.source);
    expect(scrubbed.rating).toBe(review.rating);
    expect(scrubbed.date).toBe(review.date);
    expect(scrubbed.version).toBe(review.version);
  });
});
