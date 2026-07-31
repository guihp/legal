import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { tooltipContentClass } from './constants';

export function LabelWithHelp({
  label,
  tooltip,
  htmlFor,
  className,
}: {
  label: string;
  tooltip: string;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Label
        className={cn(
          'mb-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
          className,
        )}
        htmlFor={htmlFor}
      >
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ajuda: ${label.replace(/:$/, '')}`}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className={tooltipContentClass}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
