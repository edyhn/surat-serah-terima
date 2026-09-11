import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "green" | "amber" }) { return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone === "blue" && "bg-blue-100 text-blue-800", tone === "green" && "bg-emerald-100 text-emerald-800", tone === "amber" && "bg-amber-100 text-amber-900", tone === "slate" && "bg-slate-100 text-slate-700")}>{children}</span>; }
