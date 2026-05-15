import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export type AuditMetadata = {
  action: string;
  entityType: string;
  /**
   * Llave del parámetro de ruta del que sacar entityId (ej. 'id').
   * Si no se provee, intentará usar el id del cuerpo de la respuesta.
   */
  entityIdParam?: string;
};

export const Audit = (meta: AuditMetadata) => SetMetadata(AUDIT_KEY, meta);
