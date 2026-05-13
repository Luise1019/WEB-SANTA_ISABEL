import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const UserRoleSchema = z.enum([
  'GERENTE',
  'DIRECTOR_OBRA',
  'CONTADOR',
  'COMERCIAL',
  'AUDITOR',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;
