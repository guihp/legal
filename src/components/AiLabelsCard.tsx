import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCompanyAiLabels } from '@/hooks/useCompanyAiLabels';
import {
  AI_LABEL_COLOR_OPTIONS,
  labelColorListBadgeClasses,
  labelColorSwatchClasses,
  normalizeAiLabelSlug,
  type AiLabelColor,
  type CompanyAiLabel,
} from '@/lib/conversationContactLabels';
import { cn } from '@/lib/utils';
import { SECTION_NAV } from '@/components/ai-config/helpers';
import { AI_CONFIG_SECTION_META, inputClass } from '@/components/ai-config/constants';
import { isTimedFollowUpLabelSlug } from '@/lib/followUp';

type FormState = {
  id?: string;
  name: string;
  slug: string;
  color: AiLabelColor;
  slugLocked: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  color: 'sky',
  slugLocked: false,
};

export function AiLabelsCard() {
  const { labels, loading, saving, isManager, upsertLabel, deleteLabel } = useCompanyAiLabels();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const meta = SECTION_NAV.find((s) => s.id === 'etiquetas')!;
  const Icon = meta.Icon;

  const sorted = useMemo(
    () =>
      [...labels]
        .filter((l) => !isTimedFollowUpLabelSlug(l.slug))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [labels],
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (label: CompanyAiLabel) => {
    setForm({
      id: label.id,
      name: label.name,
      slug: label.slug,
      color: (label.color as AiLabelColor) || 'slate',
      slugLocked: label.is_system,
    });
    setOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.id || prev.slugLocked ? prev.slug : normalizeAiLabelSlug(name),
    }));
  };

  const handleSave = async () => {
    if (!isManager) return;
    try {
      await upsertLabel({
        id: form.id,
        name: form.name,
        slug: form.slug,
        color: form.color,
      });
      toast.success(form.id ? 'Etiqueta atualizada' : 'Etiqueta criada');
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar etiqueta';
      toast.error(msg);
    }
  };

  const handleDelete = async (label: CompanyAiLabel) => {
    if (!isManager || label.is_system) return;
    setDeletingId(label.id);
    try {
      await deleteLabel(label.id);
      toast.success('Etiqueta removida');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover etiqueta';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                meta.iconBg,
              )}
            >
              <Icon className={cn('h-4 w-4', meta.iconClass)} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                {AI_CONFIG_SECTION_META.etiquetas.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tags usadas nas conversas do chat para marcar o status dos contatos. As de sistema
                são obrigatórias. Sub-etiquetas de follow-up por horário ficam na seção Follow-up.
              </p>
            </div>
          </div>
          {isManager && (
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              className="btn-on-emerald w-full sm:w-auto shrink-0 rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nova etiqueta
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((label) => (
              <li
                key={label.id}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold border',
                      labelColorListBadgeClasses(label.color),
                    )}
                  >
                    {label.name}
                  </span>
                  <code className="text-[11px] text-muted-foreground truncate">{label.slug}</code>
                  {label.is_system && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Sistema
                    </span>
                  )}
                </div>
                {isManager && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-muted"
                      onClick={() => openEdit(label)}
                      aria-label={`Editar ${label.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!label.is_system && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-white dark:hover:bg-muted"
                        disabled={deletingId === label.id || saving}
                        onClick={() => void handleDelete(label)}
                        aria-label={`Excluir ${label.name}`}
                      >
                        {deletingId === label.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isManager && (
          <p className="text-sm text-muted-foreground">
            Apenas administradores e gestores podem criar ou editar etiquetas.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/70">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? form.slugLocked
                  ? 'Editar cor da etiqueta'
                  : 'Editar etiqueta'
                : 'Nova etiqueta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-label-name">Nome</Label>
              <Input
                id="ai-label-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex.: Quente, Visita agendada..."
                disabled={form.slugLocked}
                className={inputClass}
              />
              {form.slugLocked && (
                <p className="text-xs text-muted-foreground">
                  Etiqueta de sistema: o nome é fixo em todas as empresas. Só a cor pode ser alterada.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-label-slug">Slug</Label>
              <Input
                id="ai-label-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((p) => ({ ...p, slug: normalizeAiLabelSlug(e.target.value) }))
                }
                disabled={form.slugLocked}
                placeholder="ex.: visita_agendada"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Código interno da etiqueta (letras minúsculas e underscore).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {AI_LABEL_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => setForm((p) => ({ ...p, color: opt.value }))}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-shadow',
                      labelColorSwatchClasses(opt.value),
                      form.color === opt.value
                        ? 'border-emerald-800 ring-2 ring-offset-2 ring-offset-background ring-emerald-700/40'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                    aria-label={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!form.name.trim() || !form.slug.trim() || saving}
              className="btn-on-emerald w-full sm:w-auto rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
