import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { ActionsService } from './actions.service';
import { ConfirmActionDto } from './dto/confirm-action.dto';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('confirm')
  async confirm(@Req() req, @Body() body: ConfirmActionDto) {
    return this.actionsService.confirmAction(req.user.id, body.actionId);
  }
}
