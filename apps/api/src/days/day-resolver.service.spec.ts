import { DayResolverService } from './day-resolver.service';

describe('DayResolverService', () => {
  const createPrismaMock = () =>
    ({
      userProfile: {
        findUnique: jest.fn(),
      },
      day: {
        upsert: jest.fn(),
      },
    }) as any;

  it('resolves day boundaries by user timezone', async () => {
    const prisma = createPrismaMock();
    prisma.userProfile.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
    prisma.day.upsert.mockImplementation(({ where }: { where: { userId_date: { date: Date } } }) =>
      Promise.resolve({ id: 'day-1', date: where.userId_date.date }),
    );

    const service = new DayResolverService(prisma);
    await service.getDayForMoment('user-1', new Date('2026-04-10T03:59:00.000Z'));
    await service.getDayForMoment('user-1', new Date('2026-04-10T04:01:00.000Z'));

    expect(prisma.day.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId_date: {
            userId: 'user-1',
            date: new Date('2026-04-09T00:00:00.000Z'),
          },
        },
      }),
    );
    expect(prisma.day.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId_date: {
            userId: 'user-1',
            date: new Date('2026-04-10T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('uses upsert to avoid duplicate day rows', async () => {
    const prisma = createPrismaMock();
    prisma.userProfile.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.day.upsert.mockResolvedValue({
      id: 'day-1',
      date: new Date('2026-04-10T00:00:00.000Z'),
    });

    const service = new DayResolverService(prisma);
    await service.getDayForMoment('user-1', new Date('2026-04-10T12:00:00.000Z'));
    await service.getDayForMoment('user-1', new Date('2026-04-10T18:00:00.000Z'));

    const firstCall = prisma.day.upsert.mock.calls[0][0];
    const secondCall = prisma.day.upsert.mock.calls[1][0];
    expect(firstCall.where.userId_date).toEqual(secondCall.where.userId_date);
  });
});
