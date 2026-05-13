import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Ventas: torres, unidades (apto/casa/local/parqueadero), ventas, planes de pago.
 * Implementación completa en hito M7.
 */
@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  listUnits(projectId: string) {
    return this.prisma.unit.findMany({
      where: { projectId },
      orderBy: [{ towerId: 'asc' }, { code: 'asc' }],
    });
  }
}
