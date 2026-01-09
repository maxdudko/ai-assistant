import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';

@Module({
  imports: [PrismaModule],
  controllers: [DaysController],
  providers: [DaysService],
})
export class DaysModule {}
