import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit, Eye, MoreVertical, User } from 'lucide-react';
import type { KanbanLead } from '@/types/kanban';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatCurrencyBRL,
  formatRelativePt,
  leadInterestSnippet,
} from './helpers';
import { cn } from '@/lib/utils';

type Props = {
  lead: KanbanLead;
  isDragging?: boolean;
  availableBrokers?: { id: string; full_name: string }[];
};

function brokerLabel(
  lead: KanbanLead,
  availableBrokers: { id: string; full_name: string }[],
): string | null {
  if (lead.corretor?.nome) return lead.corretor.nome;
  if (!lead.id_corretor_responsavel) return null;
  return availableBrokers.find((b) => b.id === lead.id_corretor_responsavel)?.full_name ?? null;
}

function openLeadView(id: string) {
  window.dispatchEvent(new CustomEvent('openLeadView', { detail: { id } }));
}

function openLeadEdit(id: string) {
  window.dispatchEvent(new CustomEvent('openLeadEdit', { detail: { id } }));
}

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

/** Lightweight DragOverlay preview — avoids mounting a full sortable card while dragging. */
export const PipelineDragPreview = memo(function PipelineDragPreview({
  lead,
}: {
  lead: KanbanLead;
}) {
  const interest = leadInterestSnippet(lead);
  const valueLabel = formatCurrencyBRL(lead.valorEstimado || lead.valor || 0);

  return (
    <div className="w-[280px] rounded-xl border border-border/40 bg-card p-3.5 shadow-lg rotate-1 cursor-grabbing">
      <div className="flex items-start gap-2.5">
        <LeadAvatar photoUrl={lead.profile_pic_url_instagram} />
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm text-foreground truncate leading-tight">{lead.nome}</h4>
          {interest ? <p className="text-xs text-muted-foreground truncate">{interest}</p> : null}
          {valueLabel ? (
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{valueLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
});

function PipelineLeadCardInner({ lead, isDragging = false, availableBrokers = [] }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: lead.id.toString(),
    data: { type: 'lead', lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging ? 0.45 : 1,
  };

  const interest = leadInterestSnippet(lead);
  const valueLabel = formatCurrencyBRL(lead.valorEstimado || lead.valor || 0);
  const relative = formatRelativePt(lead.updatedAt || lead.createdAt);
  const brokerName = brokerLabel(lead, availableBrokers);
  const notes = lead.observacoes?.trim();
  const phone = lead.telefone?.trim();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('group touch-manipulation', isDragging && 'z-50 rotate-1')}
    >
      <article
        className="relative rounded-xl border border-border/40 bg-card p-3.5 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
        onDoubleClick={(e) => {
          e.stopPropagation();
          openLeadView(lead.id);
        }}
      >
        {/* Top: avatar + name + menu */}
        <div className="flex items-start gap-2.5">
          <LeadAvatar photoUrl={lead.profile_pic_url_instagram} />

          <div className="min-w-0 flex-1 pr-6">
            <h4 className="font-semibold text-sm text-foreground truncate leading-tight">{lead.nome}</h4>
            {interest ? (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{interest}</p>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute top-2.5 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                title="Ações"
                aria-label="Ações do lead"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openLeadView(lead.id);
                }}
              >
                <Eye className="mr-2 h-3.5 w-3.5" />
                Ver lead
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openLeadEdit(lead.id);
                }}
              >
                <Edit className="mr-2 h-3.5 w-3.5" />
                Editar lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Middle: value (temperature omitted — no real field) */}
        {valueLabel ? (
          <p className="mt-2.5 text-[15px] font-bold tabular-nums text-foreground leading-none">
            {valueLabel}
          </p>
        ) : null}

        {/* Note snippet with green accent */}
        {notes ? (
          <p className="mt-2.5 pl-2.5 border-l-2 border-emerald-500 text-[11px] leading-snug text-muted-foreground line-clamp-2">
            {notes}
          </p>
        ) : null}

        {/* Bottom: phone + relative time */}
        {(phone || relative) ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground min-w-0">
            {phone ? (
              <span className="truncate tabular-nums">{phone}</span>
            ) : (
              <span />
            )}
            {relative ? (
              <span className="inline-flex items-center gap-1.5 shrink-0 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {relative}
              </span>
            ) : null}
          </div>
        ) : null}

        {brokerName ? (
          <p className="mt-1.5 text-[10px] text-muted-foreground/80 truncate">{brokerName}</p>
        ) : null}
      </article>
    </div>
  );
}

export const PipelineLeadCard = memo(PipelineLeadCardInner);
