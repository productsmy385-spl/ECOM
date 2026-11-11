"use client";

import { type CanvasConfig, DesignSurface, layerTransform } from "@ecom/ui/design";
import { type CanvasValue, DESIGN_FONTS, type ImageLayer, type Layer, type TextLayer } from "@ecom/validation";
import {
  ArrowDown, ArrowUp, Bold, Eye, EyeOff, ImagePlus, Italic, Loader2, Lock, Redo2, RotateCcw, Trash2, Type, Undo2, Unlock,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadError, uploadDesignImage } from "@/lib/upload-design-image";

const SWATCHES = ["#000000", "#FFFFFF", "#CF0F47", "#FF0B55", "#FFDEDE", "#C9A227", "#1D3A8A", "#0F8A4F"];
const newId = () => `l-${Math.random().toString(36).slice(2, 10)}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Approximate local-space box for the selection outline (text width is font-dependent). */
function layerBox(l: Layer, W: number, H: number) {
  if (l.type === "image") return { w: l.w * W, h: l.h * H };
  const fs = l.size * H;
  return { w: Math.max(fs, l.text.length * fs * 0.56), h: fs * 1.25 };
}

export function CanvasEditor({
  config,
  value,
  onChange,
  label,
}: {
  config: CanvasConfig;
  value: CanvasValue;
  onChange: (v: CanvasValue) => void;
  label: string;
}) {
  const W = config.width;
  const H = config.height;
  const pa = config.printArea;
  const layers = value.layers;
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<Layer[][]>([]);
  const [future, setFuture] = useState<Layer[][]>([]);
  const [guides, setGuides] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: Layer[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const full = layers.length >= config.maxLayers;

  /** Commit a change with undo history. */
  const commit = useCallback(
    (next: Layer[], before: Layer[] = layers) => {
      setPast((p) => [...p.slice(-49), before]);
      setFuture([]);
      onChange({ layers: next });
    },
    [layers, onChange],
  );
  const update = (id: string, p: Partial<Layer>) => commit(layers.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)));

  function undo() {
    const prev = past.at(-1);
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [layers, ...f]);
    onChange({ layers: prev });
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, layers]);
    onChange({ layers: next });
  }

  function addText() {
    if (full || !config.allowText) return;
    const font = (config.fonts[0] ?? "sora") as TextLayer["font"];
    const layer: TextLayer = {
      id: newId(), type: "text", text: "Your text", font, size: 0.12, color: "#000000", weight: 700, italic: false,
      align: "middle", x: pa.x + pa.w / 2, y: pa.y + pa.h / 2, rotation: 0, visible: true, locked: false,
    };
    commit([...layers, layer]);
    setSelectedId(layer.id);
  }

  async function addImage(file: File | undefined) {
    if (!file || full) return;
    setUploading(true);
    setNotice(null);
    try {
      const img = await uploadDesignImage(file);
      // Fit to 60% of the print area, preserving the image's aspect ratio.
      const maxW = pa.w * 0.6;
      const maxH = pa.h * 0.6;
      const aspect = (img.height / img.width) * (W / H); // h/w in normalised units
      let w = maxW;
      let h = w * aspect;
      if (h > maxH) {
        h = maxH;
        w = h / aspect;
      }
      const layer: ImageLayer = { id: newId(), type: "image", url: img.url, w, h, x: pa.x + pa.w / 2, y: pa.y + pa.h / 2, rotation: 0, visible: true, locked: false };
      commit([...layers, layer]);
      setSelectedId(layer.id);
    } catch (err) {
      setNotice(err instanceof UploadError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(id: string) {
    commit(layers.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function reorder(id: string, dir: -1 | 1) {
    const i = layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  }

  // ----- pointer interaction (SVG user units → normalised)
  function toCanvas(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x / W, y: pt.y / H };
  }
  function onLayerDown(e: React.PointerEvent, l: Layer) {
    e.stopPropagation();
    setSelectedId(l.id);
    if (l.locked) return;
    const p = toCanvas(e);
    drag.current = { id: l.id, dx: p.x - l.x, dy: p.y - l.y, before: layers };
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    // Keep the layer's centre inside the print area.
    const x = clamp(p.x - d.dx, pa.x, pa.x + pa.w);
    const y = clamp(p.y - d.dy, pa.y, pa.y + pa.h);
    onChange({ layers: layers.map((l) => (l.id === d.id ? ({ ...l, x, y } as Layer) : l)) });
  }
  function onUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // One undo step per drag, not per mouse move.
    setPast((p) => [...p.slice(-49), d.before]);
    setFuture([]);
  }

  function onKey(e: React.KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (!selected) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !selected.locked) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      update(selected.id, { x: clamp(selected.x + dx, pa.x, pa.x + pa.w), y: clamp(selected.y + dy, pa.y, pa.y + pa.h) });
    } else if ((e.key === "Delete" || e.key === "Backspace") && !selected.locked && (e.target as HTMLElement).tagName !== "INPUT") {
      e.preventDefault();
      remove(selected.id);
    } else if (e.key === "Escape") setSelectedId(null);
  }

  const box = selected?.visible ? layerBox(selected, W, H) : null;
  const pad = W / 120;
  const overlay =
    selected && box ? (
      <g transform={layerTransform(selected, W, H)} pointerEvents="none">
        <rect
          x={(selected.type === "text" && selected.align === "start" ? 0 : selected.type === "text" && selected.align === "end" ? -box.w : -box.w / 2) - pad}
          y={-box.h / 2 - pad}
          width={box.w + pad * 2}
          height={box.h + pad * 2}
          fill="none"
          stroke="#FF0B55"
          strokeWidth={W / 400}
          strokeDasharray={selected.locked ? `${W / 150} ${W / 200}` : undefined}
        />
      </g>
    ) : null;

  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm font-medium hover:border-primary disabled:opacity-40 disabled:hover:border-input";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Design tools">
        {config.allowText && (
          <button type="button" className={btn} onClick={addText} disabled={full}>
            <Type className="h-4 w-4" /> Add text
          </button>
        )}
        {config.allowImages && (
          <>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()} disabled={full || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add image
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload an image" onChange={(e) => addImage(e.target.files?.[0])} />
          </>
        )}
        <span className="mx-1 hidden w-px bg-border sm:block" />
        <button type="button" className={btn} onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <button
          type="button"
          className={btn}
          disabled={!layers.length}
          onClick={() => {
            if (window.confirm("Remove everything from the design?")) {
              commit([]);
              setSelectedId(null);
            }
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="h-4 w-4 accent-primary" /> Print area
        </label>
      </div>
      {full && <p className="text-xs text-muted-foreground">You&apos;ve reached the maximum of {config.maxLayers} elements.</p>}
      {notice && <p role="alert" className="text-sm text-destructive">{notice}</p>}

      <div
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`${label} canvas. Select an element, then use arrow keys to move it, Delete to remove it.`}
        // select-none: dragging must not start a browser text selection on SVG text.
        className="select-none overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DesignSurface
          svgRef={svgRef}
          config={config}
          value={value}
          showPrintArea={guides}
          overlay={overlay}
          title={label}
          onPointerDown={() => setSelectedId(null)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          layerProps={(l) => ({
            onPointerDown: (e: React.PointerEvent) => onLayerDown(e, l),
            style: { cursor: l.locked ? "default" : "move" },
          })}
        />
      </div>

      {selected && <LayerProperties layer={selected} fonts={config.fonts} onChange={(p) => update(selected.id, p)} />}

      {layers.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layers (top first)</p>
          <ul>
            {[...layers].reverse().map((l) => (
              <li key={l.id} className={cn("flex items-center gap-1 border-b border-border px-2 py-1.5 last:border-0", l.id === selectedId && "bg-accent/60")}>
                <button type="button" onClick={() => setSelectedId(l.id)} className="min-w-0 flex-1 truncate px-1 text-left text-sm">
                  {l.type === "text" ? `“${l.text}”` : "Image"}
                </button>
                <IconBtn label={l.visible ? "Hide" : "Show"} onClick={() => update(l.id, { visible: !l.visible })}>{l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</IconBtn>
                <IconBtn label={l.locked ? "Unlock" : "Lock"} onClick={() => update(l.id, { locked: !l.locked })}>{l.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</IconBtn>
                <IconBtn label="Bring forward" onClick={() => reorder(l.id, 1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                <IconBtn label="Send backward" onClick={() => reorder(l.id, -1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                <IconBtn label="Delete" onClick={() => remove(l.id)} danger><Trash2 className="h-4 w-4" /></IconBtn>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cn("rounded-md p-1.5 hover:bg-muted", danger ? "text-destructive" : "text-muted-foreground")}>
      {children}
    </button>
  );
}

function LayerProperties({ layer, fonts, onChange }: { layer: Layer; fonts: readonly string[]; onChange: (p: Partial<Layer>) => void }) {
  const field = "h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring";
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
      {layer.type === "text" ? (
        <>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Text</span>
            <input className={field} maxLength={80} value={layer.text} onChange={(e) => onChange({ text: e.target.value })} disabled={layer.locked} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Font</span>
            <select className={field} value={layer.font} onChange={(e) => onChange({ font: e.target.value as TextLayer["font"] })} disabled={layer.locked}>
              {DESIGN_FONTS.filter((f) => fonts.includes(f.id)).map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Size</span>
            <input type="range" min={0.03} max={0.4} step={0.005} value={layer.size} onChange={(e) => onChange({ size: Number(e.target.value) })} disabled={layer.locked} className="w-full accent-primary" />
          </label>
          <div className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => onChange({ color: c })} disabled={layer.locked}
                  className={cn("h-7 w-7 rounded-full border-2", layer.color === c ? "border-primary" : "border-border")} style={{ backgroundColor: c }} />
              ))}
              <input type="color" aria-label="Custom colour" value={layer.color} onChange={(e) => onChange({ color: e.target.value.toUpperCase() })} disabled={layer.locked} className="h-8 w-10 rounded border border-input p-0.5" />
              <button type="button" aria-pressed={layer.weight === 700} onClick={() => onChange({ weight: layer.weight === 700 ? 400 : 700 })} disabled={layer.locked}
                className={cn("rounded-md border p-1.5", layer.weight === 700 ? "border-primary text-primary" : "border-input")} aria-label="Bold"><Bold className="h-4 w-4" /></button>
              <button type="button" aria-pressed={layer.italic} onClick={() => onChange({ italic: !layer.italic })} disabled={layer.locked}
                className={cn("rounded-md border p-1.5", layer.italic ? "border-primary text-primary" : "border-input")} aria-label="Italic"><Italic className="h-4 w-4" /></button>
            </div>
          </div>
        </>
      ) : (
        <label className="space-y-1 text-sm">
          <span className="font-medium">Size</span>
          <input
            type="range" min={0.05} max={1.2} step={0.01} value={layer.w} disabled={layer.locked} className="w-full accent-primary"
            onChange={(e) => {
              const w = Number(e.target.value);
              onChange({ w, h: layer.h * (w / layer.w) });
            }}
          />
        </label>
      )}
      <label className="space-y-1 text-sm">
        <span className="font-medium">Rotate ({Math.round(layer.rotation)}°)</span>
        <input type="range" min={-180} max={180} step={1} value={layer.rotation} onChange={(e) => onChange({ rotation: Number(e.target.value) })} disabled={layer.locked} className="w-full accent-primary" />
      </label>
    </div>
  );
}
