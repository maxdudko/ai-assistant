import { Module } from '@nestjs/common';

import { MemoryModule } from '../memory/memory.module';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [MemoryModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
