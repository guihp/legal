import { useEffect, useMemo, useState } from 'react';
import { Phone, UserRound, Building2, CalendarDays, MessageSquareText, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChatContactAvatar } from '@/components/chat/ChatContactAvatar';
import { formatPhoneDisplayBR } from '@/lib/normalizePhone';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsXlUp } from '@/hooks/useMediaQuery';
import { resolveListingDisplay } from '@/lib/listingBasics';

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage: string | null;
  notes: string | null;
  imovel_interesse: string | null;
  interest: string | null;
  estimated_value: number | null;
  created_at: string | null;
  user_id: string | null;
  id_corretor_responsavel: string | null;
};

type PropertyBrief = {
  listing_id?: string;
  tipo_imovel: string | null;
  descricao: string | null;
  endereco: string | null;
  valor?: number | null;
  dormitorios?: number | null;
  suites?: number | null;
};

const FUNNEL_STEPS = ['Novo', 'Qualificado', 'Visita', 'Proposta'] as const;

function funnelIndexFromStage(stage: string | null | undefined): number {
  const s = String(stage || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s || s.includes('novo')) return 0;
  if (s.includes('qualific')) return 1;
  if (s.includes('visita')) return 2;
  if (
    s.includes('negoci') ||
    s.includes('proposta') ||
    s.includes('document') ||
    s.includes('contrato') ||
    s.includes('fechamento')
  ) {
    return 3;
  }
  return 0;
}

function formatMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export type ConversasLeadPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  displayName?: string | null;
  phone?: string | null;
  channelLabel?: string;
  profilePicUrl?: string | null;
  messageCount?: number;
  labelStage?: string | null;
  onViewFicha?: () => void;
  /** Optional: transfer not wired in chat — hide when absent. */
  onTransfer?: () => void;
  className?: string;
};

