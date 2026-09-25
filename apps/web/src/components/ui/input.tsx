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
            'flex h-11 w-full rounded-lg border border-[#dedee8] bg-white px-3.5 py-2 text-sm text-[#111118] placeholder:text-[#9997ad] focus:outline-none focus:ring-2 focus:ring-[#5b4dff]/15 focus:border-[#5b4dff] disabled:cursor-not-allowed disabled:bg-[#f4f4f8] disabled:text-[#737382] transition-colors',
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
