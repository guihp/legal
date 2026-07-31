import { ChevronLeft, ChevronRight, Edit, Eye, HelpCircle, MoreVertical, User } from 'lucide-react';
import type { KanbanLead } from '@/types/kanban';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { formatDatePtBrBrazil } from '@/lib/datetime-brazil';
import { shortListingLabel, shortPropertyId } from '@/lib/listingBasics';
import {
  brokerDisplayName,
  crmStageBadgeClasses,
  formatCurrencyBRL,
  formatRelativePt,
  leadInterestSnippet,
  sourceBadgeClasses,
  stageSubLabel,
} from './helpers';

/** Sliding-window range: first/last always, ≤5 numbered + ellipsis (siblingCount=1). */
type PageItem = number | 'ellipsis';

function buildPaginationRange(current: number, total: number, siblingCount = 1): PageItem[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  if (!showLeftDots && showRightDots) {
    const leftCount = 3 + 2 * siblingCount;
    return [...Array.from({ length: leftCount }, (_, i) => i + 1), 'ellipsis', total];
  }

  if (showLeftDots && !showRightDots) {
    const rightCount = 3 + 2 * siblingCount;
    return [
      1,
      'ellipsis',
      ...Array.from({ length: rightCount }, (_, i) => total - rightCount + i + 1),
    ];
  }

  return [
    1,
    'ellipsis',
    ...Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i),
    'ellipsis',
    total,
  ];
}

type Broker = { id: string; full_name: string };

type Props = {
  leads: KanbanLead[];
  filteredTotal: number;
  brokers: Broker[];
  profileId?: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAllPage: (checked: boolean) => void;
  onView: (lead: KanbanLead) => void;
  onEdit: (lead: KanbanLead) => void;
  mode: 'tabela' | 'cards';
  isMobile: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function LeadAvatar({ photoUrl }: { photoUrl?: string | null }) {
  const src = String(photoUrl || '').trim();
  return (
    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      )}
    </div>
  );
}

function RowActions({
  lead,
  onView,
  onEdit,
}: {
  lead: KanbanLead;
  onView: (lead: KanbanLead) => void;
  onEdit: (lead: KanbanLead) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 justify-start">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        title="Ver"
        onClick={() => onView(lead)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        title="Editar"
        onClick={() => onEdit(lead)}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            title="Mais"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onView(lead)}>Ver detalhes</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(lead)}>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BrokerCell({
  lead,
  brokers,
  profileId,
}: {
  lead: KanbanLead;
  brokers: Broker[];
  profileId?: string | null;
}) {
  const name = brokerDisplayName(lead, brokers, profileId);
  const unassigned = !lead.id_corretor_responsavel;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {unassigned ? (
          <span className="h-6 w-6 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 inline-flex items-center justify-center shrink-0">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="h-6 w-6 rounded-full bg-muted inline-flex items-center justify-center shrink-0">
            <User className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
        <span
          className={cn(
            'text-sm truncate',
            unassigned ? 'text-amber-800 dark:text-amber-300' : 'text-foreground',
          )}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

function ContactCell({ lead }: { lead: KanbanLead }) {
  const phone = String(lead.telefone || '').trim();
  const email = String(lead.email || '').trim();
  if (!phone && !email) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0 space-y-0.5">
      {phone ? <p className="text-sm text-foreground truncate tabular-nums">{phone}</p> : null}
      {email ? <p className="text-xs text-muted-foreground truncate">{email}</p> : null}
    </div>
  );
}

function InterestCell({ lead }: { lead: KanbanLead }) {
  // Never render ficha dumps — they blow the table width (truncate alone is not enough).
  const interest =
    shortListingLabel(lead.interesse) ||
    leadInterestSnippet(lead) ||
    shortListingLabel(lead.message);
  const propertyId = shortPropertyId(lead.imovel_interesse);
  const secondary =
    propertyId && propertyId !== interest
      ? propertyId
      : lead.imovel_tipo && lead.imovel_tipo !== interest
        ? String(lead.imovel_tipo)
        : '';

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <p className="text-sm text-foreground truncate">{interest || propertyId || '—'}</p>
      {secondary ? (
        <p className="text-xs text-muted-foreground truncate">ID {secondary}</p>
      ) : null}
    </div>
  );
}

function ValueCell({ lead }: { lead: KanbanLead }) {
  const value = formatCurrencyBRL(lead.valorEstimado || lead.valor || 0);
  return value ? (
    <p className="min-w-0 max-w-full truncate text-sm font-semibold tabular-nums text-foreground">
      {value}
    </p>
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  );
}

function SourceCell({ lead }: { lead: KanbanLead }) {
  const source = String(lead.origem || '').trim();
  if (!source || source === 'Não informado') {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full truncate text-[10px] font-medium px-1.5 py-0',
        sourceBadgeClasses(source),
      )}
    >
      {source}
    </Badge>
  );
}

function CadastroCell({ lead }: { lead: KanbanLead }) {
  const cadastro = formatDatePtBrBrazil(lead.dataContato);
  const rel = formatRelativePt(lead.updatedAt || lead.createdAt);
  if (!cadastro && !rel) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0">
      {cadastro ? (
        <p className="text-sm text-foreground tabular-nums">{cadastro}</p>
      ) : null}
      {rel ? <p className="text-xs text-muted-foreground truncate">{rel}</p> : null}
    </div>
  );
}

