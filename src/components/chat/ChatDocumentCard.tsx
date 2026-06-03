import React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  chatDocumentBubbleWidthClass,
  chatDocumentDisplayName,
} from "@/lib/chatMediaDisplay";

export type ChatDocumentCardProps = {
  url: string;
  fileName?: string;
  isAI: boolean;
  timeLabel?: string;
  className?: string;
};

export function ChatDocumentCard({
  url,
  fileName,
  isAI,
  timeLabel,
  className,
}: ChatDocumentCardProps) {
  const label = fileName?.trim() || chatDocumentDisplayName(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative box-border flex shrink-0 items-center gap-3 rounded-xl p-3 transition-opacity hover:opacity-90",
        chatDocumentBubbleWidthClass(),
        isAI ? "bg-black/10" : "bg-black/5",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          isAI ? "bg-[var(--cv-bubble-out-meta)]/20" : "bg-[var(--cv-bubble-in-meta)]/15",
        )}
      >
        <FileText className="h-5 w-5 shrink-0" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
          Abrir PDF
          <ExternalLink className="h-3 w-3 shrink-0" />
        </div>
      </div>
      {timeLabel ? (
        <span
          className="pointer-events-none absolute bottom-1.5 right-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/95 tabular-nums"
          aria-hidden
        >
          {timeLabel}
        </span>
      ) : null}
    </a>
  );
}
