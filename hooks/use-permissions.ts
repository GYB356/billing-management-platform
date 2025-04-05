'use client';

import { useSession } from 'next-auth/react';
import { Permission, hasPermission } from '@/lib/auth/rbac';
import { useEffect, useState } from 'react';

export function usePermissions() {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch('/api/auth/permissions');
        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }
        const data = await response.json();
        setPermissions(data.permissions);
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [status]);

  const hasAccess = (permission: Permission): boolean => {
    if (!session?.user) return false;
    return hasPermission(
      session.user.role,
      session.user.organizationRole || 'MEMBER',
      permission
    );
  };

  return {
    permissions,
    hasAccess,
    loading,
  };
} 