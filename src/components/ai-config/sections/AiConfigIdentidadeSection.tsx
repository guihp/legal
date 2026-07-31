import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '../LabelWithHelp';
import {
  fieldClass,
  inputClass,
  TONE_HINT,
  TONE_PLACEHOLDER,
  TOOLTIP_ASSISTANT_NAME,
  TOOLTIP_INITIAL_MESSAGE,
  TOOLTIP_TONE,
  UNKNOWN_INFO_PLACEHOLDER,
  UNKNOWN_INFO_TOOLTIP,
  type AiConfigFormState,
} from '../constants';
import {
  detectTonePreset,
  INITIAL_MESSAGE_MAX,
  MESSAGE_VARS,
  SECTION_NAV,
  type TonePresetId,
  TONE_PRESETS,
} from '../helpers';

type Props = {
  form: AiConfigFormState;
  isManager: boolean;
  onChange: (patch: Partial<AiConfigFormState>) => void;
};

const TONE_SNIPPETS: Record<TonePresetId, string> = {
  consultivo: TONE_PLACEHOLDER,
  direto:
    'Atendimento direto e objetivo. Respostas curtas, sem rodeios. Linguagem clara, sem gírias. Sempre indicar o próximo passo de forma explícita.',
  caloroso:
    'Atendimento caloroso e acolhedor. Tom amigável, empático e humano no WhatsApp. Pode usar emojis com moderação. Sempre oferecer próximo passo com leveza, sem pressão.',
};

export function AiConfigIdentidadeSection({ form, isManager, onChange }: Props) {
  const meta = SECTION_NAV.find((s) => s.id === 'identidade')!;
  const Icon = meta.Icon;
  const selectedTone = detectTonePreset(form.aiTone);
  const charCount = form.aiInitialMessage.length;

  const selectTone = (id: TonePresetId) => {
    const current = form.aiTone.trim();
    const known = Object.values(TONE_SNIPPETS);
    if (!current || known.some((s) => s === current)) {
      onChange({ aiTone: TONE_SNIPPETS[id] });
      return;
    }
    // Soft: prepend style hint without wiping custom guidelines
    const label = TONE_PRESETS.find((p) => p.id === id)?.label ?? id;
    const withoutPrefix = current.replace(/^(Consultivo|Direto|Caloroso)\s*[—:-]\s*/i, '');
    onChange({ aiTone: `${label} — ${withoutPrefix}` });
  };

  const insertVar = (token: string) => {
    if (!isManager) return;
    const next =
      form.aiInitialMessage.length + token.length > INITIAL_MESSAGE_MAX
        ? form.aiInitialMessage
        : `${form.aiInitialMessage}${token}`;
    onChange({ aiInitialMessage: next.slice(0, INITIAL_MESSAGE_MAX) });
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            meta.iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', meta.iconClass)} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{meta.label}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nome, tom e mensagens que abrem o atendimento
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <LabelWithHelp
          label="Nome da IA"
          tooltip={TOOLTIP_ASSISTANT_NAME}
          htmlFor="ai-assistant-name"
        />
        <Input
          id="ai-assistant-name"
          value={form.aiAssistantName}
          onChange={(e) => onChange({ aiAssistantName: e.target.value })}
          disabled={!isManager}
          placeholder="Ex.: Ivo — Assistente da JASTELO"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <LabelWithHelp label="Tom de voz" tooltip={TOOLTIP_TONE} />
        <div className="inline-flex rounded-xl border border-border/80 bg-[#F7F5F0]/70 dark:bg-muted/30 p-1 gap-1">
          {TONE_PRESETS.map((p) => {
            const active = selectedTone === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!isManager}
                onClick={() => selectTone(p.id)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-white dark:bg-background text-foreground font-medium shadow-sm border border-border/70'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <LabelWithHelp
            label="Mensagem inicial"
            tooltip={TOOLTIP_INITIAL_MESSAGE}
            htmlFor="ai-initial-message"
          />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {charCount}/{INITIAL_MESSAGE_MAX}
          </span>
        </div>
        <Textarea
          id="ai-initial-message"
          value={form.aiInitialMessage}
          onChange={(e) =>
            onChange({ aiInitialMessage: e.target.value.slice(0, INITIAL_MESSAGE_MAX) })
          }
          disabled={!isManager}
          rows={4}
          className={`${fieldClass} min-h-[96px]`}
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {MESSAGE_VARS.map((token) => (
            <button
              key={token}
              type="button"
              disabled={!isManager}
              onClick={() => insertVar(token)}
              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <LabelWithHelp
          label="Quando não houver resposta no cadastro"
          tooltip={UNKNOWN_INFO_TOOLTIP}
          htmlFor="ai-unknown-info"
        />
        <Textarea
          id="ai-unknown-info"
          value={form.aiUnknownInfoMessage}
          onChange={(e) => onChange({ aiUnknownInfoMessage: e.target.value })}
          disabled={!isManager}
          placeholder={UNKNOWN_INFO_PLACEHOLDER}
          rows={3}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <LabelWithHelp
          label="Diretrizes de tom"
          tooltip={TOOLTIP_TONE}
          htmlFor="ai-tone"
        />
        <Textarea
          id="ai-tone"
          value={form.aiTone}
          onChange={(e) => onChange({ aiTone: e.target.value })}
          disabled={!isManager}
          placeholder={TONE_PLACEHOLDER}
          rows={4}
          className={`${fieldClass} min-h-[96px]`}
        />
        <p className="text-xs text-muted-foreground">{TONE_HINT}</p>
      </div>

      {!isManager && (
        <p className="text-sm text-muted-foreground italic">
          Apenas administradores e gestores podem editar estas configurações.
        </p>
      )}
    </div>
  );
}
