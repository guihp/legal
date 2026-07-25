import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { chatVideoBubbleWidthClass } from "@/lib/chatMediaDisplay";

export type ChatVideoPlayerProps = {
  src: string;
  timeLabel?: string;
  className?: string;
};

export function ChatVideoPlayer({ src, timeLabel, className }: ChatVideoPlayerProps) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative box-border shrink-0 overflow-hidden rounded-xl bg-black",
        chatVideoBubbleWidthClass(),
        className,
      )}
    >
      {loadError ? (
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 px-3 py-6 text-center">
          <span className="text-[13px] text-white/90">Vídeo indisponível</span>
          <span className="text-[11px] text-white/60">
            Não foi possível carregar o arquivo neste navegador.
          </span>
        </div>
      ) : (
        <video
          key={src}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="block h-auto max-h-[min(72vw,320px)] w-full object-contain"
          onError={() => setLoadError(true)}
        />
      )}
      {timeLabel && !loadError ? (
        <span
          className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/95 tabular-nums"
          aria-hidden
        >
          {timeLabel}
        </span>
      ) : null}
    </div>
  );
}
