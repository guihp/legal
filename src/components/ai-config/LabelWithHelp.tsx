import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { tooltipContentClass } from './constants';

export function LabelWithHelp({
  label,
  tooltip,
  htmlFor,
}: {
  label: string;
  tooltip: string;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Label className="text-sm text-foreground mb-0" htmlFor={htmlFor}>
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
