import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { BudgetService } from '../budget/budget.service';

type ChangeOrderStatus = 'BORRADOR' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'APLICADA';

type ChangeOrderInput = {
  code: string;
  title: string;
  justification: string;
  estimatedCostImpact: string;
  estimatedScheduleImpactDays?: number;
  createdById: string;
};

@Injectable()
export class ChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: BudgetService,
  ) {}

  list(projectId: string) {
    return this.prisma.changeOrder.findMany({
      where: { projectId },
      include: { impacts: true, approvals: true, createdBy: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.changeOrder.findUnique({
      where: { id },
      include: { impacts: true, approvals: true, createdBy: { select: { email: true } } },
    });
  }

  async create(projectId: string, input: ChangeOrderInput) {
    return this.prisma.changeOrder.create({
      data: {
        projectId,
        code: input.code,
        title: input.title,
        justification: input.justification,
        estimatedCostImpact: new Decimal(input.estimatedCostImpact),
        estimatedScheduleImpactDays: input.estimatedScheduleImpactDays ?? 0,
        status: 'BORRADOR',
        createdById: input.createdById,
      },
    });
  }

  async updateStatus(id: string, status: ChangeOrderStatus) {
    const oc = await this.prisma.changeOrder.findUnique({ where: { id } });
    if (!oc) throw new NotFoundException(`OC ${id} no existe`);

    const allowedTransitions: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
      BORRADOR: ['EN_REVISION'],
      EN_REVISION: ['APROBADA', 'RECHAZADA'],
      APROBADA: ['APLICADA'],
      RECHAZADA: [],
      APLICADA: [],
    };

    const current = oc.status as ChangeOrderStatus;
    if (!allowedTransitions[current].includes(status)) {
      throw new BadRequestException(
        `No se puede cambiar de ${current} a ${status}`,
      );
    }

    return this.prisma.changeOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'APLICADA' ? { appliedAt: new Date() } : {}),
      },
    });
  }

  // Approve with budget baseline snapshot
  async approve(id: string, approverId: string) {
    const oc = await this.findById(id);
    if (!oc) throw new NotFoundException(`OC ${id} no existe`);
    if (oc.status !== 'EN_REVISION') {
      throw new BadRequestException('Solo se pueden aprobar OC en revisión');
    }

    // Create approval record
    await this.prisma.approval.create({
      data: {
        changeOrderId: id,
        approverId,
        decision: 'APROBADO',
        decidedAt: new Date(),
      },
    });

    // Update status
    await this.updateStatus(id, 'APROBADA');

    // Create budget baseline snapshot
    const summary = await this.budget.getSummary(oc.projectId);
    const version = await this.prisma.budgetBaseline.count({ where: { projectId: oc.projectId } });
    await this.prisma.budgetBaseline.create({
      data: {
        projectId: oc.projectId,
        version: version + 1,
        label: `OC ${oc.code} — ${oc.title}`,
        frozenAt: new Date(),
        snapshot: JSON.parse(JSON.stringify(summary)),
        createdById: approverId,
      },
    });

    return this.findById(id);
  }

  async reject(id: string, approverId: string, reason: string) {
    const oc = await this.findById(id);
    if (!oc) throw new NotFoundException(`OC ${id} no existe`);

    await this.prisma.approval.create({
      data: {
        changeOrderId: id,
        approverId,
        decision: 'RECHAZADO',
        comments: reason,
        decidedAt: new Date(),
      },
    });

    return this.updateStatus(id, 'RECHAZADA');
  }

  // List budget baselines (versions)
  listBaselines(projectId: string) {
    return this.prisma.budgetBaseline.findMany({
      where: { projectId },
      select: {
        id: true,
        version: true,
        label: true,
        frozenAt: true,
        createdBy: { select: { email: true } },
      },
      orderBy: { version: 'desc' },
    });
  }
}
