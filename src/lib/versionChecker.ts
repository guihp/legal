/**
 * Verifica periodicamente se há uma nova versão do app disponível.
 *
 * A cada build, o Vite gera um arquivo `/build-meta.json` com um hash único.
 * Este checker busca esse arquivo a cada intervalo e compara com o hash
 * que estava presente quando o app foi carregado. Se o hash mudar,
 * significa que houve um novo deploy e o app precisa ser recarregado.
 */

// 30min — antes era 5min. O listener de visibilitychange já dispara check
// quando a aba volta do segundo plano, então polling agressivo é desnecessário.
// Reduz fetch /build-meta.json em 6×.
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const BUILD_META_PATH = '/build-meta.json';

/**
 * Abrir o seletor de arquivos no Android esconde a página e disparava um check
 * ao retornar — o reload cancelava a seleção em andamento. Só checar quando a
 * aba ficou realmente parada (caso de uso original: horas em segundo plano).
 */
const MIN_HIDDEN_MS_FOR_CHECK = 5 * 60 * 1000; // 5 minutos

let currentBuildHash: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let hiddenAt: number | null = null;
let reloadBlockers = 0;
let pendingReload = false;

function applyReload(): void {
  console.info('[VersionChecker] Nova versão detectada, recarregando...');
  window.location.reload();
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
    // Adiciona timestamp para evitar cache do navegador neste fetch
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

async function checkForUpdate(): Promise<void> {
  // Não checar se a aba está em segundo plano
  if (document.hidden) return;

  const latestHash = await fetchBuildHash();
  if (!latestHash) return;

  // Primeiro fetch: apenas armazenar o hash inicial
  if (!currentBuildHash) {
    currentBuildHash = latestHash;
    return;
  }

  // Hash mudou → novo deploy disponível
  if (latestHash !== currentBuildHash) {
    // Limpar caches do service worker se existir
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {
        // ignore
      }
    }

    // Adia o reload se o usuário está no meio de algo (ex.: anexando mídia).
    if (reloadBlockers > 0) {
      pendingReload = true;
      return;
    }

    applyReload();
  }
}

/**
 * Inicia o polling de versão. Chamar uma única vez no entry point do app.
 * Em desenvolvimento, não faz nada (o build-meta.json não existe no dev server).
 */
export function startVersionChecker(): void {
  // Só rodar em produção
  if (import.meta.env.DEV) return;
  if (intervalId) return; // já iniciado

  // Primeiro check logo ao iniciar
  void checkForUpdate();

  // Checks periódicos
  intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  // Também checar quando a aba volta ao foco (o usuário pode ter ficado
  // horas com a aba aberta e voltou agora)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }

    const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;

    // Retorno rápido = seletor de arquivo / troca de app, não vale recarregar.
    if (hiddenFor < MIN_HIDDEN_MS_FOR_CHECK) return;

    void checkForUpdate();
  });
}
