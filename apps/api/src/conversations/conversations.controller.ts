import { Controller, Post, Body } from '@nestjs/common';
import { ConversationsService } from './conversations.service';


@Controller('chat')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}


  @Post('message')
  async sendMessage(
    @Body() body: { userId: string; message: string },
  ) {
    return this.service.handleMessage(body.userId, body.message);
  }
}