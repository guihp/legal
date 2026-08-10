import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';

const PREVIEW_SIZE = 280;
const EXPORT_SIZE = 512;
const MAX_BYTES = 2 * 1024 * 1024;

const BG_PRESETS = [
  { id: 'cream', label: 'Creme', value: '#F7F5F0' },
  { id: 'white', label: 'Branco', value: '#FFFFFF' },
  { id: 'black', label: 'Preto', value: '#111111' },
  { id: 'transparent', label: 'Transparente', value: 'transparent' },
] as const;

type BgPresetId = (typeof BG_PRESETS)[number]['id'];

export type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  sourceFileName?: string;
  onOpenChange: (open: boolean) => void;
  onApply: (file: File) => void | Promise<void>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
}

function coverScale(iw: number, ih: number, size: number) {
  return Math.max(size / iw, size / ih);
}

async function canvasToFileUnderLimit(
  canvas: HTMLCanvasElement,
  preferPng: boolean,
  baseName: string,
): Promise<File> {
  const stem = baseName.replace(/\.[^.]+$/, '') || 'avatar';

  if (preferPng) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Falha ao exportar a imagem.');
    if (blob.size <= MAX_BYTES) {
      return new File([blob], `${stem}.png`, { type: 'image/png' });
    }
  }

  let quality = 0.92;
  let blob: Blob | null = null;
  while (quality >= 0.45) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob && blob.size <= MAX_BYTES) {
      return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' });
    }
    quality -= 0.08;
  }

  if (!blob) throw new Error('Falha ao exportar a imagem.');
  if (blob.size > MAX_BYTES) {
    throw new Error('Imagem ainda acima de 2MB após compressão. Tente outra foto.');
  }
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' });
}

export function AvatarCropDialog({
  open,
  imageSrc,
  sourceFileName = 'avatar.jpg',
  onOpenChange,
  onApply,
}: AvatarCropDialogProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [bgPreset, setBgPreset] = useState<BgPresetId>('cream');
  const [customColor, setCustomColor] = useState('#F7F5F0');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const background =
    useCustomColor
      ? customColor
      : BG_PRESETS.find((p) => p.id === bgPreset)?.value ?? '#F7F5F0';

  useEffect(() => {
    if (!open || !imageSrc) {
      setImg(null);
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBgPreset('cream');
    setCustomColor('#F7F5F0');
    setUseCustomColor(false);

    void loadImage(imageSrc)
      .then((loaded) => {
        if (!cancelled) setImg(loaded);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || 'Erro ao carregar imagem');
      });

    return () => {
      cancelled = true;
    };
  }, [open, imageSrc]);

  const scale = img
    ? coverScale(img.naturalWidth, img.naturalHeight, PREVIEW_SIZE) * zoom
    : 1;

  const drawWidth = img ? img.naturalWidth * scale : 0;
  const drawHeight = img ? img.naturalHeight * scale : 0;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setOffset({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const exportCropped = useCallback(async () => {
    if (!img) throw new Error('Imagem não carregada.');

    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas não disponível.');

    const ratio = EXPORT_SIZE / PREVIEW_SIZE;
    const exportScale = coverScale(img.naturalWidth, img.naturalHeight, PREVIEW_SIZE) * zoom;
    const w = img.naturalWidth * exportScale * ratio;
    const h = img.naturalHeight * exportScale * ratio;
    const dx = EXPORT_SIZE / 2 + offset.x * ratio - w / 2;
    const dy = EXPORT_SIZE / 2 + offset.y * ratio - h / 2;

    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    } else {
      ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    }

    ctx.drawImage(img, dx, dy, w, h);

    return canvasToFileUnderLimit(canvas, background === 'transparent', sourceFileName);
  }, [img, zoom, offset.x, offset.y, background, sourceFileName]);

  const handleApply = async () => {
    try {
      setApplying(true);
      setLoadError(null);
      const file = await exportCropped();
      await onApply(file);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao aplicar enquadramento';
      setLoadError(message);
    } finally {
      setApplying(false);
    }
  };

  const checkerStyle =
    background === 'transparent'
      ? {
          backgroundImage:
            'linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          backgroundColor: '#f4f4f5',
        }
      : { backgroundColor: background };

  return (
    <Dialog open={open} onOpenChange={(next) => !applying && onOpenChange(next)}>
      <DialogContent className="max-w-[min(92vw,28rem)] w-[min(92vw,28rem)] sm:max-w-md rounded-2xl border-border/70 bg-white dark:bg-card p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 space-y-1">
          <DialogTitle className="text-base font-semibold">Ajustar enquadramento</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Arraste para reposicionar, use o zoom e escolha o fundo antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-4">
          <div className="flex justify-center">
            <div
              className="relative touch-none select-none cursor-grab active:cursor-grabbing rounded-full border border-border shadow-sm overflow-hidden"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, ...checkerStyle }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="presentation"
            >
              {img ? (
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="absolute pointer-events-none max-w-none"
                  style={{
                    width: drawWidth,
                    height: drawHeight,
                    left: PREVIEW_SIZE / 2 + offset.x - drawWidth / 2,
                    top: PREVIEW_SIZE / 2 + offset.y - drawHeight / 2,
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  {loadError ? 'Erro' : 'Carregando…'}
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/10"
                aria-hidden
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Zoom
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {zoom.toFixed(1)}×
              </span>
            </div>
            <Slider
              value={[zoom]}
              min={0.4}
              max={3}
              step={0.05}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              disabled={!img || applying}
              className="[&_[role=slider]]:border-emerald-800 [&_.bg-primary]:bg-emerald-800"
            />
            <p className="text-[11px] text-muted-foreground">
              Reduza o zoom para afastar (útil em logos) ou aumente para aproximar.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Fundo
            </Label>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map((preset) => {
                const selected = !useCustomColor && bgPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={applying}
                    onClick={() => {
                      setUseCustomColor(false);
                      setBgPreset(preset.id);
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                        : 'border-border/70 bg-muted/30 text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-border/80 shrink-0"
                      style={
                        preset.value === 'transparent'
                          ? {
                              backgroundImage:
                                'linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                              backgroundColor: '#f4f4f5',
                            }
                          : { backgroundColor: preset.value }
                      }
                    />
                    {preset.label}
                  </button>
                );
              })}
              <label
                className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  useCustomColor
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-border/70 bg-muted/30 text-foreground hover:bg-muted/50'
                }`}
              >
                <input
                  type="color"
                  value={customColor}
                  disabled={applying}
                  onChange={(e) => {
                    setUseCustomColor(true);
                    setCustomColor(e.target.value);
                  }}
                  onClick={() => setUseCustomColor(true)}
                  className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Cor personalizada"
                />
                Outra
              </label>
            </div>
          </div>

          {loadError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          ) : null}
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border/70 bg-[#F7F5F0]/40 dark:bg-muted/20 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-9 border-border"
            disabled={applying}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!img || applying}
            onClick={() => void handleApply()}
            className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
            style={{ color: '#ffffff' }}
          >
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {applying ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
