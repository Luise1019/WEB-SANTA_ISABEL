import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../modules/prisma/prisma.service';

import { SCOPE_ORG_KEY, ScopeOrgOptions } from '../decorators/scope-org.decorator';

/**
 * Guard que valida que el recurso pedido por param-id pertenece a la organización del usuario.
 *
 * Aplica solo cuando un controller/handler declara @ScopeOrg({...}).
 * Devuelve 404 (no 403) si no coincide, para no filtrar información sobre la existencia del recurso.
 */
@Injectable()
export class ScopeOrgGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<ScopeOrgOptions | undefined>(SCOPE_ORG_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<{
      user?: { organizationId?: string };
      params: Record<string, string>;
    }>();

    const orgId = req.user?.organizationId;
    if (!orgId) throw new NotFoundException('Recurso no encontrado');

    const paramName = opts.param ?? 'id';
    const resourceId = req.params[paramName];
    if (!resourceId) return true; // listados o creación, no hay recurso a validar

    // Lookup directo usando el delegate de Prisma con el nombre del modelo
    const delegate = (this.prisma as unknown as Record<string, { findUnique: (args: unknown) => Promise<unknown> }>)[opts.entity];
    if (!delegate?.findUnique) {
      throw new NotFoundException('Recurso no encontrado');
    }

    const resource = (await delegate.findUnique({
      where: { id: resourceId },
      select: { organizationId: true },
    })) as { organizationId?: string } | null;

    if (!resource || resource.organizationId !== orgId) {
      throw new NotFoundException('Recurso no encontrado');
    }
    return true;
  }
}
