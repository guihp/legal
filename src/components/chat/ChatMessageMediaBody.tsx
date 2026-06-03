import React from "react";
import { ChatDocumentCard } from "@/components/chat/ChatDocumentCard";
import { cn } from "@/lib/utils";
import type { ConversaMessage } from "@/hooks/useConversaMessages";
import { ChatImageGrid } from "@/components/ChatImageGrid";
import { ChatAudioPlayer } from "@/components/ChatAudioPlayer";
import { ChatVideoPlayer } from "@/components/chat/ChatVideoPlayer";
import { resolveDisplayCaption } from "@/lib/chatMediaCaption";
import {
  extractMediaAudio,
  extractMediaDocument,
  extractMediaVideo,
  isAudioMensageType,
  isVideoMensageType,
} from "@/lib/conversaMedia";
import { processTextWithBold } from "@/lib/formatChatMessageText";
import { chatDocumentBubbleWidthClass, chatVideoBubbleWidthClass } from "@/lib/chatMediaDisplay";

export type ChatMessageMediaBodyProps = {
  row: ConversaMessage;
  isAI: boolean;
  content: string;
  formatHour: (dateString: string) => string;
  onOpenMedia?: (images: string[], startIndex: number) => void;
  highlightQuery?: string;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function TextBody({ content, highlightQuery }: { content: string; highlightQuery?: string }) {
  const hq = highlightQuery?.trim();
  if (!content) return null;
  if (hq) {
    return (
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {content.split(new RegExp(`(${escapeRegExp(hq)})`, "gi")).map((part, i) =>
          part.toLowerCase() === hq.toLowerCase() ? (
            <mark key={i} className="rounded bg-yellow-400/35 px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </div>
    );
  }
  return (
    <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
      {processTextWithBold(content)}
    </div>
  );
}

function MediaBubbleShell({
  isAI,
  children,
  caption,
  timeLabel,
  showTimeBelow = true,
  highlightQuery,
  compact = false,
  inlineLayout = false,
  widthClass,
}: {
  isAI: boolean;
  children: React.ReactNode;
  caption?: string;
  timeLabel: string;
  showTimeBelow?: boolean;
  highlightQuery?: string;
  compact?: boolean;
  /** Bolha encolhe ao conteúdo (vídeo/PDF) sem faixa vazia. */
  inlineLayout?: boolean;
  widthClass?: string;
}) {
  const hasCaption = Boolean(caption?.trim());
  const shrinkWrap = inlineLayout || (compact && !hasCaption);
  return (
    <div
      className={cn(
        "shrink-0 max-w-full",
        shrinkWrap ? cn("w-auto", widthClass ?? chatVideoBubbleWidthClass()) : "w-fit",
        isAI ? "self-end" : "self-start",
      )}
    >
      <div
        className={cn(
          "shadow-sm rounded-2xl overflow-hidden",
          shrinkWrap ? "inline-block max-w-full" : "flex w-fit max-w-full flex-col items-start",
          isAI
            ? "rounded-tr-sm bg-[var(--cv-bubble-out)] text-[var(--cv-bubble-out-text)]"
            : "rounded-tl-sm bg-[var(--cv-bubble-in)] text-[var(--cv-bubble-in-text)]",
          shrinkWrap ? "p-0.5" : compact || !hasCaption ? "p-1" : "px-1.5 pt-1.5 pb-1",
        )}
      >
        {children}
        {hasCaption ? (
          <div className="px-1.5 pt-1.5 pb-0.5 max-w-[min(100%,300px)]">
            <TextBody content={caption!} highlightQuery={highlightQuery} />
          </div>
        ) : null}
        {showTimeBelow ? (
          <div
            className={cn(
              "text-[10px] text-right px-2 pb-1 pt-0.5",
              isAI ? "text-[color:var(--cv-bubble-out-meta)]" : "text-[color:var(--cv-bubble-in-meta)]",
            )}
          >
            {timeLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatMessageMediaBody({
  row,
  isAI,
  content,
  formatHour,
  onOpenMedia,
  highlightQuery,
}: ChatMessageMediaBodyProps) {
  const mediaImages = row.mediaImages ?? [];
  const timeLabel = formatHour(row.data);

  const preferAudio = isAudioMensageType(row.mensageType);
  const preferVideo = isVideoMensageType(row.mensageType);

  const audioUrl = extractMediaAudio(row.media);
  const videoUrl = extractMediaVideo(row.media);
  const docUrl = extractMediaDocument(row.media);

  const displayCaption = resolveDisplayCaption(content, {
    mediaUrl: videoUrl || audioUrl || docUrl || mediaImages[0] || null,
  });

  if (mediaImages.length > 0) {
    const imgCaption = resolveDisplayCaption(content, { mediaUrl: mediaImages[0] });
    return (
      <MediaBubbleShell
        isAI={isAI}
        caption={imgCaption}
        timeLabel={timeLabel}
        highlightQuery={highlightQuery}
        compact={!imgCaption}
      >
        <ChatImageGrid
          images={mediaImages}
          onImageClick={(idx) => onOpenMedia?.(mediaImages, idx)}
        />
      </MediaBubbleShell>
    );
  }

  if ((preferAudio || (!preferVideo && audioUrl)) && audioUrl) {
    const cap = resolveDisplayCaption(content, { mediaUrl: audioUrl });
    return (
      <MediaBubbleShell isAI={isAI} caption={cap} timeLabel={timeLabel} highlightQuery={highlightQuery}>
        <div className="px-2 pt-1.5">
          <ChatAudioPlayer src={audioUrl} variant={isAI ? "outgoing" : "incoming"} />
        </div>
      </MediaBubbleShell>
    );
  }

  if ((preferVideo || videoUrl) && videoUrl && !preferAudio) {
    const cap = resolveDisplayCaption(content, { mediaUrl: videoUrl });
    return (
      <MediaBubbleShell
        isAI={isAI}
        caption={cap}
        timeLabel={timeLabel}
        highlightQuery={highlightQuery}
        showTimeBelow={Boolean(cap)}
        compact
        inlineLayout
        widthClass={chatVideoBubbleWidthClass()}
      >
        <ChatVideoPlayer
          src={videoUrl}
          timeLabel={cap ? undefined : timeLabel}
          className="rounded-[10px]"
        />
      </MediaBubbleShell>
    );
  }

  if (docUrl) {
    const cap = resolveDisplayCaption(content, { mediaUrl: docUrl });
    return (
      <MediaBubbleShell
        isAI={isAI}
        caption={cap}
        timeLabel={timeLabel}
        highlightQuery={highlightQuery}
        showTimeBelow={Boolean(cap)}
        inlineLayout
        widthClass={chatDocumentBubbleWidthClass()}
      >
        <ChatDocumentCard
          url={docUrl}
          isAI={isAI}
          timeLabel={cap ? undefined : timeLabel}
        />
      </MediaBubbleShell>
    );
  }

  return null;
}
