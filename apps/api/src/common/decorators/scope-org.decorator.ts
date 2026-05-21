import { SetMetadata } from '@nestjs/common';

export const SCOPE_ORG_KEY = 'scopeOrg';

export type ScopeOrgOptions = {
  /** Nombre del delegate Prisma (lowerCamelCase del modelo): 'project', 'budgetItem', etc. */
  entity: string;
  /** Nombre del parámetro de ruta que contiene el ID del recurso (por defecto 'id'). */
  param?: string;
};

/**
 * Marca un endpoint para validar que el recurso solicitado pertenece a la organización
 * del usuario autenticado. Aplicar junto con `ScopeOrgGuard`.
 *
 * Uso:
 *   @ScopeOrg({ entity: 'project' })          // valida :id
 *   @ScopeOrg({ entity: 'project', param: 'projectId' })
 */
export const ScopeOrg = (opts: ScopeOrgOptions) =>
  SetMetadata(SCOPE_ORG_KEY, { param: 'id', ...opts });
