import { Module } from '@nestjs/common';

import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';

@Module({
  providers: [ChangesService],
  controllers: [ChangesController],
  exports: [ChangesService],
})
export class ChangesModule {}
