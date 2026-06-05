import { IsString } from 'class-validator';

export class SubscribePushDto {
  @IsString()
  endpoint: string;

  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}
