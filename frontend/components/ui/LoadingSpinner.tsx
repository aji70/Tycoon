'use client';

import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  /** Size: sm (default), md, lg */
  size?: 'sm' | 'md' | 'lg';
  /** Optional class for the wrapper */
  className?: string;
  /** Accent color - default cyan to match app theme */
  variant?: 'cyan' | 'amber' | 'white';
}

const sizeClasses = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-10 h-10 border-2',
};

const variantClasses = {
  cyan: 'border-[#00F0FF]/30 border-t-[#00F0FF]',
  amber: 'border-amber-400/30 border-t-amber-400',
  white: 'border-white/30 border-t-white',
};

export function LoadingSpinner({
  size = 'sm',
  className,
  variant = 'cyan',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full animate-spin',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    />
  );
}

export default LoadingSpinner;
