import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ChapterInputSchema,
  APUInputSchema,
  BudgetItemInputSchema,
  AIUConfigInputSchema,
  ResourceInputSchema,
  type ChapterInput,
  type APUInput,
  type BudgetItemInput,
  type AIUConfigInput,
  type ResourceInput,
} from '@santaisabel/shared';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BudgetService } from './budget.service';

// ── Global resource / APU endpoints (no projectId) ───────────
@Controller('budget')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ResourceController {
  constructor(private readonly budget: BudgetService) {}

  @Get('resources')
  listResources() {
    return this.budget.listResources();
  }

  @Post('resources')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Resource' })
  createResource(@Body(new ZodValidationPipe(ResourceInputSchema)) dto: ResourceInput) {
    return this.budget.createResource(dto);
  }

  @Post('resources/:resourceId/rates')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Resource', entityIdParam: 'resourceId' })
  addRate(
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: { unitCost: string },
  ) {
    return this.budget.addResourceRate(resourceId, dto.unitCost);
  }

  @Post('resources/seed-colombian')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Resource' })
  seedColombianResources() {
    return this.budget.seedColombianResources();
  }

  @Get('apus')
  listAPUs() {
    return this.budget.listAPUs();
  }

  @Get('apus/:apuId/breakdown')
  getAPUBreakdown(@Param('apuId', ParseUUIDPipe) apuId: string) {
    return this.budget.getAPUCostBreakdown(apuId);
  }

  @Post('apus')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'APU' })
  createAPU(@Body(new ZodValidationPipe(APUInputSchema)) dto: APUInput) {
    return this.budget.createAPU(dto);
  }
}

// ── Per-project budget endpoints ──────────────────────────────
@Controller('projects/:projectId/budget')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get('summary')
  summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.budget.getSummary(projectId);
  }

  @Get('chapters')
  listChapters(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.budget.listChapters(projectId);
  }

  @Post('chapters')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Chapter' })
  createChapter(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(ChapterInputSchema)) dto: ChapterInput,
  ) {
    return this.budget.createChapter(projectId, dto);
  }

  @Post('chapters/:chapterId/subchapters')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Subchapter' })
  createSubchapter(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body(new ZodValidationPipe(ChapterInputSchema)) dto: ChapterInput,
  ) {
    return this.budget.createSubchapter(projectId, chapterId, dto);
  }

  @Get('items')
  listItems(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('chapterId') chapterId?: string,
  ) {
    return this.budget.listItems(projectId, chapterId);
  }

  @Post('subchapters/:subchapterId/items')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'BudgetItem' })
  createItem(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('subchapterId', ParseUUIDPipe) subchapterId: string,
    @Body(new ZodValidationPipe(BudgetItemInputSchema)) dto: BudgetItemInput,
  ) {
    return this.budget.createItem(projectId, subchapterId, dto);
  }

  @Patch('items/:itemId')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'BudgetItem', entityIdParam: 'itemId' })
  updateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: Partial<BudgetItemInput>,
  ) {
    return this.budget.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'BudgetItem', entityIdParam: 'itemId' })
  deleteItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.budget.deleteItem(itemId);
  }

  @Get('aiu')
  getAIU(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.budget.getAIU(projectId);
  }

  @Patch('aiu')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'AIUConfig' })
  upsertAIU(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(AIUConfigInputSchema)) dto: AIUConfigInput,
  ) {
    return this.budget.upsertAIU(projectId, dto);
  }

  @Get('control')
  getBudgetControl(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.budget.getBudgetControl(projectId);
  }

  @Patch('items/:itemId/actuals')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'BudgetItem', entityIdParam: 'itemId' })
  updateActuals(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: { committedCost?: string; actualCost?: string },
  ) {
    return this.budget.updateItemActuals(itemId, dto);
  }
}
