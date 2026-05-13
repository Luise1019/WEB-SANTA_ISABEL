import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  list(): Promise<Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'isActive'>[]> {
    return this.prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
      orderBy: { fullName: 'asc' },
    });
  }
}
