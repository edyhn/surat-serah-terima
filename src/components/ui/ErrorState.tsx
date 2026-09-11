import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <section
      role="alert"
      className="flex flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
        <AlertCircle className="size-6" />
      </div>
      <h2 className="mt-3 text-sm font-bold text-red-300">Terjadi Kendala Memuat Data</h2>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-red-400/80">{message}</p>
      {retry && (
        <Button
          className="mt-4 rounded-xl bg-red-600 px-4 text-xs font-semibold hover:bg-red-500"
          onClick={retry}
        >
          Coba Muat Ulang
        </Button>
      )}
    </section>
  );
}
