import { Calendar, Copy, MoreVertical, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  type CalendarRow,
  type CalendarSyncStatus,
  avatarPastel,
  formatRelativeSync,
  getCalendarSyncStatus,
  getInitials,
  getStatusLabel,
  shortCalendarId,
} from './helpers';

type Props = {
  calendars: CalendarRow[];
  totalCount: number;
  loading?: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  lastUpdated: Date | null;
  escalas: Record<string, { assignedUserName?: string; assignedUserId?: string }>;
  companyUsers: Array<{ id: string; full_name: string; email: string }>;
  statusMessage?: string | null;
  isManager?: boolean;
  onCopyId: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onConfigure?: (id: string) => void;
};

function StatusBadge({ status }: { status: CalendarSyncStatus }) {
  const label = getStatusLabel(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'synced' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
        status === 'token_expiring' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        status === 'error' && 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
        status === 'unknown' && 'bg-muted text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'synced' && 'bg-emerald-600',
          status === 'token_expiring' && 'bg-amber-500',
          status === 'error' && 'bg-rose-500',
          status === 'unknown' && 'bg-muted-foreground',
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

function CalendarIcon({ color, warning }: { color?: string; warning?: boolean }) {
  const bg = warning ? '#D97706' : color || '#059669';
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${bg}22`, color: bg }}
    >
      <Calendar className="h-4 w-4" />
    </div>
  );
}

function BrokerCell({ name }: { name?: string }) {
  const display = name || 'Não vinculado';
  const initials = getInitials(name);
  const pastel = avatarPastel(name);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ backgroundColor: pastel.bg, color: pastel.fg }}
      >
        {initials}
      </div>
      <span className="text-sm text-foreground truncate">{display}</span>
    </div>
  );
}

export function CalendarsTable({
  calendars,
  totalCount,
  loading,
  searchTerm,
  onSearchChange,
  lastUpdated,
  escalas,
  companyUsers,
  statusMessage,
  isManager,
  onCopyId,
  onDelete,
  onConfigure,
}: Props) {
  const resolveOwnerName = (calId: string) => {
    const cfg = escalas[calId];
    if (cfg?.assignedUserName) return cfg.assignedUserName;
    if (cfg?.assignedUserId) {
      const u = companyUsers.find((x) => x.id === cfg.assignedUserId);
      return u?.full_name || u?.email;
    }
    return undefined;
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Calendários conectados</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {calendars.length} de {totalCount} agenda{totalCount !== 1 ? 's' : ''} · Google Calendar
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou ID..."
            className="pl-9 rounded-xl bg-background border-border h-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : calendars.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum calendário para exibir.</p>
          {statusMessage ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{statusMessage}</p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30">
                {['Calendário', 'Responsável', 'Status', 'Última sincronização', 'Ações'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendars.map((cal) => {
                const syncStatus = getCalendarSyncStatus(cal);
                const ownerName = resolveOwnerName(cal.id);
                return (
                  <tr
                    key={cal.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <CalendarIcon color={cal.color} warning={syncStatus === 'token_expiring'} />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{cal.name}</p>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[240px] font-mono"
                            title={cal.id}
                          >
                            {shortCalendarId(cal.id)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <BrokerCell name={ownerName} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={syncStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground">{formatRelativeSync(lastUpdated)}</p>
                      <p className="text-xs text-muted-foreground">sincronização recente</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onCopyId(cal.id)}
                          aria-label="Copiar ID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                          onClick={() => onDelete(cal.id, cal.name)}
                          aria-label="Remover agenda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isManager && onConfigure ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label="Mais ações"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => onConfigure(cal.id)}>
                                Configurar responsável
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label="Mais ações"
                            disabled
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border/70 px-4 py-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground bg-[#F3F0E8]/80 dark:bg-muted/30">
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
          Google Calendar autorizado
        </span>
        <span className="opacity-60">·</span>
        <span>eventos criados pela IA entram automaticamente no calendário do corretor de plantão</span>
      </div>
    </div>
  );
}
