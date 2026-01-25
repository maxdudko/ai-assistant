import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createGoalDto: CreateGoalDto) {
    const data: any = {
      userId,
      name: createGoalDto.name,
      description: createGoalDto.description,
      type: createGoalDto.type || 'SHORT',
      priority: createGoalDto.priority || 'MEDIUM',
      isAchieved: createGoalDto.isAchieved ?? false,
      source: createGoalDto.source || 'MANUAL',
    };

    if (createGoalDto.conversationId) {
      data.conversationId = createGoalDto.conversationId;
    }

    if (createGoalDto.parentId) {
      // Verify parent goal exists and belongs to user
      const parent = await this.prisma.goal.findFirst({
        where: { id: createGoalDto.parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent goal not found');
      }
      data.parentId = createGoalDto.parentId;
    }

    return this.prisma.goal.create({
      data,
      include: {
        conversation: true,
        parent: true,
        subgoals: true,
        tasks: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      include: {
        conversation: true,
        parent: true,
        subgoals: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: {
        conversation: true,
        parent: true,
        subgoals: true,
        tasks: true,
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }

  async update(userId: string, id: string, updateGoalDto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const data: any = {};

    if (updateGoalDto.name !== undefined) {
      data.name = updateGoalDto.name;
    }
    if (updateGoalDto.description !== undefined) {
      data.description = updateGoalDto.description;
    }
    if (updateGoalDto.type !== undefined) {
      data.type = updateGoalDto.type;
    }
    if (updateGoalDto.priority !== undefined) {
      data.priority = updateGoalDto.priority;
    }
    if (updateGoalDto.isAchieved !== undefined) {
      data.isAchieved = updateGoalDto.isAchieved;
    }
    if (updateGoalDto.parentId !== undefined) {
      if (updateGoalDto.parentId) {
        // Verify parent goal exists and belongs to user
        const parent = await this.prisma.goal.findFirst({
          where: { id: updateGoalDto.parentId, userId },
        });
        if (!parent) {
          throw new NotFoundException('Parent goal not found');
        }
        // Prevent circular references
        if (updateGoalDto.parentId === id) {
          throw new Error('Goal cannot be its own parent');
        }
      }
      data.parentId = updateGoalDto.parentId || null;
    }

    return this.prisma.goal.update({
      where: { id },
      data,
      include: {
        conversation: true,
        parent: true,
        subgoals: true,
        tasks: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return this.prisma.goal.delete({
      where: { id },
    });
  }
}
