import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['neutral', 'friendly', 'professional', 'casual', 'humorous', 'empathetic'])
  tone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['short', 'normal', 'detailed', 'low', 'medium', 'high'])
  verbosity?: string;

  @IsOptional()
  @IsBoolean()
  useEmoji?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['day-planning', 'task-tracking', 'reflection', 'mixed'])
  primaryUseCase?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'passive'])
  helpStyle?: string;

  @IsOptional()
  @IsString()
  @IsIn(['morning', 'evening', 'anytime'])
  dayPlanningTime?: string;

  @IsOptional()
  @IsString()
  @IsIn(['morning', 'evening', 'anytime'])
  reflectionTime?: string;

  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;
}
