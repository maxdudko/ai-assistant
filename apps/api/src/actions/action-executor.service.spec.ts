import { ActionExecutorService } from './action-executor.service';

describe('ActionExecutorService', () => {
  const createService = () => {
    const prisma = {
      task: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
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
    const outcome = await service.execute('user-1', {
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
    expect(outcome).toEqual({ reversible: false, undoPayload: null });
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
    ).resolves.toEqual({ reversible: false, undoPayload: null });

    expect(tasksService.updateStatus).toHaveBeenCalledWith('user-1', 'task-2', 'DONE');
  });

  it('undoes reschedule task back to previous deadline', async () => {
    const { service } = createService() as any;

    await expect(
      service.undo('user-1', 'RESCHEDULE_TASK', {
        taskId: 'task-3',
        previousDeadline: '2026-04-10T09:00:00.000Z',
      }),
    ).resolves.toBeUndefined();

    expect((service as any).prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'task-3', userId: 'user-1' }),
      }),
    );
  });

  it('normalizes natural language deadline values for task creation', async () => {
    const { service, tasksService } = createService();
    await service.execute('user-1', {
      id: 'action-create',
      type: 'TASK_CREATE',
      payload: {
        title: 'Enhanced Memory',
        deadline: 'Today',
        priority: 'Medium',
      },
      confidence: 0.8,
      requiresConfirmation: true,
    });

    expect(tasksService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Enhanced Memory',
        deadline: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('supports snake_case due_date and numeric priority for task creation', async () => {
    const { service, tasksService } = createService();
    await service.execute('user-1', {
      id: 'action-create-2',
      type: 'TASK_CREATE',
      payload: {
        title: 'Smarter Daily Flow',
        due_date: '2026-05-01T00:00:00.000Z',
        priority: 2,
      },
      confidence: 0.9,
      requiresConfirmation: true,
    });

    expect(tasksService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Smarter Daily Flow',
        priority: 'MEDIUM',
        deadline: '2026-05-01T00:00:00.000Z',
      }),
    );
  });

  it('links a task to a goal and produces a reversible undo payload', async () => {
    const { service, tasksService } = createService() as any;
    service.prisma.task.findFirst.mockResolvedValueOnce({
      id: 'task-link-1',
      goalId: null,
    });
    service.prisma.goal = {
      findFirst: jest.fn().mockResolvedValueOnce({ id: 'goal-1' }),
    };

    const outcome = await service.execute('user-1', {
      id: 'action-link-1',
      type: 'TASK_LINK_GOAL',
      payload: {
        taskId: 'task-link-1',
        goalId: 'goal-1',
      },
      confidence: 0.8,
      requiresConfirmation: true,
    });

    expect(tasksService.update).toHaveBeenCalledWith('user-1', 'task-link-1', {
      goalId: 'goal-1',
    });
    expect(outcome.reversible).toBe(true);
    expect(outcome.undoPayload).toEqual(
      expect.objectContaining({
        type: 'TASK_LINK_GOAL',
        taskId: 'task-link-1',
        previousGoalId: null,
      }),
    );
  });

  it('undo of TASK_LINK_GOAL restores the previous goal id', async () => {
    const { service, tasksService } = createService() as any;

    await expect(
      service.undo('user-1', 'TASK_LINK_GOAL', {
        taskId: 'task-link-2',
        previousGoalId: 'goal-old',
      }),
    ).resolves.toBeUndefined();

    expect(tasksService.update).toHaveBeenCalledWith('user-1', 'task-link-2', {
      goalId: 'goal-old',
    });
  });
});
