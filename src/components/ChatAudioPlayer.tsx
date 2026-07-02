import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Alturas fixas das barras (estilo waveform WhatsApp). */
const BAR_HEIGHTS = [
  5, 8, 11, 7, 13, 9, 6, 12, 8, 14, 7, 10, 13, 6, 11, 8, 7, 12, 9, 6, 10, 8, 7, 11, 9, 6, 8, 10, 7, 9, 6, 8,
];

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** incoming = áudio recebido (play verde); outgoing = áudio enviado (bolha verde, play claro). */
export type ChatAudioPlayerVariant = "incoming" | "outgoing";

type ChatAudioPlayerProps = {
  src: string;
  variant?: ChatAudioPlayerVariant;
  /** Cor das barras conforme a bolha (enviada = verde escuro, recebida = cinza). */
  bubbleTone?: "in" | "out";
  className?: string;
  onError?: () => void;
};

export function ChatAudioPlayer({
  src,
  variant: _variant = "incoming",
  bubbleTone = "in",
  className,
  onError,
}: ChatAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const onSentBubble = bubbleTone === "out";
  void _variant;

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = audioRef.current;
      const track = trackRef.current;
      if (!el || !track || !duration) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      el.currentTime = ratio * duration;
      setCurrent(el.currentTime);
    },
    [duration],
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => {
      setDuration(el.duration || 0);
      if (el.duration > 0) setLoadError(false);
    };
    const onErr = () => {
      setLoadError(true);
      onError?.();
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("error", onErr);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("error", onErr);
    };
  }, [resolvedSrc, onError]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setLoadError(false);
    setResolvedSrc(src);
  }, [src]);

  /** Storage às vezes serve áudio como octet-stream — recarrega como Blob com MIME explícito. */
  useEffect(() => {
    if (!src || !/^https?:\/\//i.test(src)) return;
    let cancelled = false;
    const lower = src.toLowerCase();
    const needsBlob =
      lower.includes("/chat-media/") &&
      (lower.includes("/audio/") || /\.(?:ogg|opus|mp3|m4a|wav|webm)(?:\?|#|$)/i.test(lower));

    if (!needsBlob) return;

    void (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("fetch_failed");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const header = new Uint8Array(buf.slice(0, 4));
        const isOgg = header[0] === 0x4f && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x73;
        const isMp3 =
          (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) ||
          (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
        const isMp4 = buf.byteLength >= 12 && String.fromCharCode(...new Uint8Array(buf.slice(4, 8))) === "ftyp";
        if (!isOgg && !isMp3 && !isMp4) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const mime = isOgg ? "audio/ogg" : isMp3 ? "audio/mpeg" : "audio/mp4";
        const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
        if (!cancelled) setResolvedSrc(blobUrl);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (resolvedSrc.startsWith("blob:") && resolvedSrc !== src) {
        URL.revokeObjectURL(resolvedSrc);
      }
    };
  }, [resolvedSrc, src]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [resolvedSrc]);

  const displayTime = useMemo(() => {
    if (playing || current > 0) return formatAudioTime(current);
    return formatAudioTime(duration);
  }, [playing, current, duration]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-[220px] max-w-[min(100%,280px)]",
        className,
      )}
    >
      {loadError ? (
        <div className="flex flex-col gap-1 px-2 py-1.5 min-w-[200px]">
          <span className="text-[13px] leading-snug text-[color:var(--cv-bubble-in-text)]/90">
            Áudio indisponível
          </span>
          <span className="text-[11px] leading-snug text-[color:var(--cv-bubble-in-meta)]">
            Arquivo inválido ou ainda criptografado. Reenvie pelo WhatsApp.
          </span>
        </div>
      ) : (
        <>
          <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className={cn(
          "flex-shrink-0 flex items-center justify-center w-[34px] h-[34px] rounded-full transition-transform active:scale-95",
          "bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-sm",
        )}
      >
        {playing ? (
          <Pause className="w-[15px] h-[15px] fill-current" />
        ) : (
          <Play className="w-[15px] h-[15px] fill-current ml-0.5" />
        )}
          </button>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pt-0.5">
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={current}
          tabIndex={0}
          className="flex items-end gap-[2px] h-[26px] cursor-pointer select-none"
          onClick={(e) => seekFromClientX(e.clientX)}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            if (e.key === "ArrowRight") el.currentTime = Math.min(duration, el.currentTime + 2);
            if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 2);
          }}
        >
          {BAR_HEIGHTS.map((h, i) => {
            const filled = (i + 1) / BAR_HEIGHTS.length <= progress;
            return (
              <span
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-150",
                  filled
                    ? "bg-[#25D366]"
                    : onSentBubble
                      ? "bg-white/40"
                      : "bg-[color:var(--cv-bubble-in-text)]/35",
                )}
                style={{ height: `${Math.round(h * 1.75)}px` }}
              />
            );
          })}
        </div>
        <span
          className={cn(
            "text-[11px] tabular-nums leading-none pl-0.5",
            onSentBubble ? "text-[color:var(--cv-bubble-out-meta)]" : "text-[color:var(--cv-bubble-in-meta)]",
          )}
        >
          {displayTime}
            </span>
          </div>

          <audio ref={audioRef} src={resolvedSrc} preload="metadata" className="hidden" />
        </>
      )}
    </div>
  );
}
