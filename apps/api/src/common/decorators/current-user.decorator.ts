import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../../modules/auth/jwt.strategy';

/**
 * Inyecta el usuario autenticado en un parámetro del controller.
 *
 * Uso:
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 *   @Get('org')
 *   org(@CurrentUser('organizationId') orgId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return field ? req.user?.[field] : req.user;
  },
);
