import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import {
  AddMemberDto,
  AuditQueryDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateOrgDto,
  UpdateParamsDto,
  UpdateUserDto,
} from './dto/admin.dto';

type JwtReq = { user: { sub: string; orgId: string; role: string } };

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('GERENTE')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Organización ───────────────────────────────────────────────────────────

  @Get('organization')
  getOrg(@Req() req: JwtReq) {
    return this.admin.getOrg(req.user.orgId);
  }

  @Patch('organization')
  updateOrg(@Req() req: JwtReq, @Body() body: unknown) {
    const dto = UpdateOrgDto.parse(body);
    return this.admin.updateOrg(req.user.orgId, dto);
  }

  // ── Parámetros ─────────────────────────────────────────────────────────────

  @Get('params')
  getParams(@Req() req: JwtReq) {
    return this.admin.getParams(req.user.orgId);
  }

  @Patch('params')
  updateParams(@Req() req: JwtReq, @Body() body: unknown) {
    const dto = UpdateParamsDto.parse(body);
    return this.admin.updateParams(req.user.orgId, dto);
  }

  // ── Usuarios ───────────────────────────────────────────────────────────────

  @Get('users')
  listUsers(@Req() req: JwtReq) {
    return this.admin.listUsers(req.user.orgId);
  }

  @Post('users')
  createUser(@Req() req: JwtReq, @Body() body: unknown) {
    const dto = CreateUserDto.parse(body);
    return this.admin.createUser(req.user.orgId, dto);
  }

  @Patch('users/:id')
  updateUser(@Req() req: JwtReq, @Param('id') id: string, @Body() body: unknown) {
    const dto = UpdateUserDto.parse(body);
    return this.admin.updateUser(req.user.orgId, id, dto);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Req() req: JwtReq, @Param('id') id: string, @Body() body: unknown) {
    const dto = ResetPasswordDto.parse(body);
    return this.admin.resetPassword(req.user.orgId, id, dto);
  }

  @Get('users/:id/projects')
  getUserProjects(@Req() req: JwtReq, @Param('id') id: string) {
    return this.admin.getUserProjects(req.user.orgId, id);
  }

  // ── Miembros de proyecto ───────────────────────────────────────────────────

  @Get('projects/:projectId/members')
  getProjectMembers(@Req() req: JwtReq, @Param('projectId') projectId: string) {
    return this.admin.getProjectMembers(req.user.orgId, projectId);
  }

  @Post('projects/:projectId/members')
  addProjectMember(
    @Req() req: JwtReq,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const dto = AddMemberDto.parse(body);
    return this.admin.addProjectMember(req.user.orgId, projectId, dto);
  }

  @Delete('projects/:projectId/members/:userId')
  removeProjectMember(
    @Req() req: JwtReq,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.admin.removeProjectMember(req.user.orgId, projectId, userId);
  }

  // ── Auditoría ──────────────────────────────────────────────────────────────

  @Get('audit')
  @Roles('GERENTE', 'AUDITOR')
  getAuditLogs(@Req() req: JwtReq, @Query() query: unknown) {
    const dto = AuditQueryDto.parse(query);
    return this.admin.getAuditLogs(req.user.orgId, dto);
  }

  @Get('audit/stats')
  @Roles('GERENTE', 'AUDITOR')
  getAuditStats(@Req() req: JwtReq) {
    return this.admin.getAuditStats(req.user.orgId);
  }
}
