import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AUDIT_KEY, type AuditMetadata } from './audit.decorator';
import { AuditService } from './audit.service';

type AuthRequest = Request & { user?: { sub?: string } };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.sub ?? null;
    const ip = (req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null) as string | null;
    const userAgent = (req.headers['user-agent'] ?? null) as string | null;
    const params = req.params as Record<string, string | undefined>;

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          (meta.entityIdParam ? params[meta.entityIdParam] : undefined) ??
          (typeof result === 'object' && result && 'id' in result
            ? String((result as { id: unknown }).id)
            : null);

        void this.audit.record({
          action: meta.action,
          entityType: meta.entityType,
          entityId,
          userId,
          diff: req.method !== 'GET' ? sanitize(req.body) : undefined,
          ip,
          userAgent,
        });
      }),
    );
  }
}

function sanitize(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (/password|secret|token/i.test(key)) clone[key] = '[REDACTED]';
  }
  return clone;
}
