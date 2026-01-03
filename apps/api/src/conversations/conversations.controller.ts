import { Controller, Post, Body, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ConversationMode } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  /**
   * Send a message to a conversation (creates daily conversation if none exists)
   */
  @Post('message')
  async sendMessage(
    @Req() req,
    @Body() body: { message: string; conversationId?: string; mode?: ConversationMode },
  ) {
    return this.service.handleMessage(req.user.id, body.message, body.conversationId, body.mode);
  }

  /**
   * Get or create active daily conversation
   */
  @Get('daily')
  async getDailyConversation(@Req() req) {
    const conversationId = await this.service.getOrCreateDailyConversation(req.user.id);
    return this.service.getActiveConversation(req.user.id, conversationId);
  }

  /**
   * Create a new ad-hoc conversation
   */
  @Post('ad-hoc')
  async createAdHocConversation(@Req() req, @Body() body: { mode?: ConversationMode }) {
    const conversationId = await this.service.createAdHocConversation(
      req.user.id,
      body.mode || ConversationMode.COMPANION,
    );
    return this.service.getActiveConversation(req.user.id, conversationId);
  }

  /**
   * Get a specific conversation
   */
  @Get(':id')
  async getConversation(@Req() req, @Param('id') id: string) {
    return this.service.getActiveConversation(req.user.id, id);
  }

  /**
   * Get all user conversations
   */
  @Get()
  async getConversations(@Req() req, @Query('includeArchived') includeArchived?: string) {
    return this.service.getUserConversations(req.user.id, includeArchived === 'true');
  }

  /**
   * Switch conversation mode
   */
  @Patch(':id/mode')
  async switchMode(@Req() req, @Param('id') id: string, @Body() body: { mode: ConversationMode }) {
    return this.service.switchMode(req.user.id, id, body.mode);
  }

  /**
   * Archive a conversation
   */
  @Patch(':id/archive')
  async archiveConversation(@Req() req, @Param('id') id: string) {
    return this.service.archiveConversation(req.user.id, id);
  }
}
