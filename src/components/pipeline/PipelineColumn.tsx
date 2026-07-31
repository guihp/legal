import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { KanbanLead, LeadStage } from '@/types/kanban';
import { PipelineLeadCard } from './PipelineLeadCard';
import {
  formatCompactBRL,
  sumLeadValues,
  type StageAccent,
} from './helpers';
import { cn } from '@/lib/utils';

/** Initial cards mounted per column; more via "Ver mais". */
export const PIPELINE_COLUMN_PAGE_SIZE = 25;

type Props = {
  stage: StageAccent;
  leads: KanbanLead[];
  availableBrokers?: { id: string; full_name: string }[];
  onAddLead?: (stage: LeadStage) => void;
};

function PipelineColumnInner({
  stage,
  leads,
  availableBrokers = [],
  onAddLead,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${stage.id}`,
    data: { type: 'column', stage: stage.title },
  });

  const [visibleCount, setVisibleCount] = useState(PIPELINE_COLUMN_PAGE_SIZE);

  // Reset window when stage or list membership meaningfully changes (not every parent re-render).
  const leadsSig = `${leads.length}:${leads[0]?.id ?? ''}:${leads[leads.length - 1]?.id ?? ''}`;
  useEffect(() => {
    setVisibleCount(PIPELINE_COLUMN_PAGE_SIZE);
  }, [stage.id, leadsSig]);

  const visibleLeads = useMemo(
    () => leads.slice(0, visibleCount),
    [leads, visibleCount],
  );

  const itemIds = useMemo(
    () => visibleLeads.map((l) => l.id.toString()),
    [visibleLeads],
  );

  const remaining = leads.length - visibleLeads.length;

  const columnValue = useMemo(() => sumLeadValues(leads), [leads]);
  const valueLabel = formatCompactBRL(columnValue);

  const showMore = useCallback(() => {
    setVisibleCount((c) => c + PIPELINE_COLUMN_PAGE_SIZE);
  }, []);

  const handleAdd = useCallback(() => {
    onAddLead?.(stage.title);
  }, [onAddLead, stage.title]);

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 h-full min-h-0 max-h-full"
      style={{ contain: 'layout style' }}
    >
      <div
        className={cn(
          'flex flex-col h-full min-h-0 rounded-2xl bg-muted/70 dark:bg-muted/40 overflow-hidden',
          isOver && 'ring-2 ring-emerald-500/40 bg-emerald-500/5',
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-3.5 pt-3.5 pb-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', stage.dot)} aria-hidden />
              <h3 className="text-sm font-bold text-foreground truncate">{stage.title}</h3>
            </div>
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-full bg-background border border-border/60 text-xs font-semibold tabular-nums text-foreground shadow-sm">
              {leads.length}
            </span>
          </div>

          <div className="mt-1.5 flex items-baseline justify-between gap-2 min-h-[1.125rem]">
            {valueLabel ? (
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {valueLabel}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Sem valores</p>
            )}
          </div>

          <div className={cn('mt-2.5 h-[3px] w-full rounded-full', stage.bar)} />
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/25 hover:scrollbar-thumb-muted-foreground/40 px-2.5 pt-3 pb-1">
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {visibleLeads.map((lead) => (
                <PipelineLeadCard key={lead.id} lead={lead} availableBrokers={availableBrokers} />
              ))}

              {remaining > 0 ? (
                <button
                  type="button"
                  onClick={showMore}
                  className="w-full rounded-xl border border-dashed border-border bg-background/70 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                >
                  Ver mais ({remaining})
                </button>
              ) : null}

              {leads.length === 0 ? (
                <div
                  className={cn(
                    'text-center py-8 text-muted-foreground border-2 border-dashed border-border/70 rounded-xl bg-background/40',
                    isOver && 'border-emerald-400/50 bg-emerald-500/5',
                  )}
                >
                  <p className="text-xs">Arraste leads aqui</p>
                </div>
              ) : null}
            </div>
          </SortableContext>
        </div>

        {/* Footer */}
        {onAddLead ? (
          <div className="flex-shrink-0 px-2.5 pb-2.5 pt-1.5">
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-border/50 bg-background py-2.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:bg-card transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar lead
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const PipelineColumn = memo(PipelineColumnInner);
