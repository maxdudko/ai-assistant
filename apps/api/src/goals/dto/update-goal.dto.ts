import { IsString, IsOptional, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { GoalType, GoalPriority } from '@prisma/client';

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsUUID()
  parentId?: string;
}
