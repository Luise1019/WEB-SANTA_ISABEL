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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SalesService } from './sales.service';

@Controller('projects/:projectId/sales')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('summary')
  getSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sales.getSummary(projectId);
  }

  // ── Towers ──────────────────────────────────────────────────
  @Get('towers')
  listTowers(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sales.listTowers(projectId);
  }

  @Post('towers')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Tower' })
  createTower(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: { code: string; name: string; floors?: number },
  ) {
    return this.sales.createTower(projectId, dto);
  }

  // ── Units ────────────────────────────────────────────────────
  @Get('units')
  listUnits(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sales.listUnits(projectId);
  }

  @Post('units')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Unit' })
  createUnit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body()
    dto: {
      towerId?: string | null;
      code: string;
      kind: 'APARTAMENTO' | 'CASA' | 'LOCAL' | 'PARQUEADERO' | 'DEPOSITO';
      floor?: number | null;
      privateAreaM2: string;
      commonAreaM2?: string;
      saleableAreaM2: string;
      listPrice: string;
    },
  ) {
    return this.sales.createUnit(projectId, dto);
  }

  @Patch('units/:unitId/status')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Unit', entityIdParam: 'unitId' })
  updateStatus(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body()
    dto: {
      status: 'DISPONIBLE' | 'RESERVADA' | 'NEGOCIANDO' | 'VENDIDA' | 'ESCRITURADA' | 'BLOQUEADA';
    },
  ) {
    return this.sales.updateUnitStatus(unitId, dto.status);
  }

  @Patch('units/:unitId/price')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Unit', entityIdParam: 'unitId' })
  updatePrice(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: { listPrice: string },
  ) {
    return this.sales.updateUnitPrice(unitId, dto.listPrice);
  }

  // ── Sales ────────────────────────────────────────────────────
  @Get('sales')
  listSales(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sales.listSales(projectId);
  }

  @Post('sales')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Sale' })
  createSale(
    @Body()
    dto: {
      unitId: string;
      buyerName: string;
      buyerDocument: string;
      salePrice: string;
      reservationDate: string;
      expectedScriptureDate?: string | null;
    },
  ) {
    return this.sales.createSale(dto);
  }

  @Delete('sales/:saleId')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'Sale', entityIdParam: 'saleId' })
  cancelSale(@Param('saleId', ParseUUIDPipe) saleId: string) {
    return this.sales.cancelSale(saleId);
  }
}
