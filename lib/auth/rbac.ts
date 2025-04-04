import { UserRole, OrganizationRole } from '@prisma/client';

export type Permission = 
  | 'manage:subscriptions'
  | 'view:subscriptions'
  | 'manage:users'
  | 'view:users'
  | 'manage:organizations'
  | 'view:organizations'
  | 'view:analytics'
  | 'manage:analytics'
  | 'manage:settings'
  | 'view:settings'
  | 'manage:billing'
  | 'view:billing'
  | 'manage:referrals'
  | 'view:referrals'
  | 'manage:invoices'
  | 'view:invoices'
  | 'manage:taxes'
  | 'view:taxes'
  | 'manage:system';

const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'manage:subscriptions',
    'view:subscriptions',
    'manage:users',
    'view:users',
    'manage:organizations',
    'view:organizations',
    'view:analytics',
    'manage:analytics',
    'manage:settings',
    'view:settings',
    'manage:billing',
    'view:billing',
    'manage:referrals',
    'view:referrals',
    'manage:invoices',
    'view:invoices',
    'manage:taxes',
    'view:taxes',
    'manage:system'
  ],
  ADMIN: [
    'manage:subscriptions',
    'view:subscriptions',
    'manage:users',
    'view:users',
    'manage:organizations',
    'view:organizations',
    'view:analytics',
    'manage:analytics',
    'manage:settings',
    'view:settings',
    'manage:billing',
    'view:billing',
    'manage:referrals',
    'view:referrals',
    'manage:invoices',
    'view:invoices',
    'manage:taxes',
    'view:taxes'
  ],
  STAFF: [
    'view:subscriptions',
    'view:users',
    'view:organizations',
    'view:analytics',
    'view:settings',
    'view:billing',
    'view:referrals',
    'view:invoices',
    'view:taxes'
  ],
  USER: [
    'view:subscriptions',
    'manage:subscriptions',
    'view:settings',
    'manage:settings',
    'view:billing',
    'view:referrals',
    'manage:referrals',
    'view:invoices'
  ],
};

const orgRolePermissions: Record<OrganizationRole, Permission[]> = {
  OWNER: [
    'manage:subscriptions',
    'view:subscriptions',
    'manage:users',
    'view:users',
    'manage:organizations',
    'view:organizations',
    'view:analytics',
    'manage:settings',
    'view:settings',
    'manage:billing',
    'view:billing',
    'manage:referrals',
    'view:referrals',
    'manage:invoices',
    'view:invoices',
    'manage:taxes',
    'view:taxes'
  ],
  ADMIN: [
    'manage:subscriptions',
    'view:subscriptions',
    'manage:users',
    'view:users',
    'view:analytics',
    'manage:settings',
    'view:settings',
    'view:billing',
    'manage:referrals',
    'view:referrals',
    'view:invoices',
    'view:taxes'
  ],
  MEMBER: [
    'view:subscriptions',
    'view:analytics',
    'view:settings',
    'view:billing',
    'view:referrals',
    'view:invoices'
  ],
};

export function hasPermission(
  userRole: UserRole,
  orgRole: OrganizationRole,
  permission: Permission
): boolean {
  const userPermissions = rolePermissions[userRole] || [];
  const orgPermissions = orgRolePermissions[orgRole] || [];
  
  return userPermissions.includes(permission) || orgPermissions.includes(permission);
}

export function requirePermission(
  userRole: UserRole,
  orgRole: OrganizationRole,
  permission: Permission
): void {
  if (!hasPermission(userRole, orgRole, permission)) {
    throw new Error('Insufficient permissions');
  }
}

export function getPermissions(
  userRole: UserRole,
  orgRole: OrganizationRole
): Permission[] {
  const userPermissions = rolePermissions[userRole] || [];
  const orgPermissions = orgRolePermissions[orgRole] || [];
  
  return [...new Set([...userPermissions, ...orgPermissions])];
} 