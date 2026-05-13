import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Lógica de presupuesto: capítulos, ítems, APU, AIU, baseline.
 * Implementación completa: hitos M3-M4 del roadmap.
 * Por ahora expone consultas básicas para validar la estructura jerárquica.
 */
@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  listChapters(projectId: string) {
    return this.prisma.chapter.findMany({
      where: { projectId },
      include: { subchapters: { include: { items: true } } },
      orderBy: { order: 'asc' },
    });
  }
}
