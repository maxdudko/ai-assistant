import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubscribeDigestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  topic: string;

  @IsOptional()
  @IsString()
  @IsIn(['daily'])
  frequency?: 'daily';
}
