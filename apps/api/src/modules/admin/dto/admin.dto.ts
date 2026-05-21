import { z } from 'zod';

// ── Organización ─────────────────────────────────────────────────────────────
export const UpdateOrgDto = z.object({
  name:         z.string().min(2).max(120).optional(),
  taxId:        z.string().min(5).max(30).optional().nullable(),
  logoUrl:      z.string().url().optional().nullable(),
  phone:        z.string().max(30).optional().nullable(),
  address:      z.string().max(200).optional().nullable(),
  city:         z.string().max(80).optional().nullable(),
  website:      z.string().url().optional().nullable(),
  reportFooter: z.string().max(500).optional().nullable(),
  reportColor:  z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});
export type UpdateOrgDto = z.infer<typeof UpdateOrgDto>;

// ── Parámetros del sistema ────────────────────────────────────────────────────
export const UpdateParamsDto = z.object({
  aiuAdmin:          z.number().min(0).max(100).optional(),
  aiuImprevistos:    z.number().min(0).max(100).optional(),
  aiuUtilidad:       z.number().min(0).max(100).optional(),
  factorPrestacional:z.number().min(0).max(5).optional(),
  ivaRate:           z.number().min(0).max(100).optional(),
  reteIvaRate:       z.number().min(0).max(100).optional(),
  reteIcaRate:       z.number().min(0).max(50).optional(),
  trm:               z.number().min(1).max(100000).optional(),
  smmlv:             z.number().min(1).optional(),
});
export type UpdateParamsDto = z.infer<typeof UpdateParamsDto>;

// ── Usuarios ──────────────────────────────────────────────────────────────────
export const CreateUserDto = z.object({
  email:    z.string().email(),
  fullName: z.string().min(2).max(120),
  role:     z.enum(['GERENTE','DIRECTOR_OBRA','RESIDENTE_OBRA','CONTADOR','COMERCIAL','AUDITOR']),
  password: z.string().min(8).optional(), // si no se envía, se genera temporal
});
export type CreateUserDto = z.infer<typeof CreateUserDto>;

export const UpdateUserDto = z.object({
  fullName: z.string().min(2).max(120).optional(),
  role:     z.enum(['GERENTE','DIRECTOR_OBRA','RESIDENTE_OBRA','CONTADOR','COMERCIAL','AUDITOR']).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDto>;

export const ResetPasswordDto = z.object({
  newPassword: z.string().min(8),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;

// ── Miembros de proyecto ──────────────────────────────────────────────────────
export const AddMemberDto = z.object({
  userId: z.string().uuid(),
  role:   z.enum(['GERENTE','DIRECTOR_OBRA','RESIDENTE_OBRA','CONTADOR','COMERCIAL','AUDITOR']),
});
export type AddMemberDto = z.infer<typeof AddMemberDto>;

// ── Auditoría (query params) ──────────────────────────────────────────────────
export const AuditQueryDto = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(30),
  userId:     z.string().uuid().optional(),
  entityType: z.string().optional(),
  action:     z.string().optional(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
});
export type AuditQueryDto = z.infer<typeof AuditQueryDto>;
