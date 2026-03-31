import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { parseListPagination } from '../common/parse-list-pagination';

import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Req() req, @Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(req.user.id, createGoalDto);
  }

  @Get()
  findAll(@Req() req, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.goalsService.findAll(req.user.id, parseListPagination(limit, offset));
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.goalsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() updateGoalDto: UpdateGoalDto) {
    return this.goalsService.update(req.user.id, id, updateGoalDto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.goalsService.remove(req.user.id, id);
  }
}
