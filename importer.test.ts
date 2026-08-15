import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ReviewImporter, Review } from '../src/importer/importer.js';

describe('ReviewImporter Ingestion & Validation Tests', () => {
  const testDir = path.resolve('tests/temp');
  const validJsonPath = path.join(testDir, 'valid_reviews.json');
  const malformedJsonPath = path.join(testDir, 'malformed_reviews.json');
  const importer = new ReviewImporter();

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Write a temp file with valid reviews
    const validReviews: Review[] = [
      {
        source: 'App Store',
        rating: 5,
        title: 'Perfect app',
        text: 'Very easy to log in and make deposits and transfers.',
        date: '2026-07-10T12:00:00Z',
        version: '1.2.0'
      },
      {
        source: 'Play Store',
        rating: 4,
        title: 'Good support',
        text: 'The support team helped me verify my KYC verification quickly.',
        date: '2026-07-01T15:00:00Z',
        version: '1.1.9'
      }
    ];
    fs.writeFileSync(validJsonPath, JSON.stringify(validReviews, null, 2));

    // Write a temp file containing some malformed reviews
    const malformedReviews = [
      {
        source: 'App Store',
        rating: 5,
        title: 'Valid One',
        text: 'This is a valid review containing more than eight words to pass check.',
        date: '2026-07-15T09:00:00Z'
      },
      {
        // Malformed: missing text
        source: 'Play Store',
        rating: 2,
        title: 'Invalid',
        date: '2026-07-14T09:00:00Z'
      },
      {
        // Malformed: invalid rating (6)
        source: 'App Store',
        rating: 6,
        title: 'Invalid Rating',
        text: 'This review text is long enough but the rating is too high.',
        date: '2026-07-13T09:00:00Z'
      },
      {
        // Malformed: invalid date
        source: 'Play Store',
        rating: 3,
        title: 'Invalid Date',
        text: 'This review has an invalid date format and should be filtered.',
        date: 'not-a-date'
      }
    ];
    fs.writeFileSync(malformedJsonPath, JSON.stringify(malformedReviews, null, 2));
  });

  afterAll(() => {
    // Clean up temp test directory
    if (fs.existsSync(validJsonPath)) fs.unlinkSync(validJsonPath);
    if (fs.existsSync(malformedJsonPath)) fs.unlinkSync(malformedJsonPath);
    if (fs.existsSync(path.join(testDir, 'hindi_reviews.json'))) {
      fs.unlinkSync(path.join(testDir, 'hindi_reviews.json'));
    }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmdirSync(testDir);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') {
          throw error;
        }
      }
    }
  });

  it('should import all valid reviews successfully', () => {
    const reviews = importer.importReviews(validJsonPath);
    expect(reviews).toHaveLength(2);
    expect(reviews[0].source).toBe('App Store');
    expect(reviews[0].rating).toBe(5);
    expect(reviews[1].source).toBe('Play Store');
    expect(reviews[1].rating).toBe(4);
  });

  it('should filter out and log invalid reviews while parsing malformed file', () => {
    const reviews = importer.importReviews(malformedJsonPath);
    // Only 1 of 4 reviews is valid
    expect(reviews).toHaveLength(1);
    expect(reviews[0].title).toBe('Valid One');
  });

  it('should throw an error if file does not exist', () => {
    expect(() => importer.importReviews(path.join(testDir, 'does_not_exist.json'))).toThrow();
  });

  it('should correctly filter reviews by timeframe (weeks)', () => {
    const reviews: Review[] = [
      {
        source: 'App Store',
        rating: 5,
        text: 'This is a recent review from 1 week ago.',
        date: '2026-07-10T12:00:00Z' // ~6 days before reference
      },
      {
        source: 'Play Store',
        rating: 4,
        text: 'This is a recent review from 10 weeks ago.',
        date: '2026-05-15T12:00:00Z' // ~62 days before reference (approx 9 weeks)
      },
      {
        source: 'App Store',
        rating: 3,
        text: 'This is an older review from 15 weeks ago.',
        date: '2026-03-20T12:00:00Z' // ~118 days before reference (approx 17 weeks)
      }
    ];

    const referenceDate = new Date('2026-07-16T12:00:00Z');
    
    // Filter by 12 weeks: should retain the first two reviews
    const filtered = importer.filterReviewsByWeeks(reviews, 12, referenceDate);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.text)).toContain('This is a recent review from 1 week ago.');
    expect(filtered.map(r => r.text)).toContain('This is a recent review from 10 weeks ago.');
    expect(filtered.map(r => r.text)).not.toContain('This is an older review from 15 weeks ago.');
  });

  it('should reject reviews containing Devanagari script (Hindi)', () => {
    const jsonPath = path.join(testDir, 'hindi_reviews.json');
    const reviews = [
      {
        source: 'Play Store',
        rating: 5,
        text: 'बहुत अच्छा ऐप है, मुझे बहुत पसंद आया।', // Hindi (Devanagari)
        date: '2026-07-15T12:00:00Z'
      },
      {
        source: 'App Store',
        rating: 4,
        text: 'This is a clean English review with more than eight words.', // Valid English
        date: '2026-07-15T12:00:00Z'
      }
    ];
    fs.writeFileSync(jsonPath, JSON.stringify(reviews, null, 2));
    const result = importer.importReviews(jsonPath);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('App Store');
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
  });
});
