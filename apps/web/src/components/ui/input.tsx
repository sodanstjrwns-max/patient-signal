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
            'flex h-11 w-full rounded-none border border-[#d4d6cb] bg-white px-3.5 py-2 text-sm text-[#141512] placeholder:text-[#989b8d] focus:outline-none focus:ring-2 focus:ring-[#d0ff43]/50 focus:border-[#141512] disabled:cursor-not-allowed disabled:bg-[#f1f1eb] disabled:text-[#72756a] transition-colors',
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
