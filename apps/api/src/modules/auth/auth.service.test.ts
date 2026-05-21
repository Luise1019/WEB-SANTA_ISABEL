import { UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

/**
 * Tests del servicio de auth con dependencies mockeadas (sin Postgres real).
 * Cobertura objetivo: login OK / fail / refresh rotation / detección de reuso / logout.
 */

type MockUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  passwordHash: string;
  isActive: boolean;
};

function makeFixtures() {
  const password = 'admin123';
  const passwordHash = ''; // se llena con argon2 abajo
  const user: MockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'GERENTE',
    organizationId: 'org-1',
    passwordHash,
    isActive: true,
  };
  return { password, user };
}

function makeService(overrides: {
  user?: MockUser | null;
  storedRefresh?: { id: string; revokedAt: Date | null; expiresAt: Date } | null;
}) {
  const refreshTokenStore = new Map<string, { id: string; revokedAt: Date | null; expiresAt: Date; tokenHash: string }>();
  if (overrides.storedRefresh) {
    refreshTokenStore.set('__stored__', { ...overrides.storedRefresh, tokenHash: '__stored__' });
  }

  const usersMock = {
    findByEmail: vi.fn().mockResolvedValue(overrides.user ?? null),
    findById: vi.fn().mockResolvedValue(overrides.user ?? null),
    touchLastLogin: vi.fn().mockResolvedValue(undefined),
  };

  const jwtMock = {
    signAsync: vi.fn(async (payload: object, opts?: { expiresIn?: string; secret?: string }) => {
      // Añadimos iat + nonce para que cada firma sea única (igual que JWT real)
      const enriched = { ...payload, iat: Date.now(), nonce: Math.random().toString(36).slice(2) };
      const b64 = Buffer.from(JSON.stringify(enriched)).toString('base64');
      return `signed|${b64}|${opts?.secret ?? 'access'}`;
    }),
    verifyAsync: vi.fn(async (token: string) => {
      const parts = token.split('|');
      if (parts.length !== 3) throw new Error('bad token');
      return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    }),
  };

  const configMock = {
    get: vi.fn((key: string, def?: string) => {
      const env: Record<string, string> = {
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '30d',
      };
      return env[key] ?? def;
    }),
    getOrThrow: vi.fn(() => 'test-secret'),
  };

  const updateManyCalls: unknown[] = [];
  const updateCalls: unknown[] = [];
  const createCalls: unknown[] = [];

  const prismaMock = {
    refreshToken: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        return refreshTokenStore.get(where.tokenHash) ?? null;
      }),
      create: vi.fn(async (args: { data: { tokenHash: string; userId: string; expiresAt: Date } }) => {
        const id = `rt-${refreshTokenStore.size + 1}`;
        refreshTokenStore.set(args.data.tokenHash, {
          id,
          revokedAt: null,
          expiresAt: args.data.expiresAt,
          tokenHash: args.data.tokenHash,
        });
        createCalls.push(args);
        return { id };
      }),
      update: vi.fn(async (args: { where: { id: string }; data: { revokedAt?: Date; replacedById?: string } }) => {
        updateCalls.push(args);
        for (const v of refreshTokenStore.values()) {
          if (v.id === args.where.id && args.data.revokedAt) v.revokedAt = args.data.revokedAt;
        }
        return { id: args.where.id };
      }),
      updateMany: vi.fn(async (args: unknown) => {
        updateManyCalls.push(args);
        for (const v of refreshTokenStore.values()) {
          if (v.revokedAt === null) v.revokedAt = new Date();
        }
        return { count: refreshTokenStore.size };
      }),
    },
  };

  const service = new AuthService(
    usersMock as never,
    jwtMock as never,
    configMock as never,
    prismaMock as never,
  );

  return { service, prismaMock, usersMock, jwtMock, refreshTokenStore, updateManyCalls };
}

describe('AuthService.login', () => {
  it('emite tokens con organizationId en el payload cuando las credenciales son válidas', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    const { service, prismaMock } = makeService({ user });

    const tokens = await service.login({ email: user.email, password });

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresIn).toBeGreaterThan(0);
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    // El payload contiene el organizationId (decodificar base64)
    const parts = tokens.accessToken.split('|');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    expect(payload.organizationId).toBe('org-1');
    expect(payload.role).toBe('GERENTE');
  });

  it('rechaza con UnauthorizedException si el usuario no existe', async () => {
    const { service } = makeService({ user: null });
    await expect(
      service.login({ email: 'nope@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con UnauthorizedException si el password es incorrecto', async () => {
    const { user } = makeFixtures();
    user.passwordHash = await argon2.hash('the-real-password');
    const { service } = makeService({ user });
    await expect(
      service.login({ email: user.email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza si el usuario está inactivo', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    user.isActive = false;
    const { service } = makeService({ user });
    await expect(
      service.login({ email: user.email, password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh — rotación y detección de reuso', () => {
  it('emite un nuevo par de tokens y revoca el refresh anterior', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    const { service, prismaMock, jwtMock } = makeService({ user });

    // Stub: el lookup del refresh debe devolver el token almacenado
    const firstRefresh = await service.login({ email: user.email, password });

    // Mockeamos el siguiente findUnique para que devuelva el token correcto
    prismaMock.refreshToken.findUnique = vi.fn(async () => ({
      id: 'rt-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      tokenHash: 'whatever',
    }));

    const rotated = await service.refresh({ refreshToken: firstRefresh.refreshToken });

    expect(rotated.refreshToken).not.toBe(firstRefresh.refreshToken);
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    // El nuevo refresh emitido debe haber sido verificable
    expect(jwtMock.signAsync).toHaveBeenCalled();
  });

  it('revoca todas las sesiones del usuario si se presenta un refresh inexistente', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    const { service, prismaMock, updateManyCalls } = makeService({ user });

    const tokens = await service.login({ email: user.email, password });

    // Mockear: el token verifica OK pero no existe en DB → ataque de reuso
    prismaMock.refreshToken.findUnique = vi.fn(async () => null);

    await expect(
      service.refresh({ refreshToken: tokens.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(updateManyCalls.length).toBeGreaterThan(0);
  });

  it('rechaza con UnauthorizedException si el refresh ya está revocado y revoca toda la sesión', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    const { service, prismaMock, updateManyCalls } = makeService({ user });

    const tokens = await service.login({ email: user.email, password });
    prismaMock.refreshToken.findUnique = vi.fn(async () => ({
      id: 'rt-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      tokenHash: 'whatever',
    }));

    await expect(
      service.refresh({ refreshToken: tokens.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(updateManyCalls.length).toBeGreaterThan(0);
  });

  it('rechaza con UnauthorizedException si el refresh está expirado', async () => {
    const { password, user } = makeFixtures();
    user.passwordHash = await argon2.hash(password);
    const { service, prismaMock } = makeService({ user });

    const tokens = await service.login({ email: user.email, password });
    prismaMock.refreshToken.findUnique = vi.fn(async () => ({
      id: 'rt-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      tokenHash: 'whatever',
    }));

    await expect(
      service.refresh({ refreshToken: tokens.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con UnauthorizedException si el refresh tiene firma inválida', async () => {
    const { user } = makeFixtures();
    const { service, jwtMock } = makeService({ user });
    jwtMock.verifyAsync = vi.fn(async () => { throw new Error('invalid signature'); });

    await expect(
      service.refresh({ refreshToken: 'garbage' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.logout', () => {
  it('revoca todos los refresh tokens activos del usuario', async () => {
    const { service, prismaMock } = makeService({ user: null });
    await service.logout('user-1');
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
