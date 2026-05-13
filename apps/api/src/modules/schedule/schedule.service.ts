import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Cronograma + Gantt + CPM. Implementación completa en hito M6.
 * El algoritmo CPM (forward/backward pass) vivirá en cpm.service.ts.
 */
@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  listTasks(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: { predecessors: true, successors: true },
      orderBy: { order: 'asc' },
    });
  }
}
