import { Injectable, NotFoundException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { STANDARD_CHAPTERS, type ProjectInput } from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { organizationId: DEFAULT_ORG_ID },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Proyecto ${id} no existe`);
    return project;
  }

  async create(input: ProjectInput): Promise<Project> {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: DEFAULT_ORG_ID,
          code: input.code,
          name: input.name,
          housingType: input.housingType,
          status: input.status,
          city: input.city,
          department: input.department,
          startDate: input.startDate,
          expectedEndDate: input.expectedEndDate,
          totalAreaM2: input.totalAreaM2?.toString() ?? null,
          saleableAreaM2: input.saleableAreaM2?.toString() ?? null,
          description: input.description,
        },
      });

      await tx.chapter.createMany({
        data: STANDARD_CHAPTERS.map((c, idx) => ({
          projectId: project.id,
          code: c.code,
          name: c.name,
          order: idx,
        })),
      });

      return project;
    });
  }
}
