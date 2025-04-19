import React from 'react';

interface ErrorMessageProps {
  message: string;
  variant?: 'error' | 'warning' | 'info';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  variant = 'error'
}) => {
  const variantClasses = {
    error: 'bg-red-50 text-red-700 border-red-400',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-400',
    info: 'bg-blue-50 text-blue-700 border-blue-400'
  };

  return (
    <div className={`rounded-md p-4 border ${variantClasses[variant]}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {variant === 'error' && (
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}; 