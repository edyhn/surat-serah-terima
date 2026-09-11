import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function Select({ label, error, className, id, name, disabled, children, ...props }: SelectProps) {
  const selectId = id || name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-xs font-semibold text-slate-300">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          name={name}
          disabled={disabled}
          className={cn(
            "w-full appearance-none rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <span role="alert" className="block text-[11px] font-medium text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
