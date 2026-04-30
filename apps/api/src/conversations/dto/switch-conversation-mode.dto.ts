import { ConversationMode } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SwitchConversationModeDto {
  @IsEnum(ConversationMode)
  mode: ConversationMode;
}
