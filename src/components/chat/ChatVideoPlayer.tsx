import React from "react";
import { cn } from "@/lib/utils";
import { chatVideoBubbleWidthClass } from "@/lib/chatMediaDisplay";

export type ChatVideoPlayerProps = {
  src: string;
  timeLabel?: string;
  className?: string;
};

export function ChatVideoPlayer({ src, timeLabel, className }: ChatVideoPlayerProps) {
  return (
    <div
      className={cn(
        "relative box-border shrink-0 overflow-hidden rounded-xl bg-black",
        chatVideoBubbleWidthClass(),
        className,
      )}
    >
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="block h-auto max-h-[min(72vw,320px)] w-full object-contain"
      />
      {timeLabel ? (
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
