import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../core/config/app-config.service.js';
import { PrismaService } from '../core/db/prisma.service.js';
import { MemberRole } from '../generated/prisma/enums.js';
import type {
  AuthResponseDto,
  LoginDto,
  MeResponseDto,
  RegisterDto,
} from './auth.dto.js';
import type { JwtPayload } from './auth.types.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (!dto.claimTenantId && !dto.tenantName) {
      throw new BadRequestException('Укажите tenantName или claimTenantId');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    if (dto.claimTenantId) {
      return this.registerClaimingTenant(dto, passwordHash);
    }

    return this.registerWithNewTenant(dto, passwordHash);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Пока один арендатор на пользователя. Переключатель появится позже.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new UnauthorizedException('У пользователя нет доступа ни к одному арендатору');
    }

    return this.issueToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      tenantId: membership.tenant.id,
      tenantName: membership.tenant.name,
    });
  }

  async me(userId: string, tenantId: string): Promise<MeResponseDto> {
    const [user, tenant, membership] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.withTenant(tenantId, (tx) => tx.tenant.findUnique({ where: { id: tenantId } })),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.membership.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        }),
      ),
    ]);

    if (!user || !user.isActive || !tenant || !membership) {
      throw new UnauthorizedException('Сессия больше недействительна');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    };
  }

  private async registerWithNewTenant(
    dto: RegisterDto,
    passwordHash: string,
  ): Promise<AuthResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
        },
      });

      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName! },
      });

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: MemberRole.OWNER,
        },
      });

      return { user, tenant };
    });

    return this.issueToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: MemberRole.OWNER,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
    });
  }

  /// Подключение к арендатору, у которого ещё нет участников.
  /// Нужен переходный путь: данные Авито уже лежат на арендаторе,
  /// созданном до появления логина.
  private async registerClaimingTenant(
    dto: RegisterDto,
    passwordHash: string,
  ): Promise<AuthResponseDto> {
    const tenantId = dto.claimTenantId!;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new BadRequestException('Арендатор для claimTenantId не найден');
      }

      const members = await tx.membership.count({ where: { tenantId } });
      if (members > 0) {
        throw new ConflictException('У этого арендатора уже есть участники');
      }

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
        },
      });

      await tx.membership.create({
        data: {
          tenantId,
          userId: user.id,
          role: MemberRole.OWNER,
        },
      });

      return { user, tenant };
    });

    return this.issueToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: MemberRole.OWNER,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
    });
  }

  private async issueToken(input: {
    userId: string;
    email: string;
    name: string;
    role: MemberRole;
    tenantId: string;
    tenantName: string;
  }): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      email: input.email,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtExpiresIn as `${number}d`,
    });

    return {
      accessToken,
      user: {
        id: input.userId,
        email: input.email,
        name: input.name,
        role: input.role,
      },
      tenant: {
        id: input.tenantId,
        name: input.tenantName,
      },
    };
  }
}
