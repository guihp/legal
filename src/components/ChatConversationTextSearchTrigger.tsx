import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function messagePlainText(row: { message?: { content?: unknown } }): string {
  const c = row?.message?.content;
  return c != null ? String(c) : '';
}

type ChatConversationTextSearchTriggerProps = {
  messages: Array<{ id: string; message?: { content?: unknown } }>;
  scrollRootRef: React.RefObject<HTMLElement | null>;
  onActiveMatchChange?: (messageId: string | null) => void;
  /** Texto atual da busca (para highlight nas bolhas, se o pai repassar). */
  onQueryChange?: (query: string) => void;
  triggerButtonClassName?: string;
  searchAttr?: string;
};

/**
 * Busca texto nas mensagens da conversa aberta: popover + anterior/próxima + scroll no container.
 */
export function ChatConversationTextSearchTrigger({
  messages,
  scrollRootRef,
  onActiveMatchChange,
  onQueryChange,
  triggerButtonClassName,
  searchAttr = 'data-chat-message-id',
}: ChatConversationTextSearchTriggerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as string[];
    const out: string[] = [];
    for (const row of messages) {
      const t = messagePlainText(row).toLowerCase();
      if (t.includes(q)) out.push(String(row.id));
    }
    return out;
  }, [messages, query]);

  const matchIdsKey = matchIds.join(',');

  useEffect(() => {
    setMatchIndex(0);
  }, [query, messages.length]);

  useEffect(() => {
    onQueryChange?.(open ? query : '');
  }, [open, query, onQueryChange]);

  useEffect(() => {
    if (!open) {
      onActiveMatchChange?.(null);
    }
  }, [open, onActiveMatchChange]);

  const scrollToId = useCallback(
    (id: string) => {
      const root = scrollRootRef.current;
      if (!root) return;
      const safe = String(id).replace(/"/g, '');
      const el = root.querySelector(`[${searchAttr}="${safe}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onActiveMatchChange?.(id);
    },
    [scrollRootRef, searchAttr, onActiveMatchChange]
  );

  const step = (dir: 1 | -1) => {
    if (!matchIds.length) return;
    const next = (matchIndex + dir + matchIds.length) % matchIds.length;
    setMatchIndex(next);
    scrollToId(matchIds[next]!);
  };

  useEffect(() => {
    if (!open || !query.trim() || !matchIds.length) {
      if (open && query.trim() && !matchIds.length) onActiveMatchChange?.(null);
      return;
    }
    setMatchIndex(0);
    const first = matchIds[0]!;
    requestAnimationFrame(() => {
      const root = scrollRootRef.current;
      if (!root) return;
      const safe = String(first).replace(/"/g, '');
      const el = root.querySelector(`[${searchAttr}="${safe}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onActiveMatchChange?.(first);
    });
  }, [open, query, matchIdsKey, matchIds, scrollRootRef, searchAttr, onActiveMatchChange]);

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) {
          onActiveMatchChange?.(null);
          onQueryChange?.('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={triggerButtonClassName ?? 'h-9 w-9 shrink-0 text-[var(--cv-icon)]'}
          title="Buscar na conversa"
        >
          <Search className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Buscar na conversa</p>
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Digite um trecho da mensagem…"
            className="h-9"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {matchIds.length === 0
              ? query.trim()
                ? 'Nenhuma ocorrência'
                : 'Digite para buscar'
              : `${matchIndex + 1} / ${matchIds.length}`}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={!matchIds.length}
              onClick={() => step(-1)}
              title="Anterior"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={!matchIds.length}
              onClick={() => step(1)}
              title="Próxima"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
