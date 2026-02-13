import { IsEmail, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';

export class UpdateMeDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  profile?: UpdateProfileDto;
}
