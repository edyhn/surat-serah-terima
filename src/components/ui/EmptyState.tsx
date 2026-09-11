import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-500 shadow-inner">
        <Inbox className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-bold text-white">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
