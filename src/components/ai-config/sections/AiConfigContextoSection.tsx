import type { ReactNode } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '../LabelWithHelp';
import {
  ADDITIONAL_INFO_PLACEHOLDER,
  fieldClass,
  RULES_PLACEHOLDER,
  TARGET_AUDIENCE_PLACEHOLDER,
  TOOLTIP_ADDITIONAL_INFO,
  TOOLTIP_MISSION,
  TOOLTIP_PAYMENT,
  TOOLTIP_RULES,
  TOOLTIP_TARGET_AUDIENCE,
  TOOLTIP_VISIT_POLICY,
  VISIT_POLICY_PLACEHOLDER,
  type AiConfigFormState,
} from '../constants';
import { filled, SECTION_NAV } from '../helpers';

type Props = {
  form: AiConfigFormState;
  isManager: boolean;
  onChange: (patch: Partial<AiConfigFormState>) => void;
};

type FieldBadge = 'preenchido' | 'crítico' | 'opcional';

function FieldShell({
  label,
  badge,
  tooltip,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  badge: FieldBadge;
  tooltip: string;
  htmlFor: string;
  hint: string;
  children: ReactNode;
}) {
  const badgeClass =
    badge === 'preenchido'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      : badge === 'crítico'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'bg-muted text-muted-foreground';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <LabelWithHelp label={label} tooltip={tooltip} htmlFor={htmlFor} />
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            badgeClass,
          )}
        >
          {badge}
        </span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AiConfigContextoSection({ form, isManager, onChange }: Props) {
  const meta = SECTION_NAV.find((s) => s.id === 'contexto')!;
  const Icon = meta.Icon;

  const badgeFor = (value: string, kind: FieldBadge = 'preenchido'): FieldBadge => {
    if (kind === 'crítico') return 'crítico';
    if (kind === 'opcional') return filled(value) ? 'preenchido' : 'opcional';
    return filled(value) ? 'preenchido' : 'opcional';
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
          <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
      </div>

      <FieldShell
        label="Missão da empresa"
        badge={badgeFor(form.aiCompanyMission)}
        tooltip={TOOLTIP_MISSION}
        htmlFor="ai-mission"
        hint="Aparece quando o cliente pergunta sobre a construtora."
      >
        <Textarea
          id="ai-mission"
          value={form.aiCompanyMission}
          onChange={(e) => onChange({ aiCompanyMission: e.target.value })}
          disabled={!isManager}
          placeholder="Ex.: Construir histórias, não apenas casas."
          rows={3}
          className={fieldClass}
        />
      </FieldShell>

      <FieldShell
        label="Métodos de pagamento"
        badge={badgeFor(form.aiPaymentMethods)}
        tooltip={TOOLTIP_PAYMENT}
        htmlFor="ai-payments"
        hint="A IA nunca fecha condição comercial — sempre direciona ao corretor."
      >
        <Textarea
          id="ai-payments"
          value={form.aiPaymentMethods}
          onChange={(e) => onChange({ aiPaymentMethods: e.target.value })}
          disabled={!isManager}
          placeholder="Ex.: PIX, boleto, cartão em até 12x, financiamento bancário..."
          rows={3}
          className={fieldClass}
        />
      </FieldShell>

      <FieldShell
        label="Política de visita"
        badge={badgeFor(form.aiVisitPolicy)}
        tooltip={TOOLTIP_VISIT_POLICY}
        htmlFor="ai-visit-policy"
        hint="Use para alinhar agendamento, dias/horários e documentos necessários."
      >
        <Textarea
          id="ai-visit-policy"
          value={form.aiVisitPolicy}
          onChange={(e) => onChange({ aiVisitPolicy: e.target.value })}
          disabled={!isManager}
          placeholder={VISIT_POLICY_PLACEHOLDER}
          rows={4}
          className={`${fieldClass} min-h-[96px]`}
        />
      </FieldShell>

      <FieldShell
        label="Público-alvo"
        badge={badgeFor(form.aiTargetAudience)}
        tooltip={TOOLTIP_TARGET_AUDIENCE}
        htmlFor="ai-target-audience"
        hint="Ajuda a IA a priorizar linguagem e exemplos."
      >
        <Textarea
          id="ai-target-audience"
          value={form.aiTargetAudience}
          onChange={(e) => onChange({ aiTargetAudience: e.target.value })}
          disabled={!isManager}
          placeholder={TARGET_AUDIENCE_PLACEHOLDER}
          rows={3}
          className={fieldClass}
        />
      </FieldShell>

      <FieldShell
        label="Regras da IA"
        badge="crítico"
        tooltip={TOOLTIP_RULES}
        htmlFor="ai-rules"
        hint="Restrições duras: a IA não pode contrariar estas regras."
      >
        <Textarea
          id="ai-rules"
          value={form.aiRules}
          onChange={(e) => onChange({ aiRules: e.target.value })}
          disabled={!isManager}
          placeholder={RULES_PLACEHOLDER}
          rows={4}
          className={`${fieldClass} min-h-[96px]`}
        />
      </FieldShell>

      <FieldShell
        label="Informações adicionais"
        badge={badgeFor(form.aiAdditionalInfo, 'opcional')}
        tooltip={TOOLTIP_ADDITIONAL_INFO}
        htmlFor="ai-additional-info"
        hint="Diferenciais, regiões de atuação, parceiros bancários, suporte pós-venda."
      >
        <Textarea
          id="ai-additional-info"
          value={form.aiAdditionalInfo}
          onChange={(e) => onChange({ aiAdditionalInfo: e.target.value })}
          disabled={!isManager}
          placeholder={ADDITIONAL_INFO_PLACEHOLDER}
          rows={4}
          className={`${fieldClass} min-h-[96px]`}
        />
      </FieldShell>

      {!isManager && (
        <p className="text-sm text-muted-foreground italic">
          Apenas administradores e gestores podem editar estas configurações.
        </p>
      )}
    </div>
  );
}
