'use client';

import { create } from 'zustand';
import { useEffect, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // 자동 제거
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, toast.duration || 4000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// 편의 함수
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);

  return {
    success: useCallback((message: string) => addToast({ message, type: 'success' }), [addToast]),
    error: useCallback((message: string) => addToast({ message, type: 'error', duration: 6000 }), [addToast]),
    info: useCallback((message: string) => addToast({ message, type: 'info' }), [addToast]),
    warning: useCallback((message: string) => addToast({ message, type: 'warning', duration: 5000 }), [addToast]),
  };
}

// 비-hook 컨텍스트에서 쓸 수 있는 전역 함수
export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ message, type: 'success' }),
  error: (message: string) => useToastStore.getState().addToast({ message, type: 'error', duration: 6000 }),
  info: (message: string) => useToastStore.getState().addToast({ message, type: 'info' }),
  warning: (message: string) => useToastStore.getState().addToast({ message, type: 'warning', duration: 5000 }),
};
