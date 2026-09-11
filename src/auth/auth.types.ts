import type { MemberRole } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: MemberRole;
  email: string;
}

export interface RequestUser {
  userId: string;
  tenantId: string;
  role: MemberRole;
  email: string;
}
