import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { parseListPagination } from '../common/parse-list-pagination';

import { ActionsService } from './actions.service';
import { ConfirmActionDto } from './dto/confirm-action.dto';
import { ListPendingActionsDto } from './dto/list-pending-actions.dto';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('pending')
  async pending(@Req() req, @Query() query: ListPendingActionsDto) {
    const pagination = parseListPagination(query.limit, query.offset, 20);
    return this.actionsService.getPendingActions(req.user.id, query, pagination);
  }

  @Post('confirm')
  async confirm(@Req() req, @Body() body: ConfirmActionDto) {
    return this.actionsService.confirmAction(req.user.id, body.actionId);
  }
}
