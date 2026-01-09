import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayState } from '@prisma/client';

@Injectable()
export class DaysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize a date to the start of the day (midnight)
   */
  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * Get today's day, create if it doesn't exist
   */
  async getToday(userId: string) {
    const today = this.normalizeDate(new Date());

    let day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1, // Get first message for preview
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!day) {
      day = await this.prisma.day.create({
        data: {
          userId,
          date: today,
          state: DayState.START,
        },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' },
          },
          conversations: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              _count: {
                select: { messages: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return day;
  }

  /**
   * Start the day - change to ACTIVE state and set startedAt
   */
  async start(userId: string) {
    const today = this.normalizeDate(new Date());

    const day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!day) {
      // If day doesn't exist, create it in ACTIVE state
      return this.prisma.day.create({
        data: {
          userId,
          date: today,
          state: DayState.ACTIVE,
          startedAt: new Date(),
        },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' },
          },
          conversations: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              _count: {
                select: { messages: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return this.prisma.day.update({
      where: { id: day.id },
      data: {
        state: DayState.ACTIVE,
        startedAt: day.startedAt || new Date(),
      },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * End the day - change to END state and set endedAt
   */
  async end(userId: string) {
    const today = this.normalizeDate(new Date());

    const day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!day) {
      // If day doesn't exist, create it in END state
      return this.prisma.day.create({
        data: {
          userId,
          date: today,
          state: DayState.END,
          endedAt: new Date(),
        },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' },
          },
          conversations: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              _count: {
                select: { messages: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return this.prisma.day.update({
      where: { id: day.id },
      data: {
        state: DayState.END,
        endedAt: new Date(),
      },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get day summary with conversations and completion status
   */
  async getSummary(userId: string) {
    const today = this.normalizeDate(new Date());

    const day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          include: {
            goal: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!day) {
      // If day doesn't exist, return empty summary
      return {
        day: null,
        conversations: [],
        taskSummary: {
          total: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          completionRate: 0,
        },
      };
    }

    // Calculate task completion status
    const totalTasks = day.tasks.length;
    const todoTasks = day.tasks.filter(t => t.status === 'TODO').length;
    const inProgressTasks = day.tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneTasks = day.tasks.filter(t => t.status === 'DONE').length;
    const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

    return {
      day: {
        id: day.id,
        date: day.date,
        state: day.state,
        startedAt: day.startedAt,
        endedAt: day.endedAt,
        createdAt: day.createdAt,
      },
      conversations: day.conversations.map(conv => ({
        id: conv.id,
        mode: conv.mode,
        state: conv.state,
        type: conv.type,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      taskSummary: {
        total: totalTasks,
        todo: todoTasks,
        inProgress: inProgressTasks,
        done: doneTasks,
        completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
      },
      tasks: day.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        goal: task.goal,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    };
  }
}
