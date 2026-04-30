import { ConversationMode } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendConversationMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsUUID('4')
  conversationId?: string;

  @IsOptional()
  @IsEnum(ConversationMode)
  mode?: ConversationMode;
}
