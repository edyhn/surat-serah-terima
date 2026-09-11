import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string }
export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, id, className, ...props }, ref) => {
  const inputId = id ?? props.name;
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor={inputId}>{label}<input ref={ref} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className={cn("min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100", className)} {...props}/>{error && <span id={`${inputId}-error`} role="alert" className="text-xs text-red-700">{error}</span>}</label>;
});
Input.displayName = "Input";
