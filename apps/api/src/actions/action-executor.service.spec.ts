import { ActionExecutorService } from './action-executor.service';

describe('ActionExecutorService', () => {
  const createService = () => {
    const prisma = {
      task: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        createMany: jest.fn(),
      },
    } as any;
    const tasksService = {
      create: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    } as any;
    const daysService = {
      startDay: jest.fn(),
      endDay: jest.fn(),
    } as any;
    const digestService = {
      subscribeFromSuggestion: jest.fn(),
    } as any;
    const memoryIngestion = {
      ingest: jest.fn().mockResolvedValue(undefined),
    } as any;

    return {
      service: new ActionExecutorService(
        prisma,
        tasksService,
        daysService,
        digestService,
        memoryIngestion,
      ),
      tasksService,
      memoryIngestion,
    };
  };

  it('writes lightweight feedback memory after execution', async () => {
    const { service, tasksService, memoryIngestion } = createService();
    await service.execute('user-1', {
      id: 'action-1',
      type: 'TASK_COMPLETE',
      payload: {
        taskId: 'task-1',
        conversationId: 'conv-1',
      },
      confidence: 0.9,
      requiresConfirmation: true,
    });

    expect(tasksService.updateStatus).toHaveBeenCalledWith('user-1', 'task-1', 'DONE');
    expect(memoryIngestion.ingest).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({
          layer: 'PATTERN',
          importance: 6,
          confidence: 0.9,
        }),
      ]),
      'CONVERSATION',
      expect.objectContaining({ conversationId: 'conv-1' }),
    );
  });

  it('does not fail execution if feedback ingestion fails', async () => {
    const { service, tasksService, memoryIngestion } = createService();
    memoryIngestion.ingest.mockRejectedValueOnce(new Error('embedding timeout'));

    await expect(
      service.execute('user-1', {
        id: 'action-2',
        type: 'TASK_COMPLETE',
        payload: {
          taskId: 'task-2',
          conversationId: 'conv-1',
        },
        confidence: 0.9,
        requiresConfirmation: true,
      }),
    ).resolves.toBeUndefined();

    expect(tasksService.updateStatus).toHaveBeenCalledWith('user-1', 'task-2', 'DONE');
  });
});
