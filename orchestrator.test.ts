import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineOrchestrator } from '../src/orchestrator/orchestrator.js';

const { importReviewsMock, scrubReviewsMock, analyzeMock, connectToDocsMock, connectToGmailMock, createDocMock, createDraftMock, closeMock } = vi.hoisted(() => ({
  importReviewsMock: vi.fn(),
  scrubReviewsMock: vi.fn(),
  analyzeMock: vi.fn(),
  connectToDocsMock: vi.fn(),
  connectToGmailMock: vi.fn(),
  createDocMock: vi.fn(),
  createDraftMock: vi.fn(),
  closeMock: vi.fn()
}));

vi.mock('../src/importer/importer.js', () => ({
  ReviewImporter: class {
    importReviews = importReviewsMock;
  }
}));

vi.mock('../src/scrubber/scrubber.js', () => ({
  PiiScrubber: class {
    scrubReviews = scrubReviewsMock;
  }
}));

vi.mock('../src/analyzer/analyzer.js', () => ({
  LLMAnalyzer: class {
    analyze = analyzeMock;
  }
}));

vi.mock('../src/mcp/mcpClient.js', () => ({
  McpClientBridge: class {
    connectToDocs = connectToDocsMock;
    connectToGmail = connectToGmailMock;
    createDoc = createDocMock;
    createDraft = createDraftMock;
    close = closeMock;
  }
}));

describe('PipelineOrchestrator', () => {
  const tempReviewPath = path.resolve('tests/temp/orchestrator_reviews.json');
  const draftPath = path.resolve('pulse_draft.json');

  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(path.dirname(tempReviewPath), { recursive: true });
    fs.writeFileSync(tempReviewPath, JSON.stringify([{ source: 'Play Store', rating: 2, text: 'The app is too slow to verify my account.', date: '2026-07-10', version: '1.2.3' }], null, 2));
  });

  afterEach(() => {
    if (fs.existsSync(tempReviewPath)) {
      fs.unlinkSync(tempReviewPath);
    }
    if (fs.existsSync(draftPath)) {
      fs.unlinkSync(draftPath);
    }
  });

  it('runs the full integrated pulse workflow and formats the outgoing content', async () => {
    const importedReviews = [{ source: 'Play Store', rating: 2, text: 'The app is too slow to verify my account.', date: '2026-07-10', version: '1.2.3' }];
    const scrubbedReviews = [{ ...importedReviews[0], text: 'The app is too slow to verify my account.' }];
    const report = {
      meta: { weekEnding: '2026-07-17', totalReviewsAnalyzed: 1 },
      themes: [{ name: 'Account Verification & KYC', sentiment: 'Negative', percentage: 100 }],
      verbatimQuotes: ['The app is too slow to verify my account.'],
      actionIdeas: ['Simplify verification steps.']
    };

    importReviewsMock.mockReturnValue(importedReviews);
    scrubReviewsMock.mockReturnValue(scrubbedReviews);
    analyzeMock.mockResolvedValue(report);
    createDocMock.mockResolvedValue('doc-123');
    createDraftMock.mockResolvedValue('draft-456');

    const orchestrator = new PipelineOrchestrator();
    await orchestrator.run(tempReviewPath, 'docs-server', 'gmail-server', 'owner@example.com');

    expect(importReviewsMock).toHaveBeenCalledWith(tempReviewPath);
    expect(scrubReviewsMock).toHaveBeenCalledWith(importedReviews);
    expect(analyzeMock).toHaveBeenCalledWith(scrubbedReviews);
    expect(connectToDocsMock).toHaveBeenCalledWith('docs-server');
    expect(connectToGmailMock).toHaveBeenCalledWith('gmail-server');
    expect(createDocMock).toHaveBeenCalledWith(
      expect.stringContaining('Weekly Feedback Pulse'),
      expect.stringContaining('## Top Themes')
    );
    expect(createDraftMock).toHaveBeenCalledWith(
      'owner@example.com',
      expect.stringContaining('Weekly Feedback Pulse'),
      expect.stringContaining('Top themes')
    );
    expect(fs.existsSync(draftPath)).toBe(true);
    const draftPayload = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
    expect(draftPayload).toEqual(report);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient MCP failures and produces a compliant output', async () => {
    const importedReviews = [{ source: 'Play Store', rating: 2, text: 'The app is too slow to verify my account.', date: '2026-07-10', version: '1.2.3' }];
    const scrubbedReviews = [{ ...importedReviews[0], text: 'The app is too slow to verify my account.' }];
    const oversizedReport = {
      meta: { weekEnding: '2026-07-17', totalReviewsAnalyzed: 1 },
      themes: [
        { name: 'Account Verification & KYC', sentiment: 'Negative', percentage: 40 },
        { name: 'Transfer Latency & Speed', sentiment: 'Negative', percentage: 30 },
        { name: 'Fees & Exchange Rates', sentiment: 'Mixed', percentage: 20 },
        { name: 'Card Features & Usability', sentiment: 'Mixed', percentage: 10 }
      ],
      verbatimQuotes: [
        'user@example.com said the app is very slow and blocked my account for days.',
        'Another quote that is too long and should be shortened for the weekly pulse output.',
        'Third quote with extra details that should not exceed the compliance limit.',
        'Fourth quote that makes the payload too verbose and violates the policy.'
      ],
      actionIdeas: [
        'Add more support contact options for users who are blocked and need immediate assistance with account issues.',
        'Improve latency messaging so customers know when their transfers will complete and why they are delayed.',
        'Clarify fees and exchange rates before confirmation to avoid surprises and reduce complaints.',
        'Improve card usability with better controls and clearer in-app guidance for freezes and virtual cards.'
      ]
    };

    importReviewsMock.mockReturnValue(importedReviews);
    scrubReviewsMock.mockReturnValue(scrubbedReviews);
    analyzeMock.mockResolvedValue(oversizedReport);
    connectToDocsMock.mockRejectedValueOnce(new Error('transient docs failure')).mockResolvedValueOnce(undefined);
    connectToGmailMock.mockResolvedValueOnce(undefined);
    createDocMock.mockResolvedValue('doc-123');
    createDraftMock.mockResolvedValue('draft-456');

    const orchestrator = new PipelineOrchestrator();
    await orchestrator.run(tempReviewPath, 'docs-server', 'gmail-server', 'owner@example.com');

    const docContent = createDocMock.mock.calls[0][1];
    const emailBody = createDraftMock.mock.calls[0][2];
    const wordCount = (docContent + '\n' + emailBody).split(/\s+/).filter(Boolean).length;

    expect(connectToDocsMock).toHaveBeenCalledTimes(2);
    expect(docContent).not.toContain('user@example.com');
    expect(docContent).not.toContain('http://');
    expect(docContent).not.toContain('https://');
    expect(wordCount).toBeLessThanOrEqual(250);
    expect(docContent.match(/^- /gm)).toHaveLength(3);
    expect(emailBody).toContain('Top themes');
  });
});
