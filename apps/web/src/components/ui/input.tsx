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
            'flex h-11 w-full rounded-[10px] border border-[#dce2e9] bg-white px-3.5 py-2 text-sm text-[#17212e] placeholder:text-[#9aa6b5] focus:outline-none focus:ring-2 focus:ring-[#285cf4]/15 focus:border-[#285cf4] disabled:cursor-not-allowed disabled:bg-[#f5f7fa] disabled:text-[#69788b] transition-colors',
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
