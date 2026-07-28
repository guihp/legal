import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  AI_CONFIG_SECTIONS,
  AI_CONFIG_SECTION_META,
  type AiConfigSectionId,
} from './constants';

type AiConfigSectionNavProps = {
  section: AiConfigSectionId;
  onSectionChange: (section: AiConfigSectionId) => void;
  aiEnabled: boolean;
  hasChanges: boolean;
  labelsCount: number | null;
};

export function AiConfigSectionNav({
  section,
  onSectionChange,
  aiEnabled,
  hasChanges,
  labelsCount,
}: AiConfigSectionNavProps) {
  return (
    <>
      {/* Mobile: horizontal tabs */}
      <div className="md:hidden -mx-1 overflow-x-auto pb-1">
        <Tabs
          value={section}
          onValueChange={(value) => onSectionChange(value as AiConfigSectionId)}
        >
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-muted/60 p-1">
            {AI_CONFIG_SECTIONS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                className="shrink-0 gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
              >
                {AI_CONFIG_SECTION_META[id].label}
                <SectionBadge
                  id={id}
                  aiEnabled={aiEnabled}
                  hasChanges={hasChanges}
                  labelsCount={labelsCount}
                  compact
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Desktop: vertical nav */}
      <nav
        className="hidden md:flex md:w-52 lg:w-56 shrink-0 flex-col gap-0.5"
        aria-label="Seções da configuração para IA"
      >
        {AI_CONFIG_SECTIONS.map((id) => {
          const active = section === id;
          const meta = AI_CONFIG_SECTION_META[id];
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSectionChange(id)}
              className={cn(
                'flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
                active
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                  {meta.description}
                </span>
              </span>
              <SectionBadge
                id={id}
                aiEnabled={aiEnabled}
                hasChanges={hasChanges}
                labelsCount={labelsCount}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
}

function SectionBadge({
  id,
  aiEnabled,
  hasChanges,
  labelsCount,
  compact,
}: {
  id: AiConfigSectionId;
  aiEnabled: boolean;
  hasChanges: boolean;
  labelsCount: number | null;
  compact?: boolean;
}) {
  if (id === 'geral') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 font-medium',
          compact ? 'px-1.5 py-0 text-[10px]' : 'text-[10px] px-1.5 py-0',
          aiEnabled
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'border-border bg-muted text-muted-foreground',
        )}
      >
        {aiEnabled ? 'Ativa' : 'Inativa'}
      </Badge>
    );
  }

  if ((id === 'identidade' || id === 'contexto') && hasChanges) {
    return (
      <span
        className={cn(
          'shrink-0 rounded-full bg-amber-500',
          compact ? 'h-1.5 w-1.5' : 'mt-1.5 h-2 w-2',
        )}
        title="Alterações não salvas"
        aria-label="Alterações não salvas"
      />
    );
  }

  if (id === 'etiquetas' && labelsCount != null) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'shrink-0 font-normal tabular-nums',
          compact ? 'px-1.5 py-0 text-[10px]' : 'text-[10px] px-1.5 py-0',
        )}
      >
        {labelsCount}
      </Badge>
    );
  }

  return null;
}
