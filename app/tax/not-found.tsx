import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function TaxManagementNotFound() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
      <div className="flex items-center space-x-2">
        <FileQuestion className="h-6 w-6" />
        <h2 className="text-lg font-semibold">Page Not Found</h2>
      </div>
      <p className="text-muted-foreground text-center max-w-[500px]">
        The tax management page you're looking for doesn't exist. Please check the URL and try again.
      </p>
      <Button asChild variant="outline">
        <Link href="/tax">Return to Tax Management</Link>
      </Button>
    </div>
  );
} 