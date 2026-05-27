import React from 'react';
import { cn } from '@/lib/utils';

/** Largura padrão do álbum (próximo ao WhatsApp Web). */
export const CHAT_ALBUM_WIDTH_PX = 300;

type ChatImageGridProps = {
  images: string[];
  onImageClick?: (index: number) => void;
  className?: string;
};

/**
 * Grade de imagens estilo WhatsApp (1–4 visíveis, +N no último tile).
 * Largura fixa para não colapsar dentro do flex do chat.
 */
export function ChatImageGrid({ images, onImageClick, className }: ChatImageGridProps) {
  const count = images.length;
  if (count === 0) return null;

  const visible = images.slice(0, 4);
  const overflow = count - 4;

  const shellClass = cn(
    'shrink-0 w-[min(300px,calc(100vw-7rem))] max-w-full overflow-hidden rounded-lg',
    className,
  );

  const handleClick = (index: number) => {
    onImageClick?.(index);
  };

  if (count === 1) {
    return (
      <div className={shellClass}>
        <button
          type="button"
          className="block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60"
          onClick={() => handleClick(0)}
        >
          <img
            src={visible[0]}
            alt=""
            className="w-full max-h-[min(360px,50vh)] object-cover"
            loading="lazy"
          />
        </button>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className={cn(shellClass, 'grid grid-cols-2 gap-0.5')} style={{ height: 150 }}>
        {visible.map((url, idx) => (
          <Tile key={idx} url={url} onClick={() => handleClick(idx)} />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div
        className={cn(shellClass, 'grid grid-cols-2 grid-rows-2 gap-0.5')}
        style={{ height: 225 }}
      >
        <Tile
          url={visible[0]}
          className="row-span-2 h-full"
          onClick={() => handleClick(0)}
        />
        <Tile url={visible[1]} onClick={() => handleClick(1)} />
        <Tile url={visible[2]} onClick={() => handleClick(2)} />
      </div>
    );
  }

  return (
    <div
      className={cn(shellClass, 'grid grid-cols-2 grid-rows-2 gap-0.5')}
      style={{ height: 300 }}
    >
      {visible.map((url, idx) => (
        <Tile
          key={idx}
          url={url}
          onClick={() => handleClick(idx)}
          overlay={
            overflow > 0 && idx === 3 ? (
              <span className="text-white text-3xl font-light tracking-wide">+{overflow}</span>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

function Tile({
  url,
  onClick,
  className,
  overlay,
}: {
  url: string;
  onClick: () => void;
  className?: string;
  overlay?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative block w-full h-full min-h-[72px] overflow-hidden bg-black/10 cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#25D366]/60',
        className,
      )}
      onClick={onClick}
    >
      <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      {overlay ? (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">{overlay}</div>
      ) : null}
    </button>
  );
}
