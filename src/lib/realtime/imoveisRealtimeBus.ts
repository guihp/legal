/**
 * Bus de realtime compartilhado para `public.imoveisvivareal`.
 *
 * Antes: 3 components/hooks (useImoveisVivaReal, PropertyList, DashboardContent)
 * abriam channels independentes pra mesma tabela. Cada UPDATE no banco
 * disparava 3 callbacks em paralelo + 3 refetches.
 *
 * Agora: 1 channel único, ref-counted. N consumidores subscrevem callbacks via
 * `subscribeImoveisChanges`. Channel é criado quando o primeiro entra e
 * descartado quando o último sai. Latência menor, menos rede, menos render.
 *
 * API:
 *   const unsubscribe = subscribeImoveisChanges(payload => { ... });
 *   // depois...
 *   unsubscribe();
 *
 * Nota: payload do Supabase realtime é encaminhado tal qual chegou — caller
 * decide se filtra por evento (INSERT/UPDATE/DELETE) ou tabela.
 */

import { supabase } from '@/integrations/supabase/client';

type Payload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  schema: string;
  table: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  // ... resto do payload Realtime
};

type Listener = (payload: Payload) => void;

const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;

function ensureChannel(): void {
  if (channel) return;

  // Nome estável (sem timestamp) — vai existir só 1 channel ao mesmo tempo.
  channel = supabase
    .channel('imoveisvivareal-shared')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'imoveisvivareal' },
      (payload: any) => {
        // Encaminha pra todos os listeners. Try/catch protege um listener
        // quebrado de derrubar os outros.
        listeners.forEach((l) => {
          try {
            l(payload as Payload);
          } catch (err) {
            console.error('[imoveisRealtimeBus] Listener error:', err);
          }
        });
      },
    );

  channel.subscribe((status: string) => {
    // Útil pra debug; remove se ficar barulhento
    if (import.meta.env.DEV) {
      console.log('[imoveisRealtimeBus] channel status:', status);
    }
  });
}

function teardownIfIdle(): void {
  if (listeners.size > 0 || !channel) return;
  try {
    supabase.removeChannel(channel);
  } catch {
    // ignore
  }
  channel = null;
}

/**
 * Subscreve um listener para mudanças em `imoveisvivareal`.
 * Retorna função de cleanup — chame no useEffect return.
 */
export function subscribeImoveisChanges(cb: Listener): () => void {
  listeners.add(cb);
  ensureChannel();
  return () => {
    listeners.delete(cb);
    teardownIfIdle();
  };
}

/**
 * Para uso em testes — limpa estado interno.
 */
export function __resetImoveisRealtimeBusForTests(): void {
  listeners.clear();
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
    channel = null;
  }
}
