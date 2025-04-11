import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load

    if (!session) {
      router.push('/auth/signin'); // Redirect to sign-in if not authenticated
    }
  }, [session, status, router]);

  return { session, status };
}