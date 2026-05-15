import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChangesService } from './changes.service';

type AuthRequest = { user: { sub: string } };

@Controller('projects/:projectId/changes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get()
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.changes.list(projectId);
  }

  @Get('baselines')
  listBaselines(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.changes.listBaselines(projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.changes.findById(id);
  }

  @Post()
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'ChangeOrder' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: AuthRequest,
    @Body()
    dto: {
      code: string;
      title: string;
      justification: string;
      estimatedCostImpact: string;
      estimatedScheduleImpactDays?: number;
    },
  ) {
    return this.changes.create(projectId, { ...dto, createdById: req.user.sub });
  }

  @Patch(':id/status')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'ChangeOrder', entityIdParam: 'id' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: 'BORRADOR' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'APLICADA' },
  ) {
    return this.changes.updateStatus(id, dto.status);
  }

  @Post(':id/approve')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'ChangeOrder', entityIdParam: 'id' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthRequest,
  ) {
    return this.changes.approve(id, req.user.sub);
  }

  @Post(':id/reject')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'ChangeOrder', entityIdParam: 'id' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthRequest,
    @Body() dto: { reason: string },
  ) {
    return this.changes.reject(id, req.user.sub, dto.reason);
  }
}
