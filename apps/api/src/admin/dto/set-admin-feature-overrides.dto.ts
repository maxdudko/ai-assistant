import { Feature } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';

export class AdminFeatureOverrideDto {
  @IsEnum(Feature)
  feature: Feature;

  @IsBoolean()
  allowed: boolean;
}

export class SetAdminFeatureOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminFeatureOverrideDto)
  overrides: AdminFeatureOverrideDto[];
}
