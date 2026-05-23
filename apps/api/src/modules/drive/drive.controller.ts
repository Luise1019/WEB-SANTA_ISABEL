import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DriveService } from './drive.service';

@ApiTags('Drive / Import-Export')
@Controller('drive')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  // ── Status ─────────────────────────────────────────────────────────────────

  @Get('status')
  @ApiOperation({ summary: 'Estado de la conexion Google Drive' })
  getStatus() {
    return {
      oauthConfigured: this.drive.isOAuthConfigured,
      exportAvailable: true,
      importAvailable: true,
    };
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────

  @Get('auth-url')
  @Roles('GERENTE')
  @ApiOperation({ summary: 'Obtener URL de autorizacion Google' })
  getAuthUrl() {
    return { url: this.drive.getAuthUrl() };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Callback OAuth de Google' })
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    const tokens = await this.drive.handleCallback(code);
    // Redirect back to app with success message
    res.redirect(`/dashboard?drive=connected&hasRefresh=${!!tokens.refreshToken}`);
  }

  // ── Export endpoints ───────────────────────────────────────────────────────

  @Get('export/:projectId/budget.csv')
  @ApiOperation({ summary: 'Exportar presupuesto como CSV' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportBudget(@Param('projectId', ParseUUIDPipe) projectId: string, @Res() res: Response) {
    const csv = await this.drive.exportBudgetCsv(projectId);
    const bom = '﻿'; // UTF-8 BOM for Excel compatibility
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="presupuesto_${projectId.slice(0, 8)}.csv"`,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(bom + csv);
  }

  @Get('export/:projectId/feasibility.csv')
  @ApiOperation({ summary: 'Exportar prefactibilidad como CSV' })
  async exportFeasibility(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ) {
    const csv = await this.drive.exportFeasibilityCsv(projectId);
    const bom = '﻿';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prefactibilidad_${projectId.slice(0, 8)}.csv"`,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(bom + csv);
  }

  @Get('export/:projectId/cashflow.csv')
  @ApiOperation({ summary: 'Exportar flujo de caja como CSV' })
  async exportCashflow(@Param('projectId', ParseUUIDPipe) projectId: string, @Res() res: Response) {
    const csv = await this.drive.exportCashflowCsv(projectId);
    const bom = '﻿';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="flujo_caja_${projectId.slice(0, 8)}.csv"`,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(bom + csv);
  }

  @Get('export/:projectId/project.json')
  @ApiOperation({ summary: 'Exportar proyecto completo como JSON' })
  async exportProjectJson(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ) {
    const data = await this.drive.exportProjectJson(projectId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="proyecto_${projectId.slice(0, 8)}.json"`,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(data);
  }

  // ── Import endpoints ───────────────────────────────────────────────────────

  @Post('import/:projectId/budget')
  @Roles('GERENTE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @Audit({ action: 'CREATE', entityType: 'BudgetImport' })
  @ApiOperation({ summary: 'Importar presupuesto desde CSV' })
  async importBudget(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('organizationId') organizationId: string,
  ) {
    if (!file) {
      return { error: 'No se recibio archivo' };
    }
    const csv = file.buffer.toString('utf-8');
    return this.drive.importBudgetFromCsv(projectId, csv, organizationId ?? '');
  }

  @Post('import/:projectId/feasibility-costs')
  @Roles('GERENTE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @Audit({ action: 'CREATE', entityType: 'FeasibilityImport' })
  @ApiOperation({ summary: 'Importar costos de prefactibilidad desde CSV' })
  async importFeasibilityCosts(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'No se recibio archivo' };
    }
    const csv = file.buffer.toString('utf-8');
    return this.drive.importFeasibilityCostsCsv(projectId, csv);
  }
}