export function ClientsCrmTable({
  leads,
  filteredTotal,
  brokers,
  profileId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAllPage,
  onView,
  onEdit,
  mode,
  isMobile,
  page,
  totalPages,
  onPageChange,
}: Props) {
  const allPageSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const useCards = isMobile || mode === 'cards';

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      {useCards ? (
        <div className="grid min-w-0 w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={() => onToggleSelect(lead.id)}
                  aria-label={`Selecionar ${lead.nome}`}
                  className="mt-1 shrink-0"
                />
                <LeadAvatar photoUrl={lead.profile_pic_url_instagram || lead.profile_pic_url_whatsapp} />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="font-semibold text-sm text-foreground truncate">{lead.nome}</p>
                  {lead.arroba_instagram_cliente ? (
                    <p className="text-xs text-muted-foreground truncate">
                      @{String(lead.arroba_instagram_cliente).replace(/^@+/, '')}
                    </p>
                  ) : null}
                </div>
                <RowActions lead={lead} onView={onView} onEdit={onEdit} />
              </div>
              <div className="flex min-w-0 flex-wrap gap-2 overflow-hidden">
                <Badge
                  variant="outline"
                  className={cn(
                    'max-w-full truncate text-xs',
                    crmStageBadgeClasses(lead.stage),
                  )}
                >
                  {lead.stage}
                </Badge>
              </div>
              <InterestCell lead={lead} />
              <div className="grid min-w-0 w-full grid-cols-2 gap-3 text-sm">
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    Valor
                  </p>
                  <ValueCell lead={lead} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    Origem
                  </p>
                  <SourceCell lead={lead} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    Corretor
                  </p>
                  <BrokerCell lead={lead} brokers={brokers} profileId={profileId} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    Contato
                  </p>
                  <ContactCell lead={lead} />
                </div>
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Cadastro
                </p>
                <CadastroCell lead={lead} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1120px] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(c) => onToggleSelectAllPage(c === true)}
                    aria-label="Selecionar página"
                  />
                </th>
                <th className="px-3 py-3 font-semibold min-w-[96px]">Ações</th>
                <th className="px-3 py-3 font-semibold min-w-[160px]">Cliente</th>
                <th className="px-3 py-3 font-semibold min-w-[120px]">Estágio</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">Interesse</th>
                <th className="px-3 py-3 font-semibold min-w-[100px]">Valor</th>
                <th className="px-3 py-3 font-semibold min-w-[100px]">Origem</th>
                <th className="px-3 py-3 font-semibold min-w-[120px]">Corretor</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">Contato</th>
                <th className="px-3 py-3 font-semibold min-w-[100px]">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const sub = stageSubLabel(lead);
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-border/70 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-3 align-middle">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => onToggleSelect(lead.id)}
                        aria-label={`Selecionar ${lead.nome}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <RowActions lead={lead} onView={onView} onEdit={onEdit} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LeadAvatar photoUrl={lead.profile_pic_url_instagram || lead.profile_pic_url_whatsapp} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {lead.nome}
                          </p>
                          {lead.arroba_instagram_cliente ? (
                            <p className="text-xs text-muted-foreground truncate">
                              @{String(lead.arroba_instagram_cliente).replace(/^@+/, '')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', crmStageBadgeClasses(lead.stage))}
                      >
                        {lead.stage}
                      </Badge>
                      {sub ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[10rem]">
                      <InterestCell lead={lead} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <ValueCell lead={lead} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <SourceCell lead={lead} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <BrokerCell lead={lead} brokers={brokers} profileId={profileId} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <ContactCell lead={lead} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <CadastroCell lead={lead} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredTotal === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">Nenhum cliente encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros ou cadastre um novo cliente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
            Exibindo{' '}
            <span className="font-semibold text-foreground">{leads.length}</span> de{' '}
            {filteredTotal} cliente{filteredTotal !== 1 ? 's' : ''}
          </p>
          {totalPages > 1 ? (
            <Pagination className="mx-0 w-full sm:w-auto justify-start sm:justify-end">
              <PaginationContent className="flex-wrap justify-start sm:justify-end">
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Página anterior"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(Math.max(1, page - 1));
                    }}
                    className={cn(
                      'gap-1 pl-2.5',
                      page === 1 && 'pointer-events-none opacity-50',
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </PaginationLink>
                </PaginationItem>
                {buildPaginationRange(page, totalPages).map((item, idx) =>
                  item === 'ellipsis' ? (
                    <PaginationItem key={`e-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={page === item}
                        className={cn(
                          page === item &&
                            'btn-on-emerald bg-emerald-800 text-white border-emerald-800 hover:bg-emerald-700 hover:text-white',
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          onPageChange(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Próxima página"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(Math.min(totalPages, page + 1));
                    }}
                    className={cn(
                      'gap-1 pr-2.5',
                      page === totalPages && 'pointer-events-none opacity-50',
                    )}
                  >
                    <span>Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      )}
    </div>
  );
}
