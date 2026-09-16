import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label = "Memuat data" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-800/80 bg-slate-900/30 p-12 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
      <span className="text-xs font-medium text-slate-400">{label}…</span>
    </div>
  );
}
