import { Copy, ExternalLink, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatLastPublish, publicSiteUrl } from './helpers';

type Props = {
  isPublished: boolean;
  slug: string;
  updatedAt?: string | null;
  dirty: boolean;
  saving: boolean;
  uploading: boolean;
  onCopyLink: () => void;
  onOpenSite: () => void;
  onSave: () => void;
};

export function SiteVitrineToolbar({
  isPublished,
  slug,
  updatedAt,
  dirty,
  saving,
  uploading,
  onCopyLink,
  onOpenSite,
  onSave,
}: Props) {
  const url = publicSiteUrl(slug);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Site vitrine
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isPublished ? 'bg-emerald-600' : 'bg-amber-500',
              )}
            />
            {isPublished ? 'Publicado' : 'Rascunho'}
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span className="font-mono text-[13px] truncate max-w-[min(100%,28rem)]" title={url}>
            {url}
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span className="text-[13px]">
            última publicação {formatLastPublish(updatedAt)}
            {dirty ? ' · alterações pendentes' : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopyLink}
          disabled={!slug}
          className="rounded-xl border-border bg-card shadow-sm"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenSite}
          disabled={!slug}
          className="rounded-xl border-border bg-card shadow-sm"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir site
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || uploading}
          className="btn-on-emerald rounded-xl shadow-sm bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? 'Salvando…' : 'Salvar e publicar'}
        </Button>
      </div>
    </div>
  );
}
