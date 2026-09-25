'use client';

import { useToastStore } from '@/hooks/useToast';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'bg-[#281a13] border-[#30343a] text-[#ff9565]',
  error: 'bg-[#291718] border-red-200 text-red-400',
  info: 'bg-[#281a13] border-[#30343a] text-[#ff9565]',
  warning: 'bg-[#282418] border-yellow-200 text-yellow-400',
};

const iconStyles = {
  success: 'text-brand-500',
  error: 'text-red-500',
  info: 'text-brand-500',
  warning: 'text-yellow-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300 ${styles[t.type]}`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconStyles[t.type]}`} />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
