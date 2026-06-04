import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export class UpdateAdminSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
