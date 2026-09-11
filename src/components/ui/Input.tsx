import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, className, id, name, disabled, ...props }: InputProps) {
  const inputId = id || name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        disabled={disabled}
        className={cn(
          "w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && (
        <span role="alert" className="block text-[11px] font-medium text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
