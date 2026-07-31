import type { ReactNode, RefObject } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HeroSlot = {
  slot: 1 | 2 | 3;
  url: string;
  inputRef: RefObject<HTMLInputElement | null>;
};

type Props = {
  logoUrl: string;
  logoInputRef: RefObject<HTMLInputElement | null>;
  uploadingLogo: boolean;
  uploadingHero: 1 | 2 | 3 | null;
  heroes: HeroSlot[];
  onLogoPick: () => void;
  onLogoFile: (file?: File) => void;
  onClearLogo: () => void;
  onHeroFile: (slot: 1 | 2 | 3, file?: File) => void;
  onClearHero: (slot: 1 | 2 | 3) => void;
};

function Checkerboard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-[length:16px_16px]',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(45deg,#e7e5e4 25%,transparent 25%),linear-gradient(-45deg,#e7e5e4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e7e5e4 75%),linear-gradient(-45deg,transparent 75%,#e7e5e4 75%)',
        backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        backgroundColor: '#fafaf9',
      }}
    >
      {children}
    </div>
  );
}

function Stripes({ className }: { className?: string }) {
  return (
    <div
      className={cn('absolute inset-0 opacity-80', className)}
      style={{
        backgroundImage:
          'repeating-linear-gradient(-45deg,#e7e5e4 0,#e7e5e4 10px,#f5f5f4 10px,#f5f5f4 20px)',
      }}
    />
  );
}

export function SiteVitrineAssetsCard({
  logoUrl,
  logoInputRef,
  uploadingLogo,
  uploadingHero,
  heroes,
  onLogoPick,
  onLogoFile,
  onClearLogo,
  onHeroFile,
  onClearHero,
}: Props) {
  const heroCount = heroes.filter((h) => h.url).length;
  const logoName = logoUrl ? logoUrl.split('/').pop() || 'logo' : null;

  return (
    <section
      id="sv-assets"
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Logo e capas do hero</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              PNG/WEBP transparente · capas 16:9, 1920×900px, até 5 MB
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {heroCount}/3 capas
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <Checkerboard className="h-28 w-28 shrink-0 flex items-center justify-center">
          {uploadingLogo ? (
            <Loader2 className="h-6 w-6 text-emerald-700 animate-spin" />
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
          )}
        </Checkerboard>

        <div className="flex-1 min-w-0 space-y-2">
          {logoName ? (
            <div>
              <p className="text-sm font-medium text-foreground truncate">{logoName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Logo do site vitrine</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma logo enviada</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingLogo}
              onClick={onLogoPick}
              className="rounded-xl border-border bg-card"
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              {logoUrl ? 'Trocar' : 'Enviar'}
            </Button>
            {logoUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearLogo}
                className="rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remover
              </Button>
            ) : null}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onLogoFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {heroes.map(({ slot, url, inputRef }) => (
          <div key={slot} className="space-y-2">
            <div className="relative aspect-video rounded-xl border border-border overflow-hidden bg-muted/40">
              {uploadingHero === slot ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                  <Loader2 className="h-7 w-7 text-emerald-700 animate-spin" />
                </div>
              ) : null}
              {url ? (
                <img
                  src={url}
                  alt={`Capa ${slot}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <>
                  <Stripes />
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                    1920×900
                  </div>
                </>
              )}
              <span className="absolute bottom-2 left-2 rounded-md bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white btn-on-emerald">
                Capa {slot}
              </span>
            </div>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingHero === slot}
                onClick={() => inputRef.current?.click()}
                className="flex-1 rounded-xl border-border bg-card h-9 text-xs"
              >
                <Upload className="mr-1.5 h-3 w-3" />
                Trocar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!url || uploadingHero === slot}
                onClick={() => onClearHero(slot)}
                className="rounded-xl border-border bg-card h-9 w-9 p-0"
                title={`Remover capa ${slot}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onHeroFile(slot, e.target.files?.[0])}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
