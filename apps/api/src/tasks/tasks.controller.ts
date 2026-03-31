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

import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Req() req, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, createTaskDto);
  }

  @Get()
  findAll(@Req() req, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.tasksService.findAll(req.user.id, parseListPagination(limit, offset, 100));
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.tasksService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(req.user.id, id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.tasksService.remove(req.user.id, id);
  }
}
