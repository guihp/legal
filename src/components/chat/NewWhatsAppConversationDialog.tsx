import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Phone, Search, User, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  formatPhoneDisplayBR,
  normalizePhoneDigits,
  normalizePhoneForWhatsAppSession,
} from '@/lib/normalizePhone';

export type NewWhatsAppConversationPick = {
  sessionId: string;
  displayName: string;
  leadPhone: string;
  leadId?: string | null;
};

type CrmContact = {
  id: string;
  name: string;
  phone: string;
  phoneNorm: string;
};

type NewWhatsAppConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  userId: string | null;
  userRole?: string;
  onStart: (pick: NewWhatsAppConversationPick) => void;
};

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  const single = parts[0] ?? '?';
  return single.slice(0, 2).toUpperCase();
}

function avatarTone(seed: string): string {
  const hues = [168, 199, 221, 262, 291, 24, 38];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  const h = hues[hash % hues.length];
  return `hsl(${h} 42% 32%)`;
}

export function NewWhatsAppConversationDialog({
  open,
  onOpenChange,
  companyId,
  userId,
  userRole,
  onStart,
}: NewWhatsAppConversationDialogProps) {
  const [tab, setTab] = useState<'contacts' | 'manual'>('contacts');
  const [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  const loadContacts = useCallback(async () => {
    if (!companyId) {
      setContacts([]);
      return;
    }
    setLoadingContacts(true);
    try {
      let q = supabase
        .from('leads')
        .select('id, name, phone, id_corretor_responsavel')
        .eq('company_id', companyId)
        .not('phone', 'is', null)
        .order('name', { ascending: true })
        .limit(500);

      if (userRole === 'corretor' && userId) {
        q = q.eq('id_corretor_responsavel', userId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const seen = new Set<string>();
      const list: CrmContact[] = [];
      for (const row of data || []) {
        const phoneNorm = normalizePhoneForWhatsAppSession(String(row.phone ?? ''));
        if (!phoneNorm || phoneNorm.length < 10 || seen.has(phoneNorm)) continue;
        seen.add(phoneNorm);
        const name = String(row.name ?? '').trim();
        list.push({
          id: String(row.id),
          name: name || formatPhoneDisplayBR(phoneNorm),
          phone: String(row.phone ?? ''),
          phoneNorm,
        });
      }
      setContacts(list);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [companyId, userId, userRole]);

  useEffect(() => {
    if (!open) return;
    setTab('contacts');
    setContactQuery('');
    setSelectedContactId(null);
    setManualPhone('');
    setManualName('');
    void loadContacts();
  }, [open, loadContacts]);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNorm.includes(normalizePhoneDigits(q)) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [contacts, contactQuery]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  const manualSessionId = useMemo(
    () => normalizePhoneForWhatsAppSession(manualPhone),
    [manualPhone],
  );

  const canStart =
    tab === 'contacts'
      ? Boolean(selectedContact?.phoneNorm)
      : manualSessionId.length >= 10;

  const previewLabel =
    tab === 'contacts'
      ? selectedContact?.name
      : manualName.trim() || (manualSessionId.length >= 10 ? formatPhoneDisplayBR(manualSessionId) : null);

  const handleStart = () => {
    if (!canStart) return;

    if (tab === 'contacts' && selectedContact) {
      onStart({
        sessionId: selectedContact.phoneNorm,
        displayName: selectedContact.name,
        leadPhone: selectedContact.phoneNorm,
        leadId: selectedContact.id,
      });
      return;
    }

    if (tab === 'manual' && manualSessionId.length >= 10) {
      const name = manualName.trim();
      onStart({
        sessionId: manualSessionId,
        displayName: name || formatPhoneDisplayBR(manualSessionId),
        leadPhone: manualSessionId,
        leadId: null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-[min(92vw,28rem)] w-full p-0 gap-0 overflow-hidden',
          'bg-[var(--cv-shell)] border-[var(--cv-border)] text-[var(--cv-text)]',
          'shadow-2xl shadow-black/40 sm:rounded-2xl',
        )}
      >
        <DialogHeader className="space-y-0 border-b border-[var(--cv-border)] bg-[var(--cv-panel)] px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cv-accent)]/15 ring-1 ring-[var(--cv-accent)]/25"
              aria-hidden
            >
              <UserPlus className="h-5 w-5 text-[var(--cv-accent)]" strokeWidth={2} />
            </div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle className="text-base font-semibold tracking-tight text-[var(--cv-text)]">
                Nova conversa
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed text-[var(--cv-text-muted)]">
                Escolha um contato do CRM ou informe um número para abrir o chat.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 pt-4 pb-1">
          <div
            role="tablist"
            aria-label="Modo de nova conversa"
            className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--cv-border)] bg-[var(--cv-search-bg)] p-1"
          >
            {(
              [
                { id: 'contacts' as const, label: 'Contatos' },
                { id: 'manual' as const, label: 'Novo número' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-lg py-2 text-sm font-medium transition-all duration-150',
                  tab === id
                    ? 'bg-[var(--cv-accent)] text-[var(--cv-tab-active-text)] shadow-sm'
                    : 'text-[var(--cv-text-muted)] hover:text-[var(--cv-text)] hover:bg-[var(--cv-hover)]/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'contacts' ? (
          <div className="flex flex-col px-4 pb-2 pt-3">
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cv-text-muted)]" />
              <input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Buscar nome ou telefone…"
                className={cn(
                  'h-10 w-full rounded-xl border border-[var(--cv-border)] bg-[var(--cv-input-bg)]',
                  'pl-9 pr-3 text-sm text-[var(--cv-input-text)] placeholder:text-[var(--cv-text-muted)]',
                  'outline-none transition-shadow focus:border-[var(--cv-accent)]/60 focus:ring-2 focus:ring-[var(--cv-accent)]/25',
                )}
              />
            </label>

            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--cv-text-muted)]">
                Contatos do CRM
              </span>
              {!loadingContacts ? (
                <span className="text-[11px] tabular-nums text-[var(--cv-text-muted)]">
                  {filteredContacts.length}
                  {contactQuery.trim() ? ` de ${contacts.length}` : ''}
                </span>
              ) : null}
            </div>

            <ScrollArea className="h-[min(52vh,320px)] rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)]/40">
              {loadingContacts ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--cv-text-muted)]">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--cv-accent)]" />
                  <span className="text-sm">Carregando contatos…</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cv-hover)]">
                    <User className="h-6 w-6 text-[var(--cv-icon)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--cv-text)]">Nenhum contato encontrado</p>
                  <p className="text-xs text-[var(--cv-text-muted)]">
                    {contactQuery.trim()
                      ? 'Tente outro termo de busca.'
                      : 'Cadastre leads com telefone no CRM.'}
                  </p>
                </div>
              ) : (
                <ul className="p-1.5">
                  {filteredContacts.map((c) => {
                    const active = selectedContactId === c.id;
                    const initials = contactInitials(c.name);
                    return (
                      <li key={c.id} className="mb-0.5 last:mb-0">
                        <button
                          type="button"
                          onClick={() => setSelectedContactId(c.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                            active
                              ? 'bg-[var(--cv-hover)] ring-1 ring-[var(--cv-accent)]/35'
                              : 'hover:bg-[var(--cv-hover)]/70',
                          )}
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-inner"
                            style={{ backgroundColor: avatarTone(c.name) }}
                            aria-hidden
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-medium leading-tight text-[var(--cv-text)]">
                              {c.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--cv-text-muted)]">
                              {formatPhoneDisplayBR(c.phoneNorm)}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                              active
                                ? 'border-[var(--cv-accent)] bg-[var(--cv-accent)]'
                                : 'border-[var(--cv-icon)]/60 bg-transparent',
                            )}
                            aria-hidden
                          >
                            {active ? (
                              <Check className="h-3 w-3 text-[var(--cv-tab-active-text)]" strokeWidth={3} />
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-2 pt-3">
            <p className="text-xs leading-relaxed text-[var(--cv-text-muted)]">
              Informe o WhatsApp do contato. O DDD será normalizado automaticamente para o Brasil.
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-chat-phone" className="text-xs font-medium text-[var(--cv-text-muted)]">
                Telefone *
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cv-text-muted)]" />
                <Input
                  id="new-chat-phone"
                  placeholder="(11) 99999-9999"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className={cn(
                    'h-11 rounded-xl border-[var(--cv-border)] bg-[var(--cv-input-bg)] pl-9',
                    'text-[var(--cv-input-text)] focus-visible:ring-[var(--cv-accent)]/30',
                  )}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              {manualPhone.trim() && manualSessionId.length < 10 ? (
                <p className="text-xs text-amber-500/90">Número inválido — use pelo menos 10 dígitos.</p>
              ) : manualSessionId.length >= 10 ? (
                <p className="text-xs text-[var(--cv-accent)]">
                  Será usado: {formatPhoneDisplayBR(manualSessionId)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-chat-name" className="text-xs font-medium text-[var(--cv-text-muted)]">
                Nome (opcional)
              </Label>
              <Input
                id="new-chat-name"
                placeholder="Ex.: Maria Silva"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className={cn(
                  'h-11 rounded-xl border-[var(--cv-border)] bg-[var(--cv-input-bg)]',
                  'text-[var(--cv-input-text)] focus-visible:ring-[var(--cv-accent)]/30',
                )}
              />
            </div>
            <div className="rounded-xl border border-dashed border-[var(--cv-border)] bg-[var(--cv-panel)]/50 px-4 py-6 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cv-hover)]">
                <User className="h-6 w-6 text-[var(--cv-icon)]" />
              </div>
              <p className="text-sm text-[var(--cv-text-muted)]">
                O chat abre vazio até você enviar a primeira mensagem.
              </p>
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-[var(--cv-border)] bg-[var(--cv-panel)] px-4 py-4">
          {previewLabel ? (
            <p className="mb-3 truncate text-center text-xs text-[var(--cv-text-muted)]">
              Conversa com{' '}
              <span className="font-medium text-[var(--cv-text)]">{previewLabel}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-11 flex-1 rounded-xl text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)] hover:text-[var(--cv-text)]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canStart}
              onClick={(e) => {
                e.preventDefault();
                handleStart();
              }}
              className={cn(
                'h-11 flex-[1.35] rounded-xl font-semibold shadow-sm transition-all',
                'bg-[var(--cv-accent)] text-[var(--cv-tab-active-text)]',
                'hover:bg-[var(--cv-accent-hover)] disabled:opacity-40 disabled:shadow-none',
              )}
            >
              Iniciar conversa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
