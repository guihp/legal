/**
 * Verifica periodicamente se há uma nova versão do app disponível.
 *
 * A cada build, o Vite gera `/build-meta.json` com um hash único.
 * Em produção com PWA (Workbox), NÃO recarregamos automaticamente nem
 * apagamos caches do SW — isso matava a sessão PWA e conflita com o
 * precache. Em vez disso: prompt “Nova versão” + `skipWaiting` via
 * `virtual:pwa-register`.
 */

import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

// 30min — visibilitychange já dispara check ao voltar do segundo plano.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const BUILD_META_PATH = '/build-meta.json';

/**
 * Abrir o seletor de arquivos no Android esconde a página e disparava um check
 * ao retornar — o reload cancelava a seleção. Só checar quando a aba ficou
 * realmente parada (horas em segundo plano).
 */
const MIN_HIDDEN_MS_FOR_CHECK = 5 * 60 * 1000;

let currentBuildHash: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let hiddenAt: number | null = null;
let reloadBlockers = 0;
let pendingReload = false;
let updatePromptOpen = false;
let applyWaitingUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

function applyReload(): void {
  console.info('[VersionChecker] Nova versão aceita, recarregando...');
  window.location.reload();
}

function requestReload(): void {
  if (reloadBlockers > 0) {
    pendingReload = true;
    return;
  }
  applyReload();
}

/**
 * Impede o reload automático enquanto há trabalho do usuário em andamento
 * (anexo em preview, upload em curso). Retorna a função de liberação.
 */
export function blockVersionReload(): () => void {
  reloadBlockers += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    reloadBlockers = Math.max(0, reloadBlockers - 1);
    if (reloadBlockers === 0 && pendingReload) {
      pendingReload = false;
      applyReload();
    }
  };
}

async function fetchBuildHash(): Promise<string | null> {
  try {
    const url = `${BUILD_META_PATH}?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.buildHash ?? null;
  } catch {
    return null;
  }
}

function showUpdatePrompt(source: 'sw' | 'build-meta'): void {
  if (updatePromptOpen) return;
  updatePromptOpen = true;

  toast('Nova versão disponível', {
    description: 'Atualize para receber as últimas melhorias.',
    duration: Infinity,
    action: {
      label: 'Atualizar',
      onClick: () => {
        updatePromptOpen = false;
        void (async () => {
          try {
            if (applyWaitingUpdate) {
              await applyWaitingUpdate(true);
              return;
            }
          } catch {
            // fall through to hard reload
          }
          requestReload();
        })();
      },
    },
    onDismiss: () => {
      updatePromptOpen = false;
    },
    onAutoClose: () => {
      updatePromptOpen = false;
    },
  });

  console.info(`[VersionChecker] Prompt de atualização (${source})`);
}

async function checkForUpdate(): Promise<void> {
  if (document.hidden) return;

  const latestHash = await fetchBuildHash();
  if (!latestHash) return;

  if (!currentBuildHash) {
    currentBuildHash = latestHash;
    return;
  }

  if (latestHash !== currentBuildHash) {
    // Não limpar caches Workbox nem forçar reload — prompt + skipWaiting.
    showUpdatePrompt('build-meta');
  }
}

function registerServiceWorkerUpdates(): void {
  try {
    applyWaitingUpdate = registerSW({
      immediate: true,
      onNeedRefresh() {
        showUpdatePrompt('sw');
      },
      onRegisteredSW(_swUrl, registration) {
        // Periodic SW update check aligned with build-meta polling
        if (!registration) return;
        setInterval(() => {
          void registration.update();
        }, CHECK_INTERVAL_MS);
      },
    });
  } catch (err) {
    console.warn('[VersionChecker] Falha ao registrar SW:', err);
  }
}

/**
 * Inicia o polling de versão + registro do service worker (PWA).
 * Em desenvolvimento, não faz nada.
 */
export function startVersionChecker(): void {
  if (import.meta.env.DEV) return;
  if (intervalId) return;

  registerServiceWorkerUpdates();

  void checkForUpdate();
  intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }

    const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;

    if (hiddenFor < MIN_HIDDEN_MS_FOR_CHECK) return;

    void checkForUpdate();
  });
}
