import { IsString, IsOptional, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { GoalType, GoalPriority, GoalSource } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @IsOptional()
  @IsBoolean()
  isAchieved?: boolean;

  @IsOptional()
  @IsEnum(GoalSource)
  source?: GoalSource;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
