import { Module } from '@nestjs/common';

import { IntentDetectorService } from './intent-detector.service';

@Module({
  providers: [IntentDetectorService],
  exports: [IntentDetectorService],
})
export class IntentsModule {}
