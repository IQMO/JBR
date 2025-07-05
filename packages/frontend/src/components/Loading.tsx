'use client';

import React from 'react';

import { componentClasses } from '../utils/theme';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-brand-primary',
    secondary: 'text-brand-secondary',
    success: 'text-status-success',
    warning: 'text-status-warning',
    error: 'text-status-error',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <LoadingSpinner size={size === 'sm' ? 'md' : size === 'lg' ? 'xl' : 'lg'} />
      <p className="mt-4 text-secondary text-sm">{message}</p>
    </div>
  );
};

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  className = '',
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className={`${componentClasses.card} p-8 text-center`}>
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-primary font-medium">{message}</p>
      </div>
    </div>
  );
};

interface LoadingCardProps {
  title?: string;
  message?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  title = 'Loading',
  message = 'Please wait while we fetch your data...',
  className = '',
}) => {
  return (
    <div className={`${componentClasses.card} ${className}`}>
      <div className="text-center py-12">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>
        <p className="text-secondary text-sm">{message}</p>
      </div>
    </div>
  );
};

interface LoadingTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const LoadingTable: React.FC<LoadingTableProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`${componentClasses.card} ${className}`}>
      <div className="animate-pulse">
        {/* Table header */}
        <div className="flex space-x-4 p-4 border-b border-border">
          {Array.from({ length: columns }).map((_, index) => (
            <div
              key={`header-${index}`}
              className="h-4 bg-surface-secondary rounded flex-1"
            />
          ))}
        </div>
        
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex space-x-4 p-4 border-b border-border last:border-b-0">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 bg-surface-secondary rounded flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  children,
  onClick,
  disabled = false,
  className = '',
  size = 'md',
  variant = 'primary',
}) => {
  const isDisabled = disabled || isLoading;
  
  const variantClasses = {
    primary: componentClasses.button.primary,
    secondary: componentClasses.button.secondary,
    success: componentClasses.button.success,
    warning: componentClasses.button.secondary, // fallback to secondary
    error: componentClasses.button.danger,
  };

  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${variantClasses[variant]} ${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center justify-center space-x-2">
        {isLoading && <LoadingSpinner size={spinnerSizes[size]} color="primary" />}
        <span>{children}</span>
      </div>
    </button>
  );
};

export default LoadingSpinner;
