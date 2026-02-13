import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnsubscribeDigestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  topic: string;
}
