import { CalendarPlus, UserCheck, PanelRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConversasChatHeaderActionsProps = {
  onAssume?: () => void;
  assumeDisabled?: boolean;
  assumeLoading?: boolean;
  onScheduleVisit?: () => void;
  onToggleLeadPanel?: () => void;
  showLeadPanelToggle?: boolean;
  className?: string;
};

export function ConversasChatHeaderActions({
  onAssume,
  assumeDisabled,
  assumeLoading,
  onScheduleVisit,
  onToggleLeadPanel,
  showLeadPanelToggle,
  className,
}: ConversasChatHeaderActionsProps) {
  return (
    <div className={cn('flex items-center gap-0.5 sm:gap-1 shrink-0 justify-end', className)}>
      {onAssume ? (
        <button
          type="button"
          onClick={onAssume}
          disabled={assumeDisabled || assumeLoading}
          title="Assumir atendimento"
          aria-label={assumeLoading ? 'Assumindo…' : 'Assumir atendimento'}
          className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[var(--cv-border)] bg-[var(--cv-shell)] text-[var(--cv-text)] hover:bg-[var(--cv-hover)] disabled:opacity-50"
        >
          <UserCheck className="h-4 w-4" />
        </button>
      ) : null}

      {onScheduleVisit ? (
        <button
          type="button"
          onClick={onScheduleVisit}
          title="Agendar visita"
          aria-label="Agendar visita"
          className="btn-on-emerald h-8 w-8 inline-flex items-center justify-center rounded-xl bg-[var(--cv-accent)] hover:bg-[var(--cv-accent-hover)] shadow-sm"
          style={{ color: '#fff' }}
        >
          <CalendarPlus className="h-4 w-4" />
        </button>
      ) : null}

      {showLeadPanelToggle && onToggleLeadPanel ? (
        <button
          type="button"
          onClick={onToggleLeadPanel}
          className="xl:hidden h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[var(--cv-border)] text-[var(--cv-icon)] hover:bg-[var(--cv-hover)]"
          title="Painel do lead"
          aria-label="Abrir painel do lead"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
