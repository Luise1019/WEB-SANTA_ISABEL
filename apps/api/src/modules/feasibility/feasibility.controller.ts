import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import {
  FeasibilityService,
  type FeasibilityFullResponse,
  type IndicatorsResponse,
} from './feasibility.service';

const CostItemsArraySchema = z.array(FeasibilityCostItemInputSchema);
const CashFlowArraySchema = z.array(FeasibilityCashFlowInputSchema);

@ApiTags('Prefactibilidad')
@Controller('projects/:projectId/feasibility')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FeasibilityController {
  constructor(private readonly feasibility: FeasibilityService) {}

  @Get('')
  @ApiOperation({ summary: 'Obtener análisis completo de prefactibilidad' })
  @ApiParam({ name: 'projectId', description: 'UUID del proyecto' })
  getByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<FeasibilityFullResponse> {
    return this.feasibility.getByProject(projectId);
  }

  @Patch('')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityAnalysis' })
  @ApiOperation({ summary: 'Actualizar datos generales del análisis' })
  updateAnalysis(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(FeasibilityAnalysisInputSchema)) dto: FeasibilityAnalysisInput,
  ) {
    return this.feasibility.updateAnalysis(projectId, dto);
  }

  @Put('cost-items')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityCostItem' })
  @ApiOperation({ summary: 'Reemplazar estructura de costos completa' })
  replaceCostItems(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(CostItemsArraySchema)) items: FeasibilityCostItemInput[],
  ) {
    return this.feasibility.replaceCostItems(projectId, items);
  }

  @Put('cashflow')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityCashFlow' })
  @ApiOperation({ summary: 'Reemplazar flujo de caja mensual completo' })
  replaceCashFlow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(CashFlowArraySchema)) rows: FeasibilityCashFlowInput[],
  ) {
    return this.feasibility.replaceCashFlow(projectId, rows);
  }

  @Post('recalculate')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'FeasibilityAnalysis' })
  @ApiOperation({ summary: 'Recalcular TIR, VPN y payback desde el flujo de caja' })
  recalculate(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<IndicatorsResponse> {
    return this.feasibility.recalculateIndicators(projectId);
  }

  @Post('scenarios')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'FeasibilityScenario' })
  @ApiOperation({ summary: 'Crear escenario de sensibilidad (what-if)' })
  createScenario(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(FeasibilityScenarioInputSchema)) dto: FeasibilityScenarioInput,
  ) {
    return this.feasibility.createScenario(projectId, dto);
  }

  @Delete('scenarios/:id')
  @Roles('GERENTE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'DELETE', entityType: 'FeasibilityScenario', entityIdParam: 'id' })
  @ApiOperation({ summary: 'Eliminar escenario de sensibilidad' })
  deleteScenario(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.feasibility.deleteScenario(projectId, id);
  }
}
