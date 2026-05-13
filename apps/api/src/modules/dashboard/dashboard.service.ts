import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Dashboard ejecutivo: KPIs, alertas tempranas, curva S, IPC vs ejecución.
 * Implementación completa en hito M9. Las agregaciones pesadas se servirán desde
 * materialized views Postgres recalculadas por worker.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    return {
      project,
      kpis: {
        rentabilidadPct: null,
        margenNetoCOP: null,
        valorPorM2COP: null,
        costoPorM2COP: null,
        puntoEquilibrioUnidades: null,
      },
      alerts: [],
    };
  }
}
