import { Box, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DESC_MAX } from './helpers';

type Props = {
  title: string;
  slug: string;
  description: string;
  verifying: boolean;
  slugStatus: 'idle' | 'ok' | 'taken' | 'invalid';
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onVerifySlug: () => void;
};

export function SiteVitrineIdentityCard({
  title,
  slug,
  description,
  verifying,
  slugStatus,
  onTitleChange,
  onSlugChange,
  onDescriptionChange,
  onVerifySlug,
}: Props) {
  const descLen = description.length;

  return (
    <section
      id="sv-identidade"
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Box className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Identidade do site</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Título, link público e descrição</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Título do site
        </label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Ex: Minha Imobiliária"
          className="rounded-xl border-border bg-background h-11"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Link personalizado (slug)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-1 min-w-0">
            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-border bg-muted/60 text-muted-foreground text-sm shrink-0">
              /s/
            </span>
            <Input
              value={slug}
              onChange={(e) =>
                onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="minha-imobiliaria"
              className="rounded-l-none rounded-r-xl border-border bg-background h-11 flex-1"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onVerifySlug}
            disabled={verifying || !slug}
            className="rounded-xl border-border bg-card h-11 shrink-0"
          >
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verificar
          </Button>
        </div>
        {slugStatus === 'ok' && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Link disponível.</p>
        )}
        {slugStatus === 'taken' && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Este link já está em uso.</p>
        )}
        {slugStatus === 'invalid' && (
          <p className="text-xs text-destructive">Use apenas letras minúsculas, números e hífens.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Descrição breve
          </label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {descLen}/{DESC_MAX}
          </span>
        </div>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value.slice(0, DESC_MAX))}
          placeholder="Os melhores imóveis da região..."
          rows={4}
          className="rounded-xl border-border bg-background min-h-[100px] resize-y"
        />
      </div>
    </section>
  );
}
