import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import type { AuthTokens, LoginInput, RefreshTokenInput } from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type IssueContext = {
  userAgent?: string | null;
  ip?: string | null;
  /** Si se está rotando un refresh, su ID para enlazar via replacedById */
  previousTokenId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(input: LoginInput, ctx: IssueContext = {}): Promise<AuthTokens> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    await this.users.touchLastLogin(user.id);
    return this.issueTokens(user.id, user.email, user.role, user.organizationId, ctx);
  }

  async refresh(input: RefreshTokenInput, ctx: IssueContext = {}): Promise<AuthTokens> {
    let payload: { sub: string; email: string; role: string; organizationId?: string };
    try {
      payload = await this.jwt.verifyAsync(input.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokenHash = hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Si el token fue presentado pero no existe en DB → robado o ya rotado: revocar TODOS los tokens del usuario
    if (!stored) {
      await this.revokeAllForUser(payload.sub);
      throw new UnauthorizedException('Refresh token reutilizado — sesión revocada');
    }
    if (stored.revokedAt) {
      // Reuse de un token ya revocado: señal fuerte de robo
      await this.revokeAllForUser(payload.sub);
      throw new UnauthorizedException('Refresh token revocado');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Si el payload del refresh viejo no trae organizationId, lo resolvemos
    let organizationId = payload.organizationId;
    if (!organizationId) {
      const user = await this.users.findById(payload.sub);
      organizationId = user?.organizationId ?? '';
    }

    return this.issueTokens(payload.sub, payload.email, payload.role, organizationId, {
      ...ctx,
      previousTokenId: stored.id,
    });
  }

  async logout(userId: string): Promise<void> {
    await this.revokeAllForUser(userId);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    organizationId: string,
    ctx: IssueContext,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email, role, organizationId };
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtl,
    });

    const refreshTtlSeconds = parseTtlSeconds(refreshTtl, 30 * 86400);
    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);
    const tokenHash = hashToken(refreshToken);

    // Crear el nuevo refresh y, si venía de una rotación, revocar el anterior + enlazar
    const created = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
      },
      select: { id: true },
    });

    if (ctx.previousTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: ctx.previousTokenId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    }

    return { accessToken, refreshToken, expiresIn: parseTtlSeconds(accessTtl, 900) };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseTtlSeconds(ttl: string, fallback: number): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return fallback;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return fallback;
  }
}
