import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';

import { DaysController } from './days.controller';
import { DaysService } from './days.service';

@Module({
  imports: [PrismaModule, MemoryModule],
  controllers: [DaysController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
