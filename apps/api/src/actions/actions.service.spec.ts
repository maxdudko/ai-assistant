import { BadRequestException } from '@nestjs/common';

import { ActionsService } from './actions.service';

describe('ActionsService', () => {
  const createService = () => {
    const prisma = {
      actionCandidate: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data, where }) =>
          Promise.resolve({
            id: where.id ?? 'action-1',
            ...data,
          }),
        ),
      },
      actionExecutionLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
    const executor = {
      execute: jest.fn(),
    } as any;
    return {
      service: new ActionsService(prisma, executor),
      prisma,
    };
  };

  it('creates a candidate through the single entry point', async () => {
    const { service, prisma } = createService();
    const candidate = await service.createCandidate(
      'user-1',
      {
        id: '302f8910-95f8-4685-a86e-4d1f1902f7f8',
        type: 'SIMPLIFY_DAY',
        payload: { dayId: 'day-1' },
        confidence: 0.8,
        requiresConfirmation: true,
      },
      { conversationId: 'conv-1' },
    );

    expect(candidate.type).toBe('SIMPLIFY_DAY');
    expect(prisma.actionCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          conversationId: 'conv-1',
          type: 'SIMPLIFY_DAY',
        }),
      }),
    );
  });

  it('rejects invalid candidate payloads', async () => {
    const { service } = createService();
    await expect(
      service.createCandidate(
        'user-1',
        {
          id: '302f8910-95f8-4685-a86e-4d1f1902f7f8',
          type: 'SIMPLIFY_DAY',
          payload: {},
          confidence: 0.8,
          requiresConfirmation: true,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks action as executed when executor succeeds', async () => {
    const { service, prisma } = createService();
    prisma.actionCandidate.findFirst.mockResolvedValue({
      id: 'action-1',
      userId: 'user-1',
      type: 'TASK_COMPLETE',
      payload: { taskId: 'task-1' },
      confidence: 0.8,
      requiresConfirmation: true,
      status: 'PENDING',
    });

    const result = await service.confirmAction('user-1', 'action-1');

    expect(result.status).toBe('EXECUTED');
    expect(prisma.actionCandidate.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: { status: 'EXECUTED' },
    });
  });
});
