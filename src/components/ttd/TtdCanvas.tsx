"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function TtdCanvas({ onChange, disabled = false }: { onChange: (dataUrl: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null); const [drawing, setDrawing] = useState(false); const [empty, setEmpty] = useState(true);
  useEffect(() => { const context = ref.current?.getContext("2d"); if (context) { context.lineWidth = 2; context.lineCap = "round"; context.strokeStyle = "#0f172a"; } }, []);
  function point(event: PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width, y: (event.clientY - rect.top) * event.currentTarget.height / rect.height }; }
  function start(event: PointerEvent<HTMLCanvasElement>) { if (disabled) return; const p = point(event); const context = event.currentTarget.getContext("2d"); context?.beginPath(); context?.moveTo(p.x, p.y); event.currentTarget.setPointerCapture(event.pointerId); setDrawing(true); }
  function move(event: PointerEvent<HTMLCanvasElement>) { if (!drawing || disabled) return; const p = point(event); const context = event.currentTarget.getContext("2d"); context?.lineTo(p.x, p.y); context?.stroke(); setEmpty(false); }
  function end() { if (!drawing) return; setDrawing(false); const canvas = ref.current; if (canvas && !empty) onChange(canvas.toDataURL("image/png")); }
  function clear() { const canvas = ref.current; canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); setEmpty(true); onChange(""); }
  return <div className="grid gap-2"><span className="text-sm font-medium text-slate-700">Tanda tangan</span><canvas ref={ref} width={640} height={220} aria-label="Area gambar tanda tangan" className="h-40 w-full touch-none rounded-lg border border-slate-300 bg-white focus:outline-2 focus:outline-blue-700" tabIndex={disabled ? -1 : 0} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><Button className="justify-self-start bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" onClick={clear} disabled={disabled || empty}><Eraser className="size-4"/>Bersihkan</Button></div>;
}
