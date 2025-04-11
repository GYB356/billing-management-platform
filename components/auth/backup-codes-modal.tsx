'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface BackupCodesModalProps {
  backupCodes: string[];
  onClose: () => void;
}

export function BackupCodesModal({
  backupCodes,
  onClose,
}: BackupCodesModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy backup codes:', error);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Backup Codes</DialogTitle>
          <DialogDescription>
            Save these backup codes in a secure place. You can use them to access
            your account if you lose your 2FA device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Each backup code can only be used once. After using a code, it will
              be invalidated.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {backupCodes.map((code, index) => (
              <div key={index} className="mb-2">
                {code}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copied!
                </>
              ) : (
                'Copy All'
              )}
            </Button>
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 