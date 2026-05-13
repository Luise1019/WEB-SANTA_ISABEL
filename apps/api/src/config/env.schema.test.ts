import { describe, expect, it } from 'vitest';

import { envSchema } from './env.schema';

describe('envSchema', () => {
  const base = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/santaisabel',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('acepta config mínima válida con defaults', () => {
    const parsed = envSchema.parse(base);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.TZ).toBe('America/Bogota');
    expect(parsed.PORT).toBe(4000);
  });

  it('rechaza secretos cortos', () => {
    expect(() => envSchema.parse({ ...base, JWT_SECRET: 'short' })).toThrow();
  });

  it('coerce PORT desde string', () => {
    const parsed = envSchema.parse({ ...base, PORT: '5000' });
    expect(parsed.PORT).toBe(5000);
  });
});
