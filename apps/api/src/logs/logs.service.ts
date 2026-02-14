import { Injectable } from '@nestjs/common';
import { ConversationMode } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new AI log entry
   */
  async create(
    userId: string,
    mode: ConversationMode,
    prompt: string,
    response: string,
    actions: unknown[],
  ) {
    return this.prisma.aiLog.create({
      data: {
        userId,
        mode,
        prompt,
        response,
        actions: actions as any,
      },
    });
  }

  /**
   * Get paginated logs for a user
   */
  async findAll(userId: string, page: number = 1, limit: number = 20, mode?: ConversationMode) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (mode) {
      where.mode = mode;
    }

    const [logs, total] = await Promise.all([
      this.prisma.aiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single log by ID
   */
  async findOne(userId: string, id: string) {
    return this.prisma.aiLog.findFirst({
      where: { id, userId },
    });
  }
}