function LeadPanelBody({
  lead,
  loading,
  displayName,
  phone,
  channelLabel,
  profilePicUrl,
  messageCount,
  labelStage,
  property,
  brokerName,
  onViewFicha,
  onTransfer,
  onClose,
}: {
  lead: LeadRow | null;
  loading: boolean;
  displayName?: string | null;
  phone?: string | null;
  channelLabel: string;
  profilePicUrl?: string | null;
  messageCount?: number;
  labelStage?: string | null;
  property: PropertyBrief | null;
  brokerName: string | null;
  onViewFicha?: () => void;
  onTransfer?: () => void;
  onClose?: () => void;
}) {
  const name = lead?.name || displayName || 'Contato';
  const phoneDisplay = formatPhoneDisplayBR(lead?.phone || phone || '') || '—';
  const stage = lead?.stage || null;
  const funnelIdx = funnelIndexFromStage(stage);
  const subtitle = [
    stage ? `Lead ${stage.toLowerCase()}` : labelStage || 'Lead',
    channelLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  const listingRaw = lead?.imovel_interesse || property?.descricao || lead?.interest || null;
  const listingDisplay = useMemo(
    () => resolveListingDisplay(listingRaw),
    [listingRaw],
  );
  const showListingSection =
    Boolean(property) || listingDisplay.kind !== 'empty';

  return (
    <div className="h-full flex flex-col bg-[var(--cv-shell)] text-[var(--cv-text)]">
      <div className="px-4 pt-4 pb-3 border-b border-[var(--cv-border)] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--cv-text-muted)]">
            Lead
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--cv-icon)] hover:bg-[var(--cv-hover)]"
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-[var(--cv-border)]">
            <ChatContactAvatar displayName={name} profilePicUrl={profilePicUrl} iconClassName="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold leading-tight">{name}</h3>
            <p className="text-xs text-[var(--cv-text-muted)] mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {onViewFicha ? (
            <button
              type="button"
              onClick={onViewFicha}
              className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)] px-3 py-2 text-xs font-medium hover:bg-[var(--cv-hover)]"
            >
              Ver ficha
            </button>
          ) : null}
          {onTransfer ? (
            <button
              type="button"
              onClick={onTransfer}
              className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)] px-3 py-2 text-xs font-medium hover:bg-[var(--cv-hover)]"
            >
              Transferir
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Transferência de lead disponível em Clientes"
              className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)] px-3 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
            >
              Transferir
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 rounded-xl bg-[var(--cv-panel-muted)]" />
            <div className="h-28 rounded-xl bg-[var(--cv-panel-muted)]" />
          </div>
        ) : (
          <>
            <section>
              <h4 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--cv-text-muted)] mb-2">
                Etapa do funil
              </h4>
              <div className="flex items-center gap-1">
                {FUNNEL_STEPS.map((step, i) => {
                  const reached = i <= funnelIdx;
                  const current = i === funnelIdx;
                  return (
                    <div key={step} className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'h-1.5 rounded-full mb-1.5',
                          reached ? 'bg-[var(--cv-accent)]' : 'bg-[var(--cv-panel-muted)]',
                        )}
                      />
                      <p
                        className={cn(
                          'text-[10px] truncate',
                          current ? 'font-semibold text-[var(--cv-accent)]' : 'text-[var(--cv-text-muted)]',
                        )}
                      >
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--cv-text-muted)] mb-2">
                Dados do contato
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li className="flex gap-2 items-start">
                  <Phone className="h-3.5 w-3.5 mt-0.5 text-[var(--cv-text-muted)] shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--cv-text-muted)]">Telefone</p>
                    <p className="font-medium">{phoneDisplay}</p>
                  </div>
                </li>
                <li className="flex gap-2 items-start">
                  <Building2 className="h-3.5 w-3.5 mt-0.5 text-[var(--cv-text-muted)] shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--cv-text-muted)]">Origem</p>
                    <p className="font-medium">{lead?.source || '—'}</p>
                  </div>
                </li>
                <li className="flex gap-2 items-start">
                  <UserRound className="h-3.5 w-3.5 mt-0.5 text-[var(--cv-text-muted)] shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--cv-text-muted)]">Corretor</p>
                    <p className="font-medium">{brokerName || 'Não atribuído'}</p>
                  </div>
                </li>
                <li className="flex gap-2 items-start">
                  <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-[var(--cv-text-muted)] shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--cv-text-muted)]">Primeiro contato</p>
                    <p className="font-medium">
                      {lead?.created_at
                        ? new Date(lead.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-2 items-start">
                  <MessageSquareText className="h-3.5 w-3.5 mt-0.5 text-[var(--cv-text-muted)] shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--cv-text-muted)]">Interações</p>
                    <p className="font-medium">
                      {messageCount != null ? `${messageCount} mensagens` : '—'}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            {showListingSection && (
              <section>
                <h4 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--cv-text-muted)] mb-2">
                  Imóveis de interesse
                </h4>
                <div className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)] p-3 space-y-1">
                  {property?.tipo_imovel ? (
                    <p className="text-sm font-medium leading-snug">{property.tipo_imovel}</p>
                  ) : null}
                  {listingDisplay.kind === 'facts' ? (
                    <dl className="space-y-1">
                      {listingDisplay.facts.map(({ label, value }, i) => (
                        <div
                          key={`${label}-${i}`}
                          className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-2 gap-y-0.5 text-xs"
                        >
                          <dt className="text-[var(--cv-text-muted)]">{label}</dt>
                          <dd className="min-w-0 break-words font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : listingDisplay.kind === 'text' ? (
                    !property?.tipo_imovel ? (
                      <p className="text-sm font-medium leading-snug">{listingDisplay.text}</p>
                    ) : null
                  ) : !property?.tipo_imovel ? (
                    <p className="text-sm font-medium leading-snug">Imóvel</p>
                  ) : null}
                  {formatMoney(property?.valor ?? lead?.estimated_value) ? (
                    <p className="text-sm font-semibold text-[var(--cv-accent)]">
                      {formatMoney(property?.valor ?? lead?.estimated_value)}
                    </p>
                  ) : null}
                  {(property?.endereco || property?.dormitorios != null) && (
                    <p className="text-xs text-[var(--cv-text-muted)]">
                      {[
                        property?.endereco,
                        property?.dormitorios != null ? `${property.dormitorios} dorm` : null,
                        property?.suites != null ? `${property.suites} suíte${property.suites === 1 ? '' : 's'}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </section>
            )}

            {lead?.notes ? (
              <section>
                <h4 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--cv-text-muted)] mb-2">
                  Notas internas
                </h4>
                <div className="rounded-xl bg-[var(--cv-panel-muted)]/80 px-3 py-2.5 text-sm text-[var(--cv-text)] leading-relaxed whitespace-pre-wrap">
                  {lead.notes}
                </div>
              </section>
            ) : null}

            {!lead && !loading ? (
              <p className="text-xs text-[var(--cv-text-muted)] text-center py-6">
                Contato ainda não vinculado a um lead no CRM.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function ConversasLeadPanel({
  open,
  onOpenChange,
  leadId,
  displayName,
  phone,
  channelLabel = 'WhatsApp',
  profilePicUrl,
  messageCount,
  labelStage,
  onViewFicha,
  onTransfer,
  className,
}: ConversasLeadPanelProps) {
  const isXlUp = useIsXlUp();
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [property, setProperty] = useState<PropertyBrief | null>(null);
  const [brokerName, setBrokerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!leadId) {
        setLead(null);
        setProperty(null);
        setBrokerName(null);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const row = (data as LeadRow | null) || null;
        setLead(row);

        const brokerId = row?.id_corretor_responsavel || row?.user_id;
        if (brokerId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', brokerId)
            .maybeSingle();
          if (!cancelled) setBrokerName((profile as { full_name?: string } | null)?.full_name || null);
        } else {
          setBrokerName(null);
        }

        const listing = row?.imovel_interesse?.trim();
        if (listing) {
          const { data: imv } = await supabase
            .from('imoveisvivareal')
            .select('tipo_imovel, descricao, endereco')
            .ilike('listing_id', listing)
            .limit(1)
            .maybeSingle();
          if (!cancelled && imv) {
            const r = imv as Record<string, unknown>;
            setProperty({
              listing_id: listing,
              tipo_imovel: (r.tipo_imovel as string) || null,
              descricao: (r.descricao as string) || null,
              endereco: (r.endereco as string) || null,
            });
          } else if (!cancelled) {
            setProperty(null);
          }
        } else if (!cancelled) {
          setProperty(null);
        }
      } catch {
        if (!cancelled) {
          setLead(null);
          setProperty(null);
          setBrokerName(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const body = useMemo(
    () => (
      <LeadPanelBody
        lead={lead}
        loading={loading}
        displayName={displayName}
        phone={phone}
        channelLabel={channelLabel}
        profilePicUrl={profilePicUrl}
        messageCount={messageCount}
        labelStage={labelStage}
        property={property}
        brokerName={brokerName}
        onViewFicha={onViewFicha}
        onTransfer={onTransfer}
        onClose={!isXlUp ? () => onOpenChange(false) : undefined}
      />
    ),
    [
      lead,
      loading,
      displayName,
      phone,
      channelLabel,
      profilePicUrl,
      messageCount,
      labelStage,
      property,
      brokerName,
      onViewFicha,
      onTransfer,
      isXlUp,
      onOpenChange,
    ],
  );

  // Below xl: Sheet/drawer so chat stays usable (phone + tablet).
  if (!isXlUp) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="p-0 w-full max-w-[min(100vw,400px)] sm:max-w-md h-full max-h-dvh border-[var(--cv-border)] bg-[var(--cv-shell)] [&>button]:hidden"
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside
      className={cn(
        'flex w-[300px] 2xl:w-[320px] shrink-0 flex-col border-l border-[var(--cv-border)] bg-[var(--cv-shell)] min-h-0',
        className,
      )}
    >
      {body}
    </aside>
  );
}
