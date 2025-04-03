'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Permission, hasPermission } from '@/lib/auth/rbac';
import { Loader2 } from 'lucide-react';

interface WithPermissionProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function WithPermission({
  permission,
  children,
  fallback = (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
}: WithPermissionProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <>{fallback}</>;
  }

  if (!session?.user) {
    return null;
  }

  const hasAccess = hasPermission(
    session.user.role,
    session.user.organizationRole || 'MEMBER',
    permission
  );

  if (!hasAccess) {
    router.push('/unauthorized');
    return null;
  }

  return <>{children}</>;
} 