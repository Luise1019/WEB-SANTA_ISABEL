import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Importador heurístico XLSX. Hito M5.
 *
 * Flujo:
 *   1. Usuario sube .xlsx → upload a R2 → crea ImportJob (status PENDING).
 *   2. Worker BullMQ corre xlsx-import.processor.ts → ExcelJS lee hojas conocidas
 *      (PROYECTO_SANTA_ISABEL_INICIO, RUTA_INICIO_CONSTRUCTIVO_SANTA_ISABEL).
 *   3. Detección heurística de columnas (código, descripción, unidad, cantidad, vr unitario).
 *   4. Genera previewJson con tabla de filas mapeadas + warnings.
 *   5. Usuario confirma → segundo job hace commit transaccional (todo-o-nada).
 *
 * Importante: NO promete importar cualquier Excel. Soporta:
 *   - XLSX_SANTA_ISABEL: formato exacto del consorcio.
 *   - XLSX_GENERIC: mapeo manual configurable por el usuario.
 */
@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  listJobs() {
    return this.prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
