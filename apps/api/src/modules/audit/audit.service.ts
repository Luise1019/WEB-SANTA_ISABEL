import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type AuditPayload = {
  action: string;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  diff?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(payload: AuditPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId ?? null,
          userId: payload.userId ?? null,
          diff: (payload.diff ?? null) as never,
          ip: payload.ip ?? null,
          userAgent: payload.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit nunca debe tumbar la request; solo log.
      this.logger.warn(
        `No se pudo persistir AuditLog (${payload.action} ${payload.entityType}): ${(err as Error).message}`,
      );
    }
  }
}
