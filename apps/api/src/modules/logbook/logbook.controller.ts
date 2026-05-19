import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LogbookService } from './logbook.service';
import {
  CreateLogbookEntryDto, UpdateLogbookEntryDto, ListLogbookDto,
} from './logbook.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/logbook')
export class LogbookController {
  constructor(private readonly svc: LogbookService) {}

  @Get()
  list(@Param('projectId') pid: string, @Query() q: Record<string, string>) {
    const dto = ListLogbookDto.parse(q);
    return this.svc.list(pid, dto);
  }

  @Get('stats')
  stats(@Param('projectId') pid: string) {
    return this.svc.stats(pid);
  }

  @Get(':id')
  findOne(@Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.findOne(pid, id);
  }

  @Post()
  create(@Param('projectId') pid: string, @Body() body: unknown) {
    const dto = CreateLogbookEntryDto.parse(body);
    return this.svc.create(pid, dto);
  }

  @Put(':id')
  update(
    @Param('projectId') pid: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = UpdateLogbookEntryDto.parse(body);
    return this.svc.update(pid, id, dto);
  }

  @Delete(':id')
  remove(@Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.remove(pid, id);
  }
}
