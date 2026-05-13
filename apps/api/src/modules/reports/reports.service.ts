import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Generación de reportes PDF. Hito M10.
 *
 * Arquitectura:
 *   - POST /reports/generate retorna jobId inmediatamente.
 *   - Worker BullMQ (pdf.processor.ts) renderiza con Puppeteer + Handlebars.
 *   - Output sube a Cloudflare R2 con presigned URL.
 *   - Frontend hace polling de GET /reports/:id hasta status = SUCCEEDED.
 *
 * Tipos: PREFACTIBILIDAD, EJECUCION_PRESUPUESTAL, FLUJO_CAJA, ACTA_COMITE,
 * RENTABILIDAD, SECOP_II, PERSONALIZADO.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return this.prisma.reportTemplate.findMany({ orderBy: { kind: 'asc' } });
  }
}
