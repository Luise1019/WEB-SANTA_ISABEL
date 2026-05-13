import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('America/Bogota'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WORKER: z.enum(['0', '1']).default('0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  SENTRY_DSN: z.string().url().optional(),
  AXIOM_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
