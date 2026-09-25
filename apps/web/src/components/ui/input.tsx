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
            'flex h-11 w-full rounded-lg border border-[#dee4d9] bg-white px-3.5 py-2 text-sm text-[#15231b] placeholder:text-[#8d9789] focus:outline-none focus:ring-2 focus:ring-[#36765a]/15 focus:border-[#36765a] disabled:cursor-not-allowed disabled:bg-[#f4f5ef] disabled:text-[#778378] transition-colors',
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
