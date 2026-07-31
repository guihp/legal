import { memo } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PropertyWithImages } from '@/hooks/useProperties';
import { convertGoogleDriveUrl, handleImageErrorWithFallback } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import {
  availabilityBadgeClasses,
  availabilityDotClass,
  availabilityLabel,
  formatPropertyPrice,
  translateCategoria,
  translateModalidade,
  translateTipoImovel,
} from './helpers';

type Props = {
  property: PropertyWithImages;
  imageIndex: number;
  isCorretor?: boolean;
  onPrevImage: () => void;
  onNextImage: () => void;
  onOpenGallery: () => void;
  onView: () => void;
  onEdit: () => void;
  onAvailability: () => void;
  onRequestDelete: () => void;
};

function dash(n?: number | null): string {
  if (n == null || Number(n) <= 0) return '—';
  return String(n);
}

export const PropertiesPropertyCard = memo(function PropertiesPropertyCard({
  property,
  imageIndex,
  isCorretor,
  onPrevImage,
  onNextImage,
  onOpenGallery,
  onView,
  onEdit,
  onAvailability,
  onRequestDelete,
}: Props) {
  const extra = property as PropertyWithImages & {
    disponibilidade?: string;
    listing_id?: string;
    modalidade?: string;
    tipo_imovel?: string;
    tipo_categoria?: string;
    suite?: number;
    garagem?: number;
    features?: string[];
  };

  const images = property.property_images || [];
  const photoCount = images.length;
  const hasImages = photoCount > 0;
  const safeIndex = hasImages ? Math.min(imageIndex, photoCount - 1) : 0;
  const listingId = extra.listing_id || '—';
  const titleLeft = [
    extra.tipo_imovel ? translateTipoImovel(extra.tipo_imovel) : property.title,
  ]
    .filter(Boolean)
    .join(' · ');

  const tags = [
    translateCategoria(extra.tipo_categoria),
    translateModalidade(extra.modalidade),
    ...(Array.isArray(extra.features) ? extra.features.slice(0, 2) : []),
  ].filter(Boolean) as string[];

  const address = property.address || [property.city, property.state].filter(Boolean).join(', ');

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="relative h-48 sm:h-52 bg-muted overflow-hidden">
        {hasImages ? (
          <button
            type="button"
            className="absolute inset-0 w-full h-full"
            onClick={onOpenGallery}
            aria-label="Abrir galeria"
          >
            <img
              src={convertGoogleDriveUrl(images[safeIndex].image_url, 'thumbnail')}
              alt={property.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              draggable={false}
              onError={(e) => {
                handleImageErrorWithFallback(
                  e,
                  images[safeIndex].image_url,
                  '/placeholder-property.jpg',
                );
              }}
            />
          </button>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, #EDE9E1 0 10px, #E4DFD4 10px 20px)',
            }}
          >
            <span className="text-[11px] font-semibold tracking-[0.18em] text-stone-500 uppercase">
              Foto do imóvel
            </span>
          </div>
        )}

        <div
          className={cn(
            'absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
            availabilityBadgeClasses(extra.disponibilidade),
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', availabilityDotClass(extra.disponibilidade))}
            aria-hidden
          />
          {availabilityLabel(extra.disponibilidade)}
        </div>

        {photoCount > 0 ? (
          <div
            className="absolute top-3 right-3 z-10 rounded-full bg-white/95 text-neutral-900 text-[11px] px-2.5 py-1 backdrop-blur-sm"
            style={{ color: '#111827' }}
          >
            {photoCount} foto{photoCount !== 1 ? 's' : ''}
          </div>
        ) : null}

        <div
          className="btn-on-emerald absolute bottom-3 left-3 z-10 rounded-md bg-emerald-950/90 text-white text-[11px] font-semibold px-2.5 py-1 tracking-wide"
          style={{ color: '#ffffff' }}
        >
          {listingId}
        </div>

        {photoCount > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrevImage();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/95 text-neutral-900 shadow-md ring-1 ring-black/10 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-80 transition-opacity inline-flex items-center justify-center"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-900" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextImage();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/95 text-neutral-900 shadow-md ring-1 ring-black/10 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-80 transition-opacity inline-flex items-center justify-center"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-4 w-4 text-neutral-900" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 gap-3">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{titleLeft}</h3>
            {address ? (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{address}</p>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
            {formatPropertyPrice(property.price || 0, extra.modalidade)}
          </p>
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-muted/30 overflow-hidden">
          {[
            { label: 'Área', value: property.area ? `${property.area} m²` : '—' },
            { label: 'Dorm.', value: dash(property.bedrooms) },
            { label: 'Suítes', value: dash(extra.suite) },
            { label: 'Vagas', value: dash(extra.garagem) },
          ].map((cell) => (
            <div key={cell.label} className="px-2 py-2 text-center min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{cell.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground truncate">
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={onView}
            className="btn-on-emerald flex-1 rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            style={{ color: '#ffffff' }}
          >
            Ver ficha
          </Button>
          {!isCorretor ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="rounded-xl h-9 border-border bg-background"
            >
              Editar
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-9 w-9 p-0 border-border bg-background"
                aria-label="Mais ações"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onAvailability}>Disponibilidade</DropdownMenuItem>
              {!isCorretor ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onRequestDelete}
                >
                  Excluir
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
});
