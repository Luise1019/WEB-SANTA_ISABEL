import { Body, Controller, Post, UseGuards, Get, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoginInputSchema, RefreshTokenInputSchema } from '@santaisabel/shared';
import type { LoginInput, RefreshTokenInput, AuthTokens } from '@santaisabel/shared';

import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body(new ZodValidationPipe(LoginInputSchema)) dto: LoginInput): Promise<AuthTokens> {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(RefreshTokenInputSchema)) dto: RefreshTokenInput,
  ): Promise<AuthTokens> {
    return this.auth.refresh(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
