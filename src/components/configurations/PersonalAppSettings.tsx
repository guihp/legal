import { Bell, Loader2, Share, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  useNotificationPreferences,
  type NotificationCategoryKey,
} from '@/hooks/useNotificationPreferences';
import {
  shortUserAgent,
  usePushNotifications,
} from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

const CATEGORY_TOGGLES: ReadonlyArray<{
  key: NotificationCategoryKey;
  title: string;
  description: string;
}> = [
  {
    key: 'agenda',
    title: 'Agenda',
    description: 'Visitas, compromissos e lembretes de horário.',
  },
  {
    key: 'pipeline',
    title: 'Pipeline / Leads',
    description: 'Mudança de etapa no Kanban e leads qualificados.',
  },
  {
    key: 'chatHuman',
    title: 'Atendimento humano',
    description: 'Cliente respondeu com atendimento humano ou pediu um humano.',
  },
  {
    key: 'connections',
    title: 'Conexões',
    description: 'Pedidos e respostas de conexão WhatsApp.',
  },
  {
    key: 'system',
    title: 'Sistema',
    description: 'Avisos gerais e novidades da plataforma.',
  },
];

type Props = {
  /** Compact layout for /profile mirror. */
  compact?: boolean;
  className?: string;
};

/**
 * Baixar o App + preferências pessoais de push.
 * Usado em Configurações → Aplicativo e espelho em /profile.
 */
export function PersonalAppSettings({ compact = false, className }: Props) {
  const pwa = usePwaInstall();
  const prefs = useNotificationPreferences();
  const push = usePushNotifications();

  const handleInstall = async () => {
    const outcome = await pwa.promptInstall();
    if (outcome === 'accepted') {
      toast.success('Aplicativo instalado');
    } else if (outcome === 'dismissed') {
      toast.message('Instalação cancelada');
    } else {
      toast.message('Use o menu do Chrome: Instalar aplicativo');
    }
  };

  const handleSubscribe = async () => {
    if (pwa.isIosSafari && !pwa.isStandalone) {
      toast.message('No iOS, instale o app na Tela de Início antes de ativar push');
      return;
    }
    const ok = await push.subscribeThisDevice();
    if (ok) toast.success('Notificações ativadas neste dispositivo');
    else if (push.error) toast.error(push.error);
  };

  const handleMasterToggle = async (checked: boolean) => {
    const ok = await prefs.updatePreferences({ pushEnabled: checked });
    if (ok) toast.success(checked ? 'Push ativado' : 'Push desativado');
    else toast.error(prefs.error || 'Não foi possível salvar');
  };

  const handleCategoryToggle = async (key: NotificationCategoryKey, checked: boolean) => {
    const ok = await prefs.updatePreferences({ [key]: checked });
    if (!ok) toast.error(prefs.error || 'Não foi possível salvar');
  };

  const handleRemoveDevice = async (id: string) => {
    const ok = await push.removeSubscription(id);
    if (ok) toast.success('Dispositivo removido');
    else toast.error(push.error || 'Não foi possível remover');
  };

  const installStatusLabel = (() => {
    if (pwa.isInstalled || pwa.isStandalone) return 'Instalado';
    if (pwa.showIosInstructions) return 'iOS Safari — instalação manual';
    if (pwa.canPromptInstall) return 'Pronto para instalar';
    return 'Não instalado';
  })();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Baixar o App */}
      <section
        className={cn(
          'rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-4',
          compact && 'shadow-none',
        )}
      >
        <div className="flex items-start gap-3">
          <img
            src="/brand-mark.png"
            alt=""
            className="h-11 w-11 shrink-0 object-contain"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Baixar o App</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Instale o IAFÉ Imobi na tela inicial para acesso rápido e notificações
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
              pwa.isInstalled || pwa.isStandalone
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {installStatusLabel}
          </span>
        </div>

        {pwa.showIosInstructions ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              No iPhone / iPad (Safari)
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra este site no Safari</li>
              <li className="flex flex-wrap items-center gap-1.5">
                Toque em
                <span className="inline-flex items-center gap-1 rounded-md bg-background border border-border px-1.5 py-0.5 text-foreground text-xs font-medium">
                  <Share className="h-3 w-3" /> Compartilhar
                </span>
              </li>
              <li>
                Escolha <strong className="text-foreground font-medium">Adicionar à Tela de Início</strong>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
              Notificações push só funcionam depois de instalar · requer iOS 16.4 ou superior.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {pwa.isInstalled || pwa.isStandalone ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-700" />
                App já instalado neste dispositivo.
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => void handleInstall()}
                  disabled={!pwa.canPromptInstall}
                  className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white"
                >
                  Instalar aplicativo
                </Button>
                {!pwa.canPromptInstall ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Abra no Chrome ou Edge. Se o botão não aparecer, use o menu do navegador →
                    Instalar aplicativo.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </section>

      {/* Notificações */}
      <section
        className={cn(
          'rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-1',
          compact && 'shadow-none',
        )}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Notificações</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Preferências pessoais — só você recebe o que marcar
            </p>
          </div>
        </div>

        {prefs.loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              <li className="flex items-start justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Receber notificações push
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Interruptor geral. Desligado = nenhum alerta no celular ou desktop.
                  </p>
                </div>
                <Switch
                  checked={prefs.preferences?.pushEnabled ?? true}
                  disabled={prefs.saving || !prefs.preferences}
                  onCheckedChange={(checked) => void handleMasterToggle(checked)}
                  className="shrink-0 data-[state=checked]:bg-emerald-700"
                />
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-border/70">
              <Button
                type="button"
                variant="outline"
                disabled={
                  push.subscribing ||
                  push.thisDeviceSubscribed ||
                  !push.pushSupported ||
                  prefs.preferences?.pushEnabled === false
                }
                onClick={() => void handleSubscribe()}
                className="rounded-xl border-border"
              >
                {push.subscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ativando…
                  </>
                ) : push.thisDeviceSubscribed ? (
                  'Dispositivo já ativado'
                ) : (
                  'Ativar no dispositivo'
                )}
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {!push.pushSupported
                  ? 'Este navegador não suporta Web Push.'
                  : push.permission === 'denied'
                    ? 'Permissão bloqueada nas configurações do sistema/navegador.'
                    : pwa.isIosSafari && !pwa.isStandalone
                      ? 'No iOS, instale o app antes de ativar.'
                      : 'Pede permissão do sistema e registra este aparelho.'}
              </p>
            </div>

            <div className="py-4 border-b border-border/70 space-y-3">
              <p className="text-sm font-medium text-foreground">Dispositivos inscritos</p>
              {push.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : push.subscriptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum dispositivo</p>
              ) : (
                <ul className="space-y-2">
                  {push.subscriptions.map((sub) => {
                    const isCurrent = push.currentEndpoint === sub.endpoint;
                    return (
                      <li
                        key={sub.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {shortUserAgent(sub.userAgent)}
                            {isCurrent ? (
                              <span className="ml-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                                este aparelho
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {sub.platform}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => void handleRemoveDevice(sub.id)}
                          aria-label="Remover dispositivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Categorias
            </p>
            <ul className="divide-y divide-border/70">
              {CATEGORY_TOGGLES.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    checked={prefs.preferences?.[item.key] ?? true}
                    disabled={
                      prefs.saving ||
                      !prefs.preferences ||
                      prefs.preferences.pushEnabled === false
                    }
                    onCheckedChange={(checked) => void handleCategoryToggle(item.key, checked)}
                    className="shrink-0 data-[state=checked]:bg-emerald-700"
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
