import { useCallback, useEffect, useState } from 'react';

/** Chromium `beforeinstallprompt` event (not in all TS DOM libs). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PwaInstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface UsePwaInstallResult {
  /** True when Chromium fired beforeinstallprompt and app is not installed. */
  canPromptInstall: boolean;
  /** Running as installed PWA (standalone / iOS home-screen). */
  isStandalone: boolean;
  /** True after `appinstalled` or if already standalone. */
  isInstalled: boolean;
  /** iOS Safari (or iOS WebKit) — needs manual A2HS instructions. */
  isIosSafari: boolean;
  /** Show “Adicionar à Tela de Início” steps (iOS + not standalone). */
  showIosInstructions: boolean;
  platform: PwaInstallPlatform;
  /** Triggers native install sheet (Android/Chrome). No-op if unavailable. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ may report as MacIntel with touch
  const iPadOs =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOs;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari legacy
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return displayModeStandalone || iosStandalone;
}

function detectPlatform(isIos: boolean): PwaInstallPlatform {
  if (isIos) return 'ios';
  if (typeof navigator === 'undefined') return 'unknown';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(navigator.userAgent)) return 'desktop';
  return 'unknown';
}

/**
 * Captura `beforeinstallprompt` (Android/Chrome) e detecta iOS Safari
 * para instruções manuais de Adicionar à Tela de Início.
 * UI de Configurações (Fase 5) consome este hook.
 */
export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isStandalone, setIsStandalone] = useState(() => detectStandalone());
  const [isInstalled, setIsInstalled] = useState(() => detectStandalone());
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [platform, setPlatform] = useState<PwaInstallPlatform>('unknown');

  useEffect(() => {
    const ios = detectIos();
    setIsIosSafari(ios);
    setPlatform(detectPlatform(ios));

    const syncStandalone = () => {
      const standalone = detectStandalone();
      setIsStandalone(standalone);
      if (standalone) setIsInstalled(true);
    };
    syncStandalone();

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      syncStandalone();
    };

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = () => syncStandalone();

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener?.('change', onDisplayMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch {
      return 'unavailable' as const;
    }
  }, [deferredPrompt]);

  return {
    canPromptInstall: Boolean(deferredPrompt) && !isInstalled && !isStandalone,
    isStandalone,
    isInstalled: isInstalled || isStandalone,
    isIosSafari,
    showIosInstructions: isIosSafari && !isStandalone,
    platform,
    promptInstall,
  };
}
