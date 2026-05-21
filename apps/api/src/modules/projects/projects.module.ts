import { Module } from '@nestjs/common';

import { ScopeOrgGuard } from '../../common/guards/scope-org.guard';
import { PrismaModule } from '../prisma/prisma.module';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  providers: [ProjectsService, ScopeOrgGuard],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
