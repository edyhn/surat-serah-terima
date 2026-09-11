"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";

export function TtdCanvas({
  onChange,
  disabled = false,
}: {
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const context = ref.current?.getContext("2d");
    if (context) {
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#0f172a";
    }
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * event.currentTarget.width) / rect.width,
      y: ((event.clientY - rect.top) * event.currentTarget.height) / rect.height,
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.beginPath();
    context?.moveTo(p.x, p.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) return;
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.lineTo(p.x, p.y);
    context?.stroke();
    setEmpty(false);
  }

  function end() {
    if (!drawing) return;
    setDrawing(false);
    const canvas = ref.current;
    if (canvas && !empty) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = ref.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Goreskan Tanda Tangan</span>
        {!empty && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            <Eraser className="size-3" />
            Hapus
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <canvas
          ref={ref}
          width={640}
          height={220}
          aria-label="Area gambar tanda tangan"
          className="h-36 w-full touch-none rounded-xl bg-white cursor-crosshair focus:outline-none"
          tabIndex={disabled ? -1 : 0}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Tandatangani di dalam area kotak ini
          </div>
        )}
      </div>
    </div>
  );
}
