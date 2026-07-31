/** Follow-up cycle helpers for mensagem ingest / dispatch. */

export type FollowUpChannel = "whatsapp" | "instagram";

type SupabaseService = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function channelFromPlataforma(plataforma: string | null | undefined): FollowUpChannel {
  const p = String(plataforma || "").toLowerCase();
  return p.includes("instagram") ? "instagram" : "whatsapp";
}

export function isAiOutboundType(type: string | null | undefined): boolean {
  const t = String(type || "").trim().toLowerCase();
  return t === "ia" || t === "ai" || t === "assistant";
}

export function isClientInboundType(type: string | null | undefined): boolean {
  const t = String(type || "").trim().toLowerCase();
  return t === "lead" || t === "cliente" || t === "client" || t === "human" || t === "";
}

/** Image/audio/video/etc. must not reset the silence timer (multi-media bursts). */
export function isMediaOnlyMensageType(mensageType: string | null | undefined): boolean {
  const t = String(mensageType || "").trim().toLowerCase();
  if (!t) return false;
  if (t === "conversation" || t === "text" || t === "extendedtextmessage" || t === "extended_text") {
    return false;
  }
  return (
    t === "image" ||
    t === "imagem" ||
    t === "imageMessage" ||
    t === "audio" ||
    t === "audioMessage" ||
    t === "ptt" ||
    t === "video" ||
    t === "videoMessage" ||
    t === "document" ||
    t === "documentMessage" ||
    t === "sticker" ||
    t === "stickerMessage" ||
    t.includes("image") ||
    t.includes("audio") ||
    t.includes("video") ||
    t.includes("document") ||
    t.includes("sticker")
  );
}

export function parseFromFollowUpFlag(body: Record<string, unknown>): boolean {
  const raw =
    body.from_follow_up ??
    body.skip_follow_up_cycle ??
    body.source;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (typeof raw === "string") {
    const s = raw.toLowerCase().trim();
    return s === "auto" || s === "follow_up_auto" || s === "auto_follow_up";
  }
  return false;
}

export async function hookFollowUpOnMensagem(
  service: SupabaseService,
  input: {
    companyId: string;
    phone: string;
    plataforma?: string | null;
    instancia?: string | null;
    type?: string | null;
    mensageType?: string | null;
    fromFollowUp?: boolean;
  },
): Promise<void> {
  const sessionId = String(input.phone || "").trim();
  if (!input.companyId || !sessionId) return;

  const channel = channelFromPlataforma(input.plataforma);
  try {
    if (isAiOutboundType(input.type)) {
      // Media-only IA outbound (photo bursts) must not cancel/restart pending timers.
      if (isMediaOnlyMensageType(input.mensageType)) {
        return;
      }
      const { error } = await service.rpc("start_or_refresh_follow_up_cycle", {
        p_company_id: input.companyId,
        p_channel: channel,
        p_session_id: sessionId,
        p_instancia: input.instancia ?? null,
        p_from_follow_up: Boolean(input.fromFollowUp),
      });
      if (error) console.warn("[followUpCycle] start:", error.message);
      return;
    }
    if (isClientInboundType(input.type)) {
      const { error } = await service.rpc("handle_client_reply_follow_up", {
        p_company_id: input.companyId,
        p_channel: channel,
        p_session_id: sessionId,
      });
      if (error) console.warn("[followUpCycle] client_reply:", error.message);
    }
  } catch (e) {
    console.warn("[followUpCycle] hook failed:", e instanceof Error ? e.message : e);
  }
}
