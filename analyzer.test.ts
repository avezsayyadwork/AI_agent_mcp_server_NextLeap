import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMAnalyzer, LlamaRateLimiter, sampleReviews, estimateTokens } from '../src/analyzer/analyzer.js';
import { Review } from '../src/importer/importer.js';

describe('LLMAnalyzer & Rate Limiter Tests', () => {
  
  describe('estimateTokens', () => {
    it('should estimate token counts based on length and words', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('hello')).toBe(2); // max(ceil(5/4)=2, ceil(1*1.3)=2)
      expect(estimateTokens('hello world')).toBe(3); // max(ceil(11/4)=3, ceil(2*1.3)=3)
    });
  });

  describe('sampleReviews Stratified Representative Sampling', () => {
    const createMockReviews = (playCount: number, appCount: number, rating1: number, rating5: number): Review[] => {
      const list: Review[] = [];
      const referenceDate = '2026-07-16T12:00:00.000Z';
      
      // Play Store reviews
      for (let i = 0; i < playCount; i++) {
        list.push({
          source: 'Play Store',
          rating: i < rating1 ? 1 : 5,
          text: `Play Store review item of index ${i} with extra text to make it longer`,
          date: referenceDate
        });
      }
      // App Store reviews
      for (let i = 0; i < appCount; i++) {
        list.push({
          source: 'App Store',
          rating: i < rating1 ? 1 : 5,
          text: `App Store review item of index ${i} with extra text to make it longer`,
          date: referenceDate
        });
      }
      return list;
    };

    it('should maintain ratios when downsampling', () => {
      // 80% Play Store, 20% App Store. 50% 1-star, 50% 5-star
      const reviews = createMockReviews(8, 2, 4, 4);
      expect(reviews).toHaveLength(10);

      const sampled = sampleReviews(reviews, 5);
      expect(sampled).toHaveLength(5);

      const playStoreSampled = sampled.filter(r => r.source === 'Play Store');
      const appStoreSampled = sampled.filter(r => r.source === 'App Store');
      expect(playStoreSampled.length).toBeGreaterThanOrEqual(3);
      expect(appStoreSampled.length).toBeLessThanOrEqual(2);
    });

    it('should prefer longer (more informative) reviews from the same group', () => {
      const groupReviews: Review[] = [
        { source: 'Play Store', rating: 5, text: 'Short text', date: '2026-07-16T12:00:00Z' },
        { source: 'Play Store', rating: 5, text: 'This is a much longer and more informative review', date: '2026-07-16T12:00:00Z' }
      ];

      const sampled = sampleReviews(groupReviews, 1);
      expect(sampled).toHaveLength(1);
      expect(sampled[0].text).toBe('This is a much longer and more informative review');
    });
  });

  describe('LlamaRateLimiter', () => {
    let limiter: LlamaRateLimiter;

    beforeEach(() => {
      limiter = new LlamaRateLimiter();
    });

    it('should allow requests when quota is available', async () => {
      const start = Date.now();
      await limiter.waitForQuota(100);
      limiter.recordRequest(100);
      expect(Date.now() - start).toBeLessThan(50);
    });

    it('should queue and delay requests when TPM limit is reached', async () => {
      // Consume 950 tokens
      limiter.recordRequest(950);

      // Next request of 100 tokens will exceed 1000 TPM limit
      const start = Date.now();
      
      // We spy on setTimeout to ensure it waits
      const spyTimeout = vi.spyOn(global, 'setTimeout');
      
      const promise = limiter.waitForQuota(100);
      
      // Fast-forward or check if setTimeout was called
      expect(spyTimeout).toHaveBeenCalled();
      
      spyTimeout.mockRestore();
    });
  });

  describe('LLMAnalyzer analyze', () => {
    it('should fall back to self-contained mock mode if no api keys exist', async () => {
      const oldKeys = { ...process.env };
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const analyzer = new LLMAnalyzer();
      const mockReviews: Review[] = [
        { source: 'Play Store', rating: 1, text: 'I am stuck on KYC verification and onboarding delays.', date: '2026-07-16T12:00:00Z' },
        { source: 'App Store', rating: 2, text: 'Transfer speed is slow, delay of days on transactions.', date: '2026-07-16T12:00:00Z' },
        { source: 'Play Store', rating: 5, text: 'Fees are quite low and reasonable cost.', date: '2026-07-16T12:00:00Z' }
      ];

      const report = await analyzer.analyze(mockReviews);
      expect(report.meta.totalReviewsAnalyzed).toBe(3);
      expect(report.themes).toHaveLength(3);
      expect(report.verbatimQuotes).toHaveLength(3);
      expect(report.actionIdeas).toHaveLength(3);

      // Verify that mock themes are correctly mapped from keyword matches
      expect(report.themes.map(t => t.name)).toContain('Account Verification & KYC');
      expect(report.themes.map(t => t.name)).toContain('Transfer Latency & Speed');
      expect(report.themes.map(t => t.name)).toContain('Fees & Exchange Rates');

      // Verify quotes are verbatim from inputs
      expect(mockReviews.map(r => r.text)).toContain(report.verbatimQuotes[0]);

      process.env = oldKeys;
    });

    it('should call fetch and validate JSON output when API key is set', async () => {
      const oldKeys = { ...process.env };
      process.env.GROQ_API_KEY = 'mock_groq_key';
      delete process.env.GEMINI_API_KEY;

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                themes: [
                  { name: "Account Verification & KYC", sentiment: "Negative", percentage: 50 },
                  { name: "Transfer Latency & Speed", sentiment: "Mixed", percentage: 30 },
                  { name: "Fees & Exchange Rates", sentiment: "Positive", percentage: 20 }
                ],
                verbatimQuotes: [
                  "Verify onboarding delays",
                  "Transfer speed is slow",
                  "Fees are reasonable"
                ],
                actionIdeas: [
                  "Fix KYC delays",
                  "Fix speeds",
                  "Lower fees"
                ]
              })
            }
          }
        ],
        usage: {
          total_tokens: 650
        }
      };

      const spyFetch = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => mockResponse
        } as Response;
      });

      const analyzer = new LLMAnalyzer();
      const mockReviews: Review[] = [
        { source: 'Play Store', rating: 1, text: 'Verify onboarding delays', date: '2026-07-16T12:00:00Z' },
        { source: 'App Store', rating: 2, text: 'Transfer speed is slow', date: '2026-07-16T12:00:00Z' },
        { source: 'Play Store', rating: 5, text: 'Fees are reasonable', date: '2026-07-16T12:00:00Z' }
      ];

      const report = await analyzer.analyze(mockReviews);
      expect(spyFetch).toHaveBeenCalled();
      expect(report.themes).toHaveLength(3);
      expect(report.verbatimQuotes).toContain('Verify onboarding delays');
      expect(analyzer.getLimiter().getHistory()[0].tokens).toBe(650);

      spyFetch.mockRestore();
      process.env = oldKeys;
    });
  });
});
