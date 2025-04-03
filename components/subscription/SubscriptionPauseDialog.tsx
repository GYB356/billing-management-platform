import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface SubscriptionPauseDialogProps {
  subscriptionId: string;
  isPaused: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

export function SubscriptionPauseDialog({
  subscriptionId,
  isPaused,
  onPause,
  onResume,
}: SubscriptionPauseDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pauseDuration, setPauseDuration] = useState('30');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePause = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/subscription/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pauseDuration: parseInt(pauseDuration),
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pause subscription');
      }

      toast.success('Subscription paused successfully');
      setIsOpen(false);
      onPause?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pause subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume subscription');
      }

      toast.success('Subscription resumed successfully');
      setIsOpen(false);
      onResume?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={isPaused ? 'default' : 'destructive'}>
          {isPaused ? 'Resume Subscription' : 'Pause Subscription'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPaused ? 'Resume Subscription' : 'Pause Subscription'}
          </DialogTitle>
        </DialogHeader>
        {!isPaused && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Pause Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="90"
                value={pauseDuration}
                onChange={(e) => setPauseDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you pausing your subscription?"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={isPaused ? handleResume : handlePause}
            disabled={isLoading || (!isPaused && (!pauseDuration || parseInt(pauseDuration) < 1 || parseInt(pauseDuration) > 90))}
          >
            {isLoading ? 'Processing...' : isPaused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 