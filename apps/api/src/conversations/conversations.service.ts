import { Injectable } from '@nestjs/common';

import { AiService } from '../ai/ai.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly ai: AiService) {}

  async handleMessage(message: string) {
    return {
      role: 'assistant',
      content: await this.ai.generateStubResponse(message),
    };
  }
}
