import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CashflowService } from './cashflow.service';

type CashFlowKind = 'INGRESO' | 'EGRESO';
type CashFlowCategory =
  | 'VENTA_CUOTA_INICIAL'
  | 'VENTA_SALDO'
  | 'DESEMBOLSO_CREDITO'
  | 'APORTE_SOCIO'
  | 'EGRESO_CAPITULO'
  | 'INTERES_CREDITO'
  | 'AMORTIZACION_CREDITO'
  | 'IMPUESTOS'
  | 'OTRO';

@Controller('projects/:projectId/cashflow')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CashflowController {
  constructor(private readonly cashflow: CashflowService) {}

  @Get('summary')
  getSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.cashflow.getSummary(projectId);
  }

  @Get('entries')
  listEntries(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('year') year?: string,
  ) {
    return this.cashflow.listEntries(projectId, year ? Number(year) : undefined);
  }

  @Post('entries')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'CashFlowEntry' })
  createEntry(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body()
    dto: {
      date: string;
      kind: CashFlowKind;
      category: CashFlowCategory;
      description: string;
      amount: string;
      chapterId?: string | null;
      budgetItemId?: string | null;
      saleId?: string | null;
      loanFacilityId?: string | null;
    },
  ) {
    return this.cashflow.createEntry(projectId, dto);
  }

  @Delete('entries/:entryId')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'CashFlowEntry', entityIdParam: 'entryId' })
  deleteEntry(@Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.cashflow.deleteEntry(entryId);
  }

  @Get('loans')
  listLoans(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.cashflow.listLoans(projectId);
  }

  @Post('loans')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'LoanFacility' })
  createLoan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body()
    dto: {
      bank: string;
      amount: string;
      interestRateAnnual: string;
      startDate: string;
      termMonths: number;
      graceMonths?: number;
    },
  ) {
    return this.cashflow.createLoan(projectId, dto);
  }
}
