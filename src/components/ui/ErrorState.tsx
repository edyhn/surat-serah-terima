import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5"/>Data gagal dimuat</div><p className="mt-2 text-sm">{message}</p>{retry && <Button className="mt-4 bg-red-700 hover:bg-red-800" onClick={retry}>Coba lagi</Button>}</section>; }
