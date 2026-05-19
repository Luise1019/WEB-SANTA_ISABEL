import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  liveness(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('db')
  @HealthCheck()
  database() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => this.db.pingCheck('postgres', this.prisma),
    ]);
  }

  /**
   * GET /health/full — liveness + database en una sola llamada.
   * Retorna { status, timestamp, database } para dashboards de monitoreo.
   */
  @Get('full')
  @HealthCheck()
  async full(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    database: 'connected' | 'error';
    details?: unknown;
  }> {
    try {
      const result = await this.health.check([
        async (): Promise<HealthIndicatorResult> => this.db.pingCheck('postgres', this.prisma),
      ]);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        details: result,
      };
    } catch (err) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'error',
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
