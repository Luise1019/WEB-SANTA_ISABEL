import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  SantaIsabelImportPreviewSchema,
  type SantaIsabelImportPreview,
} from '@santaisabel/shared';
import { z } from 'zod';

import { Audit } from '../../audit/audit.decorator';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SantaIsabelService } from './santa-isabel.service';

const CommitBodySchema = z.object({ preview: SantaIsabelImportPreviewSchema });
type CommitBody = z.infer<typeof CommitBodySchema>;

type UploadedXlsFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('projects/:projectId/imports/santa-isabel')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SantaIsabelController {
  constructor(private readonly service: SantaIsabelService) {}

  @Post('preview')
  @Roles('GERENTE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } })) // 20 MB
  preview(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @UploadedFile() file: UploadedXlsFile | undefined,
  ): SantaIsabelImportPreview {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo .xls/.xlsx requerido en campo "file"');
    }
    return this.service.preview(file.buffer);
  }

  @Post('commit')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'FeasibilityAnalysis' })
  commit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(CommitBodySchema)) dto: CommitBody,
  ) {
    return this.service.commit(projectId, dto.preview);
  }
}
