import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        content: true,
        importance: true,
        tags: true,
        source: true,
        dayId: true,
        conversationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException(`Memory with ID ${id} not found`);
    }

    if (memory.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this memory');
    }

    await this.prisma.memory.delete({
      where: { id },
    });

    return { success: true };
  }
}
