import { Module } from '@nestjs/common';

import { MemoryModule } from '../memory/memory.module';

import { ReflectionService } from './reflection.service';

@Module({
  imports: [MemoryModule],
  providers: [ReflectionService],
  exports: [ReflectionService],
})
export class ReflectionModule {}
