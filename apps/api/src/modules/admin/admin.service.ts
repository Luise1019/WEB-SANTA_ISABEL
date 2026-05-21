import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import type {
  AddMemberDto,
  AuditQueryDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateOrgDto,
  UpdateParamsDto,
  UpdateUserDto,
} from './dto/admin.dto';

const ORG_SELECT = {
  id: true, name: true, taxId: true, logoUrl: true,
  phone: true, address: true, city: true, website: true,
  reportFooter: true, reportColor: true,
  createdAt: true, updatedAt: true,
};

const PARAMS_SELECT = {
  id: true, organizationId: true,
  aiuAdmin: true, aiuImprevistos: true, aiuUtilidad: true,
  factorPrestacional: true,
  ivaRate: true, reteIvaRate: true, reteIcaRate: true,
  trm: true, smmlv: true, updatedAt: true,
};

const USER_SELECT = {
  id: true, email: true, fullName: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async requireOrg(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    return org;
  }

  // ── Organización ───────────────────────────────────────────────────────────

  async getOrg(orgId: string) {
    await this.requireOrg(orgId);
    return this.prisma.organization.findUnique({
      where:  { id: orgId },
      select: ORG_SELECT,
    });
  }

  async updateOrg(orgId: string, dto: UpdateOrgDto) {
    await this.requireOrg(orgId);
    return this.prisma.organization.update({
      where:  { id: orgId },
      data:   dto,
      select: ORG_SELECT,
    });
  }

  // ── Parámetros ─────────────────────────────────────────────────────────────

  async getParams(orgId: string) {
    let params = await this.prisma.systemParams.findUnique({
      where: { organizationId: orgId },
      select: PARAMS_SELECT,
    });
    // Auto-crear con valores por defecto si no existe
    if (!params) {
      params = await this.prisma.systemParams.create({
        data:   { organizationId: orgId },
        select: PARAMS_SELECT,
      });
    }
    return params;
  }

  async updateParams(orgId: string, dto: UpdateParamsDto) {
    const data: Record<string, unknown> = {};
    if (dto.aiuAdmin          !== undefined) data.aiuAdmin          = dto.aiuAdmin;
    if (dto.aiuImprevistos    !== undefined) data.aiuImprevistos    = dto.aiuImprevistos;
    if (dto.aiuUtilidad       !== undefined) data.aiuUtilidad       = dto.aiuUtilidad;
    if (dto.factorPrestacional!== undefined) data.factorPrestacional= dto.factorPrestacional;
    if (dto.ivaRate           !== undefined) data.ivaRate           = dto.ivaRate;
    if (dto.reteIvaRate       !== undefined) data.reteIvaRate       = dto.reteIvaRate;
    if (dto.reteIcaRate       !== undefined) data.reteIcaRate       = dto.reteIcaRate;
    if (dto.trm               !== undefined) data.trm               = dto.trm;
    if (dto.smmlv             !== undefined) data.smmlv             = dto.smmlv;

    return this.prisma.systemParams.upsert({
      where:  { organizationId: orgId },
      create: { organizationId: orgId, ...data },
      update: data,
      select: PARAMS_SELECT,
    });
  }

  // ── Usuarios ───────────────────────────────────────────────────────────────

  async listUsers(orgId: string) {
    return this.prisma.user.findMany({
      where:   { organizationId: orgId },
      select:  { ...USER_SELECT, _count: { select: { memberships: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  async createUser(orgId: string, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Ya existe un usuario con ese correo');

    const rawPass = dto.password ?? this.generateTempPassword();
    const passwordHash = await argon2.hash(rawPass);

    const user = await this.prisma.user.create({
      data: {
        organizationId: orgId,
        email:          dto.email,
        fullName:       dto.fullName,
        role:           dto.role as never,
        passwordHash,
        isActive:       true,
      },
      select: USER_SELECT,
    });

    // Devolver la contraseña temporal una sola vez (para mostrarla al admin)
    return { ...user, tempPassword: dto.password ? undefined : rawPass };
  }

  async updateUser(orgId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.user.update({
      where:  { id: userId },
      data:   dto as Record<string, unknown>,
      select: USER_SELECT,
    });
  }

  async resetPassword(orgId: string, userId: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  async getUserProjects(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, name: true, code: true, status: true, city: true },
        },
      },
    });
  }

  // ── Miembros de proyecto ───────────────────────────────────────────────────

  async getProjectMembers(orgId: string, projectId: string) {
    await this.requireProjectOwnership(orgId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: USER_SELECT } },
      orderBy: { user: { fullName: 'asc' } },
    });
  }

  async addProjectMember(orgId: string, projectId: string, dto: AddMemberDto) {
    await this.requireProjectOwnership(orgId, projectId);
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro del proyecto');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role as never },
      include: { user: { select: USER_SELECT } },
    });
  }

  async removeProjectMember(orgId: string, projectId: string, userId: string) {
    await this.requireProjectOwnership(orgId, projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('El usuario no es miembro del proyecto');
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    return { ok: true };
  }

  private async requireProjectOwnership(orgId: string, projectId: string) {
    const proj = await this.prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!proj) throw new NotFoundException('Proyecto no encontrado');
    return proj;
  }

  // ── Auditoría ──────────────────────────────────────────────────────────────

  async getAuditLogs(orgId: string, q: AuditQueryDto) {
    // Sólo logs de usuarios de esta organización
    const orgUserIds = (await this.prisma.user.findMany({
      where:  { organizationId: orgId },
      select: { id: true },
    })).map((u) => u.id);

    const where = {
      ...(q.userId     ? { userId:     q.userId }     : { userId: { in: [...orgUserIds, null as unknown as string] } }),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.action     ? { action:     { contains: q.action, mode: 'insensitive' as const } } : {}),
      ...(q.from || q.to ? {
        createdAt: {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to   ? { lte: new Date(q.to)   } : {}),
        },
      } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip:  (q.page - 1) * q.limit,
        take:  q.limit,
      }),
    ]);

    return {
      data:  items,
      total,
      page:  q.page,
      pages: Math.ceil(total / q.limit),
    };
  }

  async getAuditStats(orgId: string) {
    const orgUserIds = (await this.prisma.user.findMany({
      where:  { organizationId: orgId },
      select: { id: true },
    })).map((u) => u.id);

    const [totalToday, totalWeek, byModule] = await this.prisma.$transaction([
      this.prisma.auditLog.count({
        where: {
          userId:    { in: orgUserIds },
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId:    { in: orgUserIds },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.auditLog.groupBy({
        by:       ['entityType'],
        where:    { userId: { in: orgUserIds } },
        _count:   { _all: true },
        orderBy:  { _count: { entityType: 'desc' } },
        take:     8,
      }),
    ]);

    return { totalToday, totalWeek, byModule };
  }

  // ── Utils ──────────────────────────────────────────────────────────────────

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
