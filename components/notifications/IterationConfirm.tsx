import React from 'react';
import { Button } from '../ui/button';

interface IterationConfirmProps {
  onConfirm: () => void;
  onDecline: () => void;
}

export const IterationConfirm: React.FC<IterationConfirmProps> = ({
  onConfirm,
  onDecline,
}) => {
  return (
    <div className="flex flex-col space-y-4 p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-700">Would you like to continue to iterate?</p>
      <div className="flex space-x-3">
        <Button
          onClick={onConfirm}
          variant="primary"
          size="sm"
        >
          Yes, continue
        </Button>
        <Button
          onClick={onDecline}
          variant="outline"
          size="sm"
        >
          No, complete
        </Button>
      </div>
    </div>
  );
}