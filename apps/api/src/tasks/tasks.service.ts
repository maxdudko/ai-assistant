import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create today's day for a user
   */
  private async getOrCreateTodayDay(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!day) {
      day = await this.prisma.day.create({
        data: {
          userId,
          date: today,
          state: 'START',
        },
      });
    }

    return day.id;
  }

  async create(userId: string, createTaskDto: CreateTaskDto) {
    const data: any = {
      userId,
      name: createTaskDto.name,
      description: createTaskDto.description,
      status: createTaskDto.status || 'TODO',
      priority: createTaskDto.priority || 'MEDIUM',
      source: createTaskDto.source || 'MANUAL',
    };

    if (createTaskDto.deadline) {
      data.deadline = new Date(createTaskDto.deadline);
    }

    if (createTaskDto.conversationId) {
      data.conversationId = createTaskDto.conversationId;
    }

    if (createTaskDto.parentId) {
      // Verify parent task exists and belongs to user
      const parent = await this.prisma.task.findFirst({
        where: { id: createTaskDto.parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found');
      }
      data.parentId = createTaskDto.parentId;
    }

    if (createTaskDto.goalId) {
      // Verify goal exists and belongs to user
      const goal = await this.prisma.goal.findFirst({
        where: { id: createTaskDto.goalId, userId },
      });
      if (!goal) {
        throw new NotFoundException('Goal not found');
      }
      data.goalId = createTaskDto.goalId;
    }

    // Automatically link to today's day if dayId is not provided
    if (createTaskDto.dayId) {
      // Verify day exists and belongs to user
      const day = await this.prisma.day.findFirst({
        where: { id: createTaskDto.dayId, userId },
      });
      if (!day) {
        throw new NotFoundException('Day not found');
      }
      data.dayId = createTaskDto.dayId;
    } else {
      // Auto-link to today's day
      data.dayId = await this.getOrCreateTodayDay(userId);
    }

    return this.prisma.task.create({
      data,
      include: {
        conversation: true,
        parent: true,
        subtasks: true,
        goal: true,
        day: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      include: {
        conversation: true,
        parent: true,
        subtasks: true,
        goal: true,
        day: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        conversation: true,
        parent: true,
        subtasks: true,
        goal: true,
        day: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(userId: string, id: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const data: any = {};

    if (updateTaskDto.name !== undefined) {
      data.name = updateTaskDto.name;
    }
    if (updateTaskDto.description !== undefined) {
      data.description = updateTaskDto.description;
    }
    if (updateTaskDto.status !== undefined) {
      data.status = updateTaskDto.status;
    }
    if (updateTaskDto.priority !== undefined) {
      data.priority = updateTaskDto.priority;
    }
    if (updateTaskDto.deadline !== undefined) {
      data.deadline = updateTaskDto.deadline ? new Date(updateTaskDto.deadline) : null;
    }
    if (updateTaskDto.parentId !== undefined) {
      if (updateTaskDto.parentId) {
        // Verify parent task exists and belongs to user
        const parent = await this.prisma.task.findFirst({
          where: { id: updateTaskDto.parentId, userId },
        });
        if (!parent) {
          throw new NotFoundException('Parent task not found');
        }
        // Prevent circular references
        if (updateTaskDto.parentId === id) {
          throw new Error('Task cannot be its own parent');
        }
      }
      data.parentId = updateTaskDto.parentId || null;
    }
    if (updateTaskDto.goalId !== undefined) {
      if (updateTaskDto.goalId) {
        // Verify goal exists and belongs to user
        const goal = await this.prisma.goal.findFirst({
          where: { id: updateTaskDto.goalId, userId },
        });
        if (!goal) {
          throw new NotFoundException('Goal not found');
        }
      }
      data.goalId = updateTaskDto.goalId || null;
    }
    if (updateTaskDto.dayId !== undefined) {
      if (updateTaskDto.dayId) {
        // Verify day exists and belongs to user
        const day = await this.prisma.day.findFirst({
          where: { id: updateTaskDto.dayId, userId },
        });
        if (!day) {
          throw new NotFoundException('Day not found');
        }
      }
      data.dayId = updateTaskDto.dayId || null;
    }

    return this.prisma.task.update({
      where: { id },
      data,
      include: {
        conversation: true,
        parent: true,
        subtasks: true,
        goal: true,
        day: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.task.delete({
      where: { id },
    });
  }
}
