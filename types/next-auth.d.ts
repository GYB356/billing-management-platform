import 'next-auth';
import { UserRole, OrganizationRole } from '@prisma/client';

declare module 'next-auth' {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    organizationId?: string;
    organizationRole?: OrganizationRole;
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string | null;
    backupCodes?: string[] | null;
  }

  interface Session {
    user: User;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    organizationId?: string;
    organizationRole?: OrganizationRole;
    twoFactorEnabled?: boolean;
  }
} 