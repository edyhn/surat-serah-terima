import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "indigo" | "purple" | "rose";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        tone === "blue" && "border border-blue-200 bg-blue-50 text-blue-700",
        tone === "green" && "border border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "amber" && "border border-amber-200 bg-amber-50 text-amber-800",
        tone === "indigo" && "border border-indigo-200 bg-indigo-50 text-indigo-700",
        tone === "purple" && "border border-purple-200 bg-purple-50 text-purple-700",
        tone === "rose" && "border border-rose-200 bg-rose-50 text-rose-700",
        tone === "slate" && "border border-slate-200 bg-slate-100 text-slate-700"
      )}
    >
      {children}
    </span>
  );
}
