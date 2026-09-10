import { forwardRef, type SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> { label: string; error?: string }
export const Select = forwardRef<HTMLSelectElement, Props>(({ label, error, id, children, ...props }, ref) => { const selectId = id ?? props.name; return <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor={selectId}>{label}<select ref={ref} id={selectId} aria-invalid={Boolean(error)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" {...props}>{children}</select>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</label>; });
Select.displayName = "Select";
