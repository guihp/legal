/** Tom suave de notificação (Web Audio — sem arquivo externo). */

let audioCtx: AudioContext | null = null;
const lastPlayedWhatsapp = { at: 0 };
const lastPlayedInstagram = { at: 0 };
const MIN_INTERVAL_MS = 900;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Chame após um clique na página para liberar autoplay no Chrome/Safari. */
export function unlockChatNotificationSound(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
}

function playToneGlide(opts: {
  fromHz: number;
  toHz: number;
  peakGain: number;
  durationSec: number;
  lastPlayedRef: { at: number };
}): void {
  const nowMs = Date.now();
  if (nowMs - opts.lastPlayedRef.at < MIN_INTERVAL_MS) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const run = () => {
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const dur = opts.durationSec;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(opts.fromHz, t0);
      osc.frequency.exponentialRampToValueAtTime(opts.toHz, t0 + dur * 0.28);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(opts.peakGain, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);

      opts.lastPlayedRef.at = nowMs;
    } catch {
      /* ignore */
    }
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => undefined);
  } else {
    run();
  }
}

/** WhatsApp: tom descendente suave (G5 → C5). */
export function playChatNotificationSound(): void {
  playToneGlide({
    fromHz: 784,
    toHz: 523.25,
    peakGain: 0.18,
    durationSec: 0.42,
    lastPlayedRef: lastPlayedWhatsapp,
  });
}

/** Instagram: tom ascendente mais quente (A4 → D5), volume um pouco menor. */
export function playInstagramChatNotificationSound(): void {
  playToneGlide({
    fromHz: 440,
    toHz: 587.33,
    peakGain: 0.15,
    durationSec: 0.38,
    lastPlayedRef: lastPlayedInstagram,
  });
}

/** Mensagem recebida do cliente (não IA / sistema). */
export function isIncomingChatMessage(row: Record<string, unknown>): boolean {
  const t = String(row.type ?? '').trim().toLowerCase();
  return t === 'lead' || t === 'human' || t === 'user';
}

export function isWhatsappMensagemRow(row: Record<string, unknown>): boolean {
  return String(row.plataforma ?? 'WhatsApp').trim().toLowerCase() === 'whatsapp';
}

export function isInstagramMensagemRow(row: Record<string, unknown>): boolean {
  return String(row.plataforma ?? '').trim().toLowerCase() === 'instagram';
}
