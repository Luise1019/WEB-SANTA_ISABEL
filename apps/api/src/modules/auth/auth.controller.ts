import { Body, Controller, Post, UseGuards, Get, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoginInputSchema, RefreshTokenInputSchema } from '@santaisabel/shared';
import type { LoginInput, RefreshTokenInput, AuthTokens } from '@santaisabel/shared';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginInputSchema)) dto: LoginInput,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.auth.login(dto, extractContext(req));
  }

  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(RefreshTokenInputSchema)) dto: RefreshTokenInput,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(dto, extractContext(req));
  }

  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.auth.logout(req.user.sub);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

function extractContext(req: Request): { userAgent: string | null; ip: string | null } {
  return {
    userAgent: (req.headers['user-agent'] ?? null) as string | null,
    ip: req.ip ?? null,
  };
}
