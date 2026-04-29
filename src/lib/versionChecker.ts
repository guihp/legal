/**
 * Verifica periodicamente se há uma nova versão do app disponível.
 *
 * A cada build, o Vite gera um arquivo `/build-meta.json` com um hash único.
 * Este checker busca esse arquivo a cada intervalo e compara com o hash
 * que estava presente quando o app foi carregado. Se o hash mudar,
 * significa que houve um novo deploy e o app precisa ser recarregado.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const BUILD_META_PATH = '/build-meta.json';

let currentBuildHash: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

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
    console.info('[VersionChecker] Nova versão detectada, recarregando...');
    // Limpar caches do service worker se existir
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {
        // ignore
      }
    }
    // Recarregar forçando bypass de cache
    window.location.reload();
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
    if (!document.hidden) {
      void checkForUpdate();
    }
  });
}
