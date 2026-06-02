import { DigestService } from './digest.service';

function buildAi(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    generateInfoSearchQuery: jest.fn().mockResolvedValue({ searchQuery: 'topic', topic: 'Topic' }),
    classifyInfoQuery: jest.fn().mockResolvedValue({ mode: 'digest', rewrittenQuery: 'topic' }),
    generateInfoDigestSummary: jest
      .fn()
      .mockResolvedValue({ title: 'Topic update', highlights: ['Item one.', 'Item two.'] }),
    generateTruthLensDigest: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function buildSearch(results: unknown[] = []) {
  return { search: jest.fn().mockResolvedValue(results) };
}

function buildPrisma() {
  return {
    digestSubscription: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('DigestService TruthLens routing', () => {
  beforeEach(() => {
    process.env.TRUTHLENS_V2_ENABLED = 'true';
  });

  it('routes "vs" comparative requests to TruthLens when payload is valid', async () => {
    const truthLensPayload = {
      title: 'Static vs dynamic typing',
      question: 'Which trade-offs matter for a small team?',
      perspectives: [
        {
          label: 'Static',
          claim: 'Earlier feedback and tooling.',
          evidence: ['Compilers catch type mismatches before runtime.'],
          limitations: ['Cost in setup time.'],
        },
        {
          label: 'Dynamic',
          claim: 'Faster prototyping.',
          evidence: ['No need for explicit annotations during exploration.'],
          limitations: ['Harder to refactor at scale.'],
        },
      ],
      consensus: 'Both work well at small scale; constraints emerge as systems grow.',
      openQuestions: ['What is the team size in 12 months?'],
      confidence: 'medium' as const,
    };

    const ai = buildAi({
      generateTruthLensDigest: jest.fn().mockResolvedValue(truthLensPayload),
    });
    const service = new DigestService(
      buildPrisma() as unknown as never,
      ai as unknown as never,
      buildSearch([{ title: 'r', snippet: 's', url: 'u' }]) as unknown as never,
    );

    const result = await service.generateDigest('user-1', 'TypeScript vs JavaScript pros and cons');
    expect(result.mode).toBe('truthlens');
    expect(result.truthLens).toBe(truthLensPayload);
    expect(result.content).toContain('### Static vs dynamic typing');
    expect(result.content).toContain('Confidence');
    expect(ai.generateTruthLensDigest).toHaveBeenCalledTimes(1);
    expect(ai.generateInfoDigestSummary).not.toHaveBeenCalled();
  });

  it('falls back to plain digest when TruthLens generation returns null', async () => {
    const ai = buildAi({
      generateTruthLensDigest: jest.fn().mockResolvedValue(null),
    });
    const service = new DigestService(
      buildPrisma() as unknown as never,
      ai as unknown as never,
      buildSearch([{ title: 'r', snippet: 's', url: 'u' }]) as unknown as never,
    );

    const result = await service.generateDigest('user-1', 'X vs Y opinions');
    expect(result.mode).toBe('digest');
    expect(result.truthLens).toBeUndefined();
    expect(ai.generateInfoDigestSummary).toHaveBeenCalledTimes(1);
  });

  it('uses the plain digest path for neutral information requests', async () => {
    const ai = buildAi();
    const service = new DigestService(
      buildPrisma() as unknown as never,
      ai as unknown as never,
      buildSearch([{ title: 'r', snippet: 's', url: 'u' }]) as unknown as never,
    );

    const result = await service.generateDigest('user-1', 'Updates on the latest AI news');
    expect(result.mode).toBe('digest');
    expect(ai.generateTruthLensDigest).not.toHaveBeenCalled();
  });
});
