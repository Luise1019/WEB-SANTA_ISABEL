import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Flujo de caja: devengo (CashFlowEntry) vs caja real (CashTransaction).
 * Conciliación opcional vía reconciliationId. Hito M8.
 */
@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  listEntries(projectId: string) {
    return this.prisma.cashFlowEntry.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
    });
  }
}
