import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCompanyFollowUp } from '@/hooks/useCompanyFollowUp';
import {
  AI_LABEL_COLOR_OPTIONS,
  labelColorSwatchClasses,
  type AiLabelColor,
} from '@/lib/conversationContactLabels';
import { FOLLOW_UP_WINDOW, formatFollowUpDelayLabel } from '@/lib/followUp';
import { cn } from '@/lib/utils';
import { SECTION_NAV } from '../helpers';
import { AI_CONFIG_SECTION_META, fieldClass, inputClass } from '../constants';

export function AiConfigFollowUpSection() {
  const meta = SECTION_NAV.find((s) => s.id === 'followup')!;
  const Icon = meta.Icon;
  const {
    isManager,
    settings,
    schedules,
    labelColors,
    loading,
    saving,
    saveSettings,
    updateSchedule,
    createSchedule,
    deleteSchedule,
    updateLabelColor,
  } = useCompanyFollowUp();

  const [addOpen, setAddOpen] = useState(false);
  const [delayUnit, setDelayUnit] = useState<'min' | 'h'>('min');
  const [delayValue, setDelayValue] = useState('30');
  const [newDescription, setNewDescription] = useState('');
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...schedules].sort((a, b) => a.delay_minutes - b.delay_minutes),
    [schedules],
  );

  const getDesc = (id: string, fallback: string) =>
    descDrafts[id] !== undefined ? descDrafts[id] : fallback;

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await saveSettings({ enabled: checked });
      toast.success(checked ? 'Follow-up automático ativado' : 'Follow-up automático desativado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleChannel = async (key: 'channel_whatsapp' | 'channel_instagram', checked: boolean) => {
    try {
      await saveSettings({ [key]: checked });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar canal');
    }
  };

  const handleSaveDesc = async (id: string) => {
    const text = descDrafts[id];
    if (text === undefined) return;
    try {
      await updateSchedule(id, { ai_description: text });
      setDescDrafts((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      toast.success('Orientação salva');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar orientação');
    }
  };

  const handleAdd = async () => {
    const n = Number(delayValue);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Informe um valor positivo');
      return;
    }
    const minutes = delayUnit === 'h' ? Math.round(n * 60) : Math.round(n);
    try {
      await createSchedule(minutes, newDescription);
      toast.success('Horário adicionado');
      setAddOpen(false);
      setDelayValue('30');
      setDelayUnit('min');
      setNewDescription('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar horário');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      toast.success('Horário removido');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
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
                {AI_CONFIG_SECTION_META.followup.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {AI_CONFIG_SECTION_META.followup.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Disparos em sequência (só após o anterior) · janela {FOLLOW_UP_WINDOW.start}–
                {FOLLOW_UP_WINDOW.end} (horário de Brasília)
              </p>
            </div>
          </div>
          {isManager && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
              <Switch
                checked={Boolean(settings?.enabled)}
                onCheckedChange={(c) => void handleToggleEnabled(c)}
                disabled={!settings || saving}
                className="data-[state=checked]:bg-emerald-700 dark:data-[state=checked]:bg-emerald-600"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 px-3 py-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Canais
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(settings?.channel_whatsapp)}
                    disabled={!isManager || saving}
                    onCheckedChange={(c) => void handleChannel('channel_whatsapp', c === true)}
                  />
                  WhatsApp
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(settings?.channel_instagram)}
                    disabled={!isManager || saving}
                    onCheckedChange={(c) => void handleChannel('channel_instagram', c === true)}
                  />
                  Instagram
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Horários</h3>
              {isManager && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white !text-white hover:bg-emerald-700"
                  style={{ color: '#ffffff' }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar horário
                </Button>
              )}
            </div>

            <ul className="space-y-3">
              {sorted.map((row) => {
                const color = (labelColors[row.label_slug] as AiLabelColor) || 'violet';
                const dirty = descDrafts[row.id] !== undefined;
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 px-3 py-3 space-y-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-sm font-semibold">
                          {formatFollowUpDelayLabel(row.delay_minutes)}
                        </span>
                        <code className="text-[11px] text-muted-foreground">{row.label_slug}</code>
                        {row.is_system && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Sistema
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isManager && (
                          <>
                            <span className="text-xs text-muted-foreground">Ativo</span>
                            <Switch
                              checked={row.enabled}
                              disabled={saving}
                              className="data-[state=checked]:bg-emerald-700 dark:data-[state=checked]:bg-emerald-600"
                              onCheckedChange={(c) =>
                                void updateSchedule(row.id, { enabled: c }).then(() =>
                                  toast.success(c ? 'Horário ativado' : 'Horário pausado'),
                                )
                              }
                            />
                            {!row.is_system && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-destructive"
                                disabled={saving}
                                onClick={() => void handleDelete(row.id)}
                                aria-label="Excluir horário"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Orientação para a IA</Label>
                      <Textarea
                        value={getDesc(row.id, row.ai_description)}
                        disabled={!isManager || saving}
                        onChange={(e) =>
                          setDescDrafts((p) => ({ ...p, [row.id]: e.target.value }))
                        }
                        rows={3}
                        className={fieldClass}
                        placeholder="Como a IA deve abordar o cliente neste horário…"
                      />
                      {isManager && dirty && (
                        <Button
                          type="button"
                          size="sm"
                          className="btn-on-emerald rounded-xl bg-emerald-800 text-white !text-white hover:bg-emerald-700"
                          style={{ color: '#ffffff' }}
                          disabled={saving}
                          onClick={() => void handleSaveDesc(row.id)}
                        >
                          Salvar orientação
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cor da etiqueta {row.label_name}</Label>
                      <div className="flex flex-wrap gap-2">
                        {AI_LABEL_COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.label}
                            disabled={!isManager || saving}
                            onClick={() =>
                              void updateLabelColor(row.label_slug, opt.value).then(() =>
                                toast.success('Cor atualizada'),
                              )
                            }
                            className={cn(
                              'h-7 w-7 rounded-full border-2 transition-shadow',
                              labelColorSwatchClasses(opt.value),
                              color === opt.value
                                ? 'border-emerald-800 ring-2 ring-offset-2 ring-offset-background ring-emerald-700/40'
                                : 'border-transparent opacity-80 hover:opacity-100',
                            )}
                            aria-label={opt.label}
                          />
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {!isManager && (
              <p className="text-sm text-muted-foreground">
                Apenas administradores e gestores podem editar o follow-up automático.
              </p>
            )}
          </>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/70">
          <DialogHeader>
            <DialogTitle>Novo horário de follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Atraso</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="number"
                  min={1}
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className={cn(inputClass, 'min-w-0 w-full')}
                />
                <div className="flex h-10 shrink-0 self-start rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    className={cn(
                      'h-full whitespace-nowrap px-3 text-sm',
                      delayUnit === 'min'
                        ? 'btn-on-emerald bg-emerald-800 text-white !text-white'
                        : 'bg-white !text-black',
                    )}
                    style={{ color: delayUnit === 'min' ? '#ffffff' : '#111111' }}
                    onClick={() => setDelayUnit('min')}
                  >
                    min
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'h-full whitespace-nowrap px-3 text-sm',
                      delayUnit === 'h'
                        ? 'btn-on-emerald bg-emerald-800 text-white !text-white'
                        : 'bg-white !text-black',
                    )}
                    style={{ color: delayUnit === 'h' ? '#ffffff' : '#111111' }}
                    onClick={() => setDelayUnit('h')}
                  >
                    h
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Orientação para a IA</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                className={fieldClass}
                placeholder="Ex.: Retome com tom leve e ofereça agendar visita…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="btn-on-emerald rounded-xl bg-emerald-800 text-white !text-white hover:bg-emerald-700"
              style={{ color: '#ffffff' }}
              disabled={saving}
              onClick={() => void handleAdd()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
