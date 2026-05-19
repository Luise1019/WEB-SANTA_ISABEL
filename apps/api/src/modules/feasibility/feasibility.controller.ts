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
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import {
  FeasibilityAnalysisInputSchema,
  FeasibilityCashFlowInputSchema,
  FeasibilityCostItemInputSchema,
  FeasibilityScenarioInputSchema,
  type FeasibilityAnalysisInput,
  type FeasibilityCashFlowInput,
  type FeasibilityCostItemInput,
  type FeasibilityScenarioInput,
} from '@santaisabel/shared';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FeasibilityService } from './feasibility.service';

const CostItemsArraySchema = z.array(FeasibilityCostItemInputSchema);
const CashFlowArraySchema = z.array(FeasibilityCashFlowInputSchema);

@Controller('projects/:projectId/feasibility')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FeasibilityController {
  constructor(private readonly feasibility: FeasibilityService) {}

  @Get('')
  getByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.feasibility.getByProject(projectId);
  }

  @Patch('')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityAnalysis' })
  updateAnalysis(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(FeasibilityAnalysisInputSchema)) dto: FeasibilityAnalysisInput,
  ) {
    return this.feasibility.updateAnalysis(projectId, dto);
  }

  @Put('cost-items')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityCostItem' })
  replaceCostItems(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(CostItemsArraySchema)) items: FeasibilityCostItemInput[],
  ) {
    return this.feasibility.replaceCostItems(projectId, items);
  }

  @Put('cashflow')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityCashFlow' })
  replaceCashFlow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(CashFlowArraySchema)) rows: FeasibilityCashFlowInput[],
  ) {
    return this.feasibility.replaceCashFlow(projectId, rows);
  }

  @Post('recalculate')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityAnalysis' })
  recalculate(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.feasibility.recalculateIndicators(projectId);
  }

  @Post('scenarios')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'FeasibilityScenario' })
  createScenario(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(FeasibilityScenarioInputSchema)) dto: FeasibilityScenarioInput,
  ) {
    return this.feasibility.createScenario(projectId, dto);
  }

  @Delete('scenarios/:id')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'FeasibilityScenario', entityIdParam: 'id' })
  deleteScenario(@Param('id', ParseUUIDPipe) id: string) {
    return this.feasibility.deleteScenario(id);
  }
}
