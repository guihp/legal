import type { ReactNode } from 'react';
import { Search, Pencil, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InboxFilterId = 'all' | 'unread' | 'ai' | 'human';

const FILTERS: { id: InboxFilterId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas' },
  { id: 'ai', label: 'Atendidas por IA' },
  { id: 'human', label: 'Com corretor' },
];

type ConversasInboxFiltersProps = {
  title?: string;
  totalCount: number;
  unreadCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  activeFilter: InboxFilterId;
  onFilterChange: (id: InboxFilterId) => void;
  onNewConversation?: () => void;
  headerMenu?: ReactNode;
};

export function ConversasInboxFilters({
  title = 'Caixa de entrada',
  totalCount,
  unreadCount,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Pesquisar contato ou mensagem...',
  activeFilter,
  onFilterChange,
  onNewConversation,
  headerMenu,
}: ConversasInboxFiltersProps) {
  return (
    <div className="shrink-0 border-b border-[var(--cv-border)] bg-[var(--cv-panel)] min-w-0">
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--cv-text)] leading-tight truncate">{title}</h2>
          <p className="text-xs text-[var(--cv-text-muted)] mt-0.5 tabular-nums truncate">
            {totalCount} conversa{totalCount === 1 ? '' : 's'}
            {' · '}
            {unreadCount} não lida{unreadCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[var(--cv-icon)] shrink-0">
          {onNewConversation ? (
            <button
              type="button"
              onClick={onNewConversation}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--cv-hover)]"
              title="Nova conversa"
              aria-label="Nova conversa"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {headerMenu ?? (
            <span className="h-8 w-8 inline-flex items-center justify-center rounded-lg opacity-40">
              <MoreVertical className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="bg-[var(--cv-search-bg)] rounded-xl px-3 py-2 flex items-center gap-2 border border-[var(--cv-border)]/60">
          <Search className="w-4 h-4 text-[var(--cv-text-muted)] shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-transparent border-none outline-none text-sm text-[var(--cv-input-text)] w-full placeholder:text-[var(--cv-text-muted)]"
          />
        </div>
      </div>

      <div className="px-3 pb-3 flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                active
                  ? 'btn-on-emerald bg-[var(--cv-accent)] border-[var(--cv-accent)] text-white'
                  : 'bg-[var(--cv-shell)] border-[var(--cv-border)] text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)]',
              )}
              style={active ? { color: '#fff' } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Client-side inbox filter from conversation flags. */
export function matchesInboxFilter(
  filter: InboxFilterId,
  opts: {
    unreadCount: number;
    labelSlug?: string | null;
    leadStage?: string | null;
  },
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return (opts.unreadCount ?? 0) > 0;

  const slug = String(opts.labelSlug || '').toLowerCase();
  const stage = String(opts.leadStage || '').toLowerCase();

  if (filter === 'ai') {
    return (
      slug === 'ai_ativa' ||
      stage.includes('ai ativa') ||
      stage.includes('ia ativa') ||
      (!slug && !stage)
    );
  }

  // Com corretor
  return (
    slug === 'humano' ||
    slug === 'humano_solicitado' ||
    stage.includes('humano') ||
    stage.includes('corretor')
  );
}
