import { Injectable } from '@nestjs/common';

import { PrismaService } from '../core/db/prisma.service.js';

export interface TenantView {
  id: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Создание арендатора — единственная операция без контекста арендатора:
  /// его ещё не существует. Политика RLS на tenants это допускает.
  async create(name: string): Promise<TenantView> {
    const tenant = await this.prisma.tenant.create({ data: { name } });

    return { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt };
  }

  async findById(tenantId: string): Promise<TenantView | null> {
    const tenant = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId } }),
    );

    return tenant ? { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt } : null;
  }
}
