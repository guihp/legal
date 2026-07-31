import { QrCode, MessageCircle, Settings, Trash2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { formatConnectionPhone, getInstanceInitials, type InstanceChannelStats } from './helpers';

type Props = {
  instance: WhatsAppInstance;
  generatingQr: boolean;
  channelStats?: InstanceChannelStats;
  onGenerateQr: (instance: WhatsAppInstance) => void;
  onViewConversations: () => void;
  onDisconnect: (instance: WhatsAppInstance) => void;
  onConnect: (instance: WhatsAppInstance) => void;
  onConfigure: (instance: WhatsAppInstance) => void;
  onDelete: (instanceId: string) => void;
};

export function ConnectionsInstanceCard({
  instance,
  generatingQr,
  channelStats,
  onGenerateQr,
  onViewConversations,
  onDisconnect,
  onConnect,
  onConfigure,
  onDelete,
}: Props) {
  const isConnected = instance.status === 'connected';
  const displayName = instance.profile_name || instance.name;
  const initials = getInstanceInitials(displayName);
  const formattedPhone = formatConnectionPhone(instance.phone_number);
  const messages = channelStats?.messages ?? instance.message_count ?? 0;
  const contacts = channelStats?.contacts ?? instance.contact_count ?? 0;
  const chats = channelStats?.chats ?? instance.chat_count ?? 0;
  const queued = channelStats?.queued ?? 0;

  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        isConnected && 'border-l-4 border-l-emerald-600',
      )}
    >
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              {instance.profile_pic_url ? (
                <>
                  <img
                    src={instance.profile_pic_url}
                    alt={displayName}
                    className="h-11 w-11 rounded-full object-cover border border-border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {initials}
                  </div>
                </>
              ) : (
                <div className="h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground truncate" title={displayName}>
                  {displayName}
                </h3>
                {isConnected ? (
                  <Badge className="rounded-md bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-bold uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-1.5 inline-block" />
                    Online
                  </Badge>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-md text-[11px] font-medium">
                  Conta da empresa
                </Badge>
                {instance.user_profile ? (
                  <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                    {instance.user_profile.full_name}
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-muted-foreground truncate" title={`${instance.name} · ${formattedPhone}`}>
                {instance.name}
                {instance.phone_number ? ` · ${formattedPhone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onConfigure(instance)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onDelete(instance.id)}
              className="h-8 w-8 text-muted-foreground hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Mensagens', value: messages },
            { label: 'Contatos', value: contacts },
            { label: 'Chats', value: chats },
            { label: 'Na fila', value: queued },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-center"
            >
              <div className="text-lg font-semibold tabular-nums text-foreground">
                {stat.value.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('h-2 w-2 rounded-full shrink-0', isConnected ? 'bg-emerald-600' : 'bg-muted-foreground/40')} />
          <span>
            Última atividade{' '}
            {instance.last_seen
              ? new Date(instance.last_seen).toLocaleString('pt-BR')
              : 'Nunca'}
            {instance.webhook_url ? ' · webhook ativo' : ''}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onGenerateQr(instance)}
            disabled={generatingQr || isConnected}
            className="flex-1 rounded-xl border-border"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {generatingQr ? 'Gerando…' : 'Gerar QR Code'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onViewConversations}
            className="flex-1 rounded-xl border-border"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Ver conversas
          </Button>
          {isConnected ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDisconnect(instance)}
              className="flex-1 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <WifiOff className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onConnect(instance)}
              className="flex-1 rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
            >
              Conectar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
