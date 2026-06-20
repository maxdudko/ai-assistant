import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  morningBriefingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  eveningReflectionEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  nudgesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyInsightEnabled?: boolean;
}
