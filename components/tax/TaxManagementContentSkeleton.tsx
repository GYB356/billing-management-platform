import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TaxManagementContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-20" />
      </div>
      <Tabs defaultValue="rates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rates" disabled>Tax Rates</TabsTrigger>
          <TabsTrigger value="reports" disabled>Tax Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-6">
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Add New Tax Rate</h2>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/3" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Tax Rates</h2>
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Generate Tax Report</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-[240px]" />
                <Skeleton className="h-10 w-[240px]" />
                <Skeleton className="h-10 w-[120px]" />
              </div>
              <Skeleton className="h-[400px] w-full" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 