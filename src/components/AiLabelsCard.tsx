import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  const sorted = useMemo(
    () => [...labels].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
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
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Tags className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <CardTitle className="text-foreground">Etiquetas da IA</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">
                  Tags usadas nas conversas do chat para marcar o status dos contatos. As 3 de sistema são obrigatórias.
                </CardDescription>
              </div>
            </div>
            {isManager && (
              <Button type="button" size="sm" onClick={openCreate} className="w-full sm:w-auto shrink-0">
                <Plus className="mr-1.5 h-4 w-4" />
                Nova etiqueta
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((label) => (
                <li
                  key={label.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border',
                        labelColorListBadgeClasses(label.color),
                      )}
                    >
                      {label.name}
                    </span>
                    <code className="text-[11px] text-muted-foreground truncate">{label.slug}</code>
                    {label.is_system && (
                      <Badge variant="secondary" className="text-[10px]">
                        Sistema
                      </Badge>
                    )}
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                          className="h-8 w-8 text-destructive hover:text-destructive"
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
            <p className="text-sm text-muted-foreground italic">
              Apenas administradores e gestores podem criar ou editar etiquetas.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar etiqueta' : 'Nova etiqueta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-label-name">Nome</Label>
              <Input
                id="ai-label-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex.: Quente, Visita agendada..."
              />
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
                        ? 'border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/40'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                    aria-label={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!form.name.trim() || !form.slug.trim() || saving}
              className="w-full sm:w-auto"
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
