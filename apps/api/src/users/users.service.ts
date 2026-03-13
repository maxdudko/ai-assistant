import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryCandidateDto, MemoryType } from '../memory/dto/memory-candidate.dto';

import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryIngestion: MemoryIngestionService,
  ) {}

  me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async update(userId: string, dto: UpdateMeDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.profile && {
          profile: {
            update: dto.profile,
          },
        }),
      },
      include: { profile: true },
    });

    // When onboarding is completed, persist key profile preferences in long-term memory.
    if (dto.profile?.onboardingCompleted) {
      const candidates = this.buildOnboardingMemoryCandidates(dto.profile);
      if (candidates.length > 0) {
        try {
          await this.memoryIngestion.ingest(userId, candidates, 'ONBOARDING', {});
        } catch (error) {
          this.logger.error('Failed to ingest onboarding memories', error);
        }
      }
    }

    return updatedUser;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: { create: {} },
      },
    });
  }

  private buildOnboardingMemoryCandidates(profile: UpdateProfileDto) {
    const candidates: MemoryCandidateDto[] = [];

    if (profile.displayName?.trim()) {
      candidates.push({
        content: `User prefers to be addressed as ${profile.displayName.trim()}.`,
        type: MemoryType.FACTUAL,
        importance: 8,
        tags: ['onboarding', 'identity'],
        confidence: 0.95,
      });
    }

    if (profile.tone || profile.verbosity) {
      candidates.push({
        content: `Preferred assistant style: tone ${profile.tone || 'neutral'}, verbosity ${profile.verbosity || 'normal'}.`,
        type: MemoryType.FACTUAL,
        importance: 7,
        tags: ['onboarding', 'preferences', 'communication'],
        confidence: 0.9,
      });
    }

    if (profile.primaryUseCase) {
      candidates.push({
        content: `Primary assistant use case is ${profile.primaryUseCase}.`,
        type: MemoryType.FACTUAL,
        importance: 7,
        tags: ['onboarding', 'goals', 'use-case'],
        confidence: 0.9,
      });
    }

    if (profile.helpStyle) {
      candidates.push({
        content: `Preferred help style is ${profile.helpStyle}.`,
        type: MemoryType.FACTUAL,
        importance: 6,
        tags: ['onboarding', 'preferences', 'support-style'],
        confidence: 0.9,
      });
    }

    if (profile.dayPlanningTime || profile.reflectionTime) {
      candidates.push({
        content: `Preferred planning time is ${profile.dayPlanningTime || 'anytime'} and reflection time is ${profile.reflectionTime || 'anytime'}.`,
        type: MemoryType.FACTUAL,
        importance: 6,
        tags: ['onboarding', 'schedule', 'reflection'],
        confidence: 0.85,
      });
    }

    return candidates;
  }
}
