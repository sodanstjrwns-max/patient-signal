'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-none border border-[#30343a] bg-[#111315] px-3.5 py-2 text-sm text-[#f5f5ef] placeholder:text-[#959c9f] focus:outline-none focus:ring-2 focus:ring-[#d9ff43]/50 focus:border-[#30343a] disabled:cursor-not-allowed disabled:bg-[#08090a] disabled:text-[#959c9f] transition-colors',
            error && 'border-red-500 focus:ring-red-500/40',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500 font-medium">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
