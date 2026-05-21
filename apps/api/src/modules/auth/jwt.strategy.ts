import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../users/users.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
};

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
};

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Si el token viejo no incluye organizationId, lo resolvemos contra DB (back-compat).
    if (payload.organizationId) {
      return { sub: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId };
    }
    const user = await this.users.findById(payload.sub);
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: user?.organizationId ?? '',
    };
  }
}
