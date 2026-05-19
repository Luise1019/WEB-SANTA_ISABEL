import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { ReportsService } from './reports.service';

// ── Global templates endpoint ─────────────────────────────────
@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reports: ReportsService) {}

  @Get('templates')
  listTemplates() {
    return this.reports.listTemplates();
  }
}

// ── Per-project report export endpoints ──────────────────────
@Controller('projects/:projectId/reports')
@UseGuards(AuthGuard('jwt'))
export class ProjectReportsController {
  private readonly logger = new Logger(ProjectReportsController.name);

  constructor(private readonly reports: ReportsService) {}

  /**
   * GET /projects/:projectId/reports/budget.csv
   * Exporta el presupuesto completo como CSV (UTF-8 BOM para Excel).
   */
  @Get('budget.csv')
  async exportBudgetCsv(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const csv = await this.reports.generateBudgetCsv(projectId);
      const date = new Date().toISOString().substring(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="presupuesto-${date}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Error exportando presupuesto CSV: ${String(err)}`);
      throw new InternalServerErrorException('Error al generar el reporte de presupuesto');
    }
  }

  /**
   * GET /projects/:projectId/reports/cashflow.csv
   */
  @Get('cashflow.csv')
  async exportCashflowCsv(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const csv = await this.reports.generateCashflowCsv(projectId);
      const date = new Date().toISOString().substring(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="flujo-caja-${date}.csv"`);
      res.send(csv);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Error exportando flujo de caja CSV: ${String(err)}`);
      throw new InternalServerErrorException('Error al generar el reporte de flujo de caja');
    }
  }

  /**
   * GET /projects/:projectId/reports/budget.html
   */
  @Get('budget.html')
  async exportBudgetHtml(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const html = await this.reports.generateBudgetHtml(projectId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      this.logger.error(`Error generando reporte HTML presupuesto: ${String(err)}`);
      throw new InternalServerErrorException('Error al generar el reporte de presupuesto');
    }
  }

  /**
   * GET /projects/:projectId/reports/schedule.html
   */
  @Get('schedule.html')
  async exportScheduleHtml(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const html = await this.reports.generateScheduleHtml(projectId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      this.logger.error(`Error generando reporte HTML cronograma: ${String(err)}`);
      throw new InternalServerErrorException('Error al generar el reporte de cronograma');
    }
  }

  /**
   * GET /projects/:projectId/reports/presentation.html
   */
  @Get('presentation.html')
  async exportHtml(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const html = await this.reports.generateHtmlReport(projectId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      this.logger.error(`Error generando reporte HTML: ${String(err)}`);
      throw new InternalServerErrorException('Error al generar la presentación HTML');
    }
  }
}
