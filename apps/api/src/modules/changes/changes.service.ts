import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Órdenes de cambio + workflow de aprobación + versionado de baseline.
 * Al aprobar una OC: persiste snapshot JSONB del baseline (no event sourcing). Hito M9.
 */
@Injectable()
export class ChangesService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string) {
    return this.prisma.changeOrder.findMany({
      where: { projectId },
      include: { impacts: true, approvals: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
