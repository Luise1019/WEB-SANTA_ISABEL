import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';

import {
  ProjectInputSchema,
  ProjectUpdateSchema,
  type ProjectInput,
  type ProjectUpdate,
} from '@santaisabel/shared';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findById(id);
  }

  @Post()
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Project' })
  create(@Body(new ZodValidationPipe(ProjectInputSchema)) dto: ProjectInput) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Project', entityIdParam: 'id' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ProjectUpdateSchema)) dto: ProjectUpdate,
  ) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'Project', entityIdParam: 'id' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(id);
  }
}
