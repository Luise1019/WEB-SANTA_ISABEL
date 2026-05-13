import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(AuthGuard('jwt'))
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('jobs')
  listJobs() {
    return this.imports.listJobs();
  }
}
