import { Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreviewProperty } from './helpers';

type Props = {
  mode: 'desktop' | 'mobile';
  onModeChange: (m: 'desktop' | 'mobile') => void;
  title: string;
  description: string;
  tagline: string;
  themeColor: string;
  titleColor: string;
  headerBg: string;
  headerFg: string;
  headerMuted: string;
  heroUrl?: string | null;
  properties: PreviewProperty[];
};

export function SiteVitrinePreview({
  mode,
  onModeChange,
  title,
  description,
  tagline,
  themeColor,
  titleColor,
  headerBg,
  headerFg,
  headerMuted,
  heroUrl,
  properties,
}: Props) {
  const isMobile = mode === 'mobile';
  const shortTitle = title?.trim() || 'Seu site';
  const displayProps = properties.slice(0, 2);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Pré-visualização</h3>
        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => onModeChange('desktop')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              !isMobile
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => onModeChange('mobile')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              isMobile
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
      </div>

      <div
        className={cn(
          'mx-auto overflow-hidden rounded-xl border border-border shadow-sm bg-stone-950',
          isMobile ? 'max-w-[280px]' : 'w-full',
        )}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2.5 text-[11px]"
          style={{ backgroundColor: headerBg, color: headerFg }}
        >
          <span className="font-semibold truncate max-w-[45%]">{shortTitle}</span>
          <div className="hidden sm:flex items-center gap-3" style={{ color: headerMuted }}>
            <span>Imóveis</span>
            <span>Sobre</span>
            <span>Contato</span>
          </div>
        </div>

        <div
          className="relative px-4 py-8 sm:py-10 min-h-[140px] flex flex-col items-center justify-center text-center overflow-hidden"
          style={{
            backgroundImage: heroUrl
              ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.55)),url(${heroUrl})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#1c1917',
          }}
        >
          {!heroUrl ? (
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg,#292524 0,#292524 12px,#1c1917 12px,#1c1917 24px)',
              }}
            />
          ) : null}
          <div className="relative z-10 space-y-2.5 max-w-[90%]">
            <span
              className="inline-block rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: themeColor || '#f7612a' }}
            >
              {tagline || 'Imóveis selecionados'}
            </span>
            <h4
              className="text-base sm:text-lg font-bold leading-tight"
              style={{ color: titleColor || '#f7f7f7' }}
            >
              {shortTitle}
            </h4>
            {description ? (
              <p className="text-[11px] leading-relaxed text-white/75 line-clamp-3">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="bg-[#F7F5F0] p-3 space-y-2.5">
          {displayProps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/80 px-3 py-6 text-center text-[11px] text-muted-foreground">
              Imóveis disponíveis aparecerão aqui após publicar.
            </div>
          ) : (
            displayProps.map((p) => (
              <div
                key={p.id}
                className="flex gap-2.5 rounded-lg border border-border/60 bg-card overflow-hidden"
              >
                <div className="relative h-16 w-20 shrink-0 bg-muted overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(-45deg,#e7e5e4 0,#e7e5e4 8px,#f5f5f4 8px,#f5f5f4 16px)',
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 py-2 pr-2">
                  <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-snug">
                    {p.title}
                  </p>
                  <p
                    className="mt-1 text-[12px] font-semibold"
                    style={{ color: themeColor || '#f7612a' }}
                  >
                    {p.priceLabel}
                  </p>
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground text-center pt-0.5">
            Prévia aproximada — publique para ver o site real em desktop.
          </p>
        </div>
      </div>
    </div>
  );
}
