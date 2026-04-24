const WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/atualizar-foto-instagram';

/** Evita rajadas ao reabrir a mesma conversa (mesmo lead). */
const DEBOUNCE_MS = 10 * 60 * 1000;
const lastRequestAt = new Map<string, number>();
const inFlight = new Set<string>();

export type InstagramProfilePicWebhookPayload = {
  lead_id: string;
  instagram_id_cliente: string;
  token_instagram: string;
};

export function requestInstagramProfilePicRefresh(payload: InstagramProfilePicWebhookPayload): void {
  const { lead_id, instagram_id_cliente, token_instagram } = payload;
  if (!lead_id || !instagram_id_cliente?.trim() || !token_instagram?.trim()) return;

  const now = Date.now();
  const prev = lastRequestAt.get(lead_id) ?? 0;
  if (now - prev < DEBOUNCE_MS) return;
  if (inFlight.has(lead_id)) return;

  lastRequestAt.set(lead_id, now);
  inFlight.add(lead_id);

  void fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_id,
      instagram_id_cliente: instagram_id_cliente.trim(),
      token_instagram: token_instagram.trim(),
    }),
    keepalive: true,
  })
    .catch(() => {
      /* silencioso: mantém URL antiga até próximo sync */
    })
    .finally(() => {
      inFlight.delete(lead_id);
    });
}
