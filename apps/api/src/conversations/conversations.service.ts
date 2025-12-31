import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async handleMessage(userId: string, message: string) {
    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        messages: {
          create: {
            role: 'USER',
            content: message,
          },
        },
      },
    });

    const aiResponse = await this.ai.generateStubResponse(message);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: aiResponse,
      },
    });

    return {
      conversationId: conversation.id,
      role: 'assistant',
      content: aiResponse,
    };
  }
}
