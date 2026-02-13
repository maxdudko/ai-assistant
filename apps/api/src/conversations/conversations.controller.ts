import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ConversationMode } from '@prisma/client';
import type { Response } from 'express';

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

  @Post('message/stream')
  async sendMessageStream(
    @Req() req,
    @Body() body: { message: string; conversationId?: string; mode?: ConversationMode },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const emit = (payload: Record<string, unknown>) => {
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      emit({ type: 'start' });
      const result = await this.service.handleMessage(
        req.user.id,
        body.message,
        body.conversationId,
        body.mode,
        token => emit({ type: 'delta', delta: token }),
      );
      emit({ type: 'complete', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown stream error';
      emit({ type: 'error', error: message });
    } finally {
      res.end();
    }
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
