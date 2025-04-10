import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

type PrivacyAction = 'export' | 'delete' | 'update';

export default function PrivacyRights() {
  const [loading, setLoading] = useState<PrivacyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePrivacyAction = async (action: PrivacyAction, data?: any) => {
    setLoading(action);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/privacy/rights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An error occurred');
      }

      if (action === 'export') {
        // Handle data export - download as JSON file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Data exported successfully",
          description: "Your data has been downloaded as a JSON file.",
        });
      } else {
        setSuccess(`Action completed successfully: ${action}`);
        toast({
          title: "Success",
          description: `Your ${action} request has been processed successfully.`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      handlePrivacyAction('delete');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Privacy Rights</h2>
      <p className="text-muted-foreground">
        Under GDPR and CCPA, you have certain rights regarding your personal data.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export Your Data</CardTitle>
            <CardDescription>
              Download a copy of your personal data in a machine-readable format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>This will include your profile information, preferences, and other data we store about you.</p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => handlePrivacyAction('export')} 
              disabled={loading === 'export'}
              className="w-full"
            >
              {loading === 'export' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export My Data
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete Your Account</CardTitle>
            <CardDescription>
              Request the deletion of your account and personal data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>This will anonymize your data and deactivate your account. Some information may be retained for legal or administrative purposes.</p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleDeleteAccount} 
              disabled={loading === 'delete'}
              variant="destructive"
              className="w-full"
            >
              {loading === 'delete' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Privacy Preferences</CardTitle>
            <CardDescription>
              Manage how your data is used and stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Marketing Communications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about new features and promotions
                  </p>
                </div>
                <Button 
                  onClick={() => handlePrivacyAction('update', { preferences: { marketing: true } })}
                  disabled={loading === 'update'}
                  variant="outline"
                >
                  {loading === 'update' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Data Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    Allow us to use your data to improve our services
                  </p>
                </div>
                <Button 
                  onClick={() => handlePrivacyAction('update', { preferences: { analytics: true } })}
                  disabled={loading === 'update'}
                  variant="outline"
                >
                  {loading === 'update' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 