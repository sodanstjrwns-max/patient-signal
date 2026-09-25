"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Animate the displayed value while exposing the final value to assistive technology. */
export function AnimatedNumber({ value, decimals = 0, className }: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const target = Number.isFinite(value) ? value : 0;
  const precision = Math.max(0, Math.min(6, decimals));
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const start = current.current;
    const started = performance.now();
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = target;
      setDisplay(target);
    };
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 620);
      const eased = 1 - Math.pow(1 - progress, 4);
      current.current = start + (target - start) * eased;
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    if (preference.matches) finish();
    else frame = requestAnimationFrame(tick);
    const onPreferenceChange = () => { if (preference.matches) finish(); };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [target]);
  return <span className={cn("tabular-nums", className)}><span className="sr-only">{target.toFixed(precision)}</span><span aria-hidden="true">{display.toFixed(precision)}</span></span>;
}

/** One entrance when a section reaches the viewport; content remains visible without JS. */
export function Reveal({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || preference.matches || !("IntersectionObserver" in window)) return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      animation = element.animate([
        { opacity: 0, transform: "translateY(16px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 560, delay: Math.min(400, Math.max(0, delay)), easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      observer.disconnect();
    }, { threshold: 0.08 });
    const onPreferenceChange = () => { if (preference.matches) { animation?.cancel(); observer.disconnect(); } };
    observer.observe(element);
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      observer.disconnect();
      animation?.cancel();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

/** Pointer light follows the selected surface without rerendering its data. */
export function SignalSurface({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("signal-surface", className)} onPointerMove={(event) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }}>{children}</div>;
}
