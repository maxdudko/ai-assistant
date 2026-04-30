import { MemoryRetrieverService } from './memory-retriever.service';

describe('MemoryRetrieverService', () => {
  const now = new Date('2026-04-11T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(candidates: any[]) {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue(candidates),
      memory: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;
    const embeddings = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    } as any;

    return {
      service: new MemoryRetrieverService(prisma, embeddings),
      prisma,
      embeddings,
    };
  }

  it('ranks recently used memory above stale memory', async () => {
    const { service } = createService([
      {
        id: 'stale',
        content: 'Stale but similar',
        importance: 7,
        tags: [],
        confidence: 0.8,
        layer: 'SEMANTIC',
        usageCount: 1,
        lastUsedAt: new Date('2026-03-01T10:00:00.000Z'),
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
        distance: 0.2,
      },
      {
        id: 'recent',
        content: 'Recent usage',
        importance: 7,
        tags: [],
        confidence: 0.8,
        layer: 'SEMANTIC',
        usageCount: 1,
        lastUsedAt: new Date('2026-04-11T11:40:00.000Z'),
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        distance: 0.2,
      },
    ]);

    const memories = await service.retrieve('user-1', 'focus', { limit: 2 });

    expect(memories.map(memory => memory.id)).toEqual(['recent', 'stale']);
  });

  it('boosts high-usage memories when relevance is comparable', async () => {
    const { service } = createService([
      {
        id: 'low-usage',
        content: 'Low usage memory',
        importance: 6,
        tags: [],
        confidence: 0.8,
        layer: 'SEMANTIC',
        usageCount: 1,
        lastUsedAt: new Date('2026-04-10T10:00:00.000Z'),
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        distance: 0.2,
      },
      {
        id: 'high-usage',
        content: 'High usage memory',
        importance: 6,
        tags: [],
        confidence: 0.8,
        layer: 'SEMANTIC',
        usageCount: 40,
        lastUsedAt: new Date('2026-04-10T10:00:00.000Z'),
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        distance: 0.2,
      },
    ]);

    const memories = await service.retrieve('user-1', 'planning', { limit: 2 });

    expect(memories.map(memory => memory.id)).toEqual(['high-usage', 'low-usage']);
  });

  it('filters irrelevant memories by distance before reranking', async () => {
    const { service } = createService([
      {
        id: 'near',
        content: 'Near memory',
        importance: 8,
        tags: [],
        confidence: 0.9,
        layer: 'SEMANTIC',
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        distance: 0.3,
      },
      {
        id: 'far',
        content: 'Far memory',
        importance: 10,
        tags: [],
        confidence: 0.9,
        layer: 'SEMANTIC',
        usageCount: 50,
        lastUsedAt: new Date('2026-04-11T11:00:00.000Z'),
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        distance: 0.95,
      },
    ]);

    const memories = await service.retrieve('user-1', 'context', { limit: 2, maxDistance: 0.8 });

    expect(memories).toHaveLength(1);
    expect(memories[0].id).toBe('near');
  });
});
