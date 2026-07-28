import { BusinessHoursFields } from '@/components/BusinessHoursFields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { DaySchedule } from '@/lib/businessHours';
import { LabelWithHelp } from '../LabelWithHelp';
import {
  ADDITIONAL_INFO_PLACEHOLDER,
  fieldClass,
  RULES_PLACEHOLDER,
  TARGET_AUDIENCE_PLACEHOLDER,
  TOOLTIP_ADDITIONAL_INFO,
  TOOLTIP_BUSINESS_HOURS,
  TOOLTIP_PAYMENT,
  TOOLTIP_RULES,
  TOOLTIP_TARGET_AUDIENCE,
  TOOLTIP_VISIT_POLICY,
  VISIT_POLICY_PLACEHOLDER,
  type AiConfigFormState,
} from '../constants';

type AiConfigContextoSectionProps = {
  form: AiConfigFormState;
  isManager: boolean;
  onChange: (patch: Partial<AiConfigFormState>) => void;
  onChangeDay: (dayKey: string, patch: Partial<DaySchedule>) => void;
};

export function AiConfigContextoSection({
  form,
  isManager,
  onChange,
  onChangeDay,
}: AiConfigContextoSectionProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <CardTitle className="text-base text-foreground">Contexto operacional</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Políticas, público, regras e horários usados no atendimento. Salve na barra inferior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="space-y-1.5">
          <LabelWithHelp
            label="Métodos de pagamento"
            tooltip={TOOLTIP_PAYMENT}
            htmlFor="ai-payments"
          />
          <Textarea
            id="ai-payments"
            value={form.aiPaymentMethods}
            onChange={(e) => onChange({ aiPaymentMethods: e.target.value })}
            disabled={!isManager}
            placeholder="Ex.: PIX, boleto, cartão em até 12x, financiamento bancário..."
            rows={3}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp
            label="Política de visita"
            tooltip={TOOLTIP_VISIT_POLICY}
            htmlFor="ai-visit-policy"
          />
          <Textarea
            id="ai-visit-policy"
            value={form.aiVisitPolicy}
            onChange={(e) => onChange({ aiVisitPolicy: e.target.value })}
            disabled={!isManager}
            placeholder={VISIT_POLICY_PLACEHOLDER}
            rows={4}
            className={`${fieldClass} min-h-[96px]`}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp
            label="Público-alvo"
            tooltip={TOOLTIP_TARGET_AUDIENCE}
            htmlFor="ai-target-audience"
          />
          <Textarea
            id="ai-target-audience"
            value={form.aiTargetAudience}
            onChange={(e) => onChange({ aiTargetAudience: e.target.value })}
            disabled={!isManager}
            placeholder={TARGET_AUDIENCE_PLACEHOLDER}
            rows={3}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp label="Regras da IA" tooltip={TOOLTIP_RULES} htmlFor="ai-rules" />
          <Textarea
            id="ai-rules"
            value={form.aiRules}
            onChange={(e) => onChange({ aiRules: e.target.value })}
            disabled={!isManager}
            placeholder={RULES_PLACEHOLDER}
            rows={4}
            className={`${fieldClass} min-h-[96px]`}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp
            label="Informações adicionais"
            tooltip={TOOLTIP_ADDITIONAL_INFO}
            htmlFor="ai-additional-info"
          />
          <Textarea
            id="ai-additional-info"
            value={form.aiAdditionalInfo}
            onChange={(e) => onChange({ aiAdditionalInfo: e.target.value })}
            disabled={!isManager}
            placeholder={ADDITIONAL_INFO_PLACEHOLDER}
            rows={4}
            className={`${fieldClass} min-h-[96px]`}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp label="Horário de funcionamento" tooltip={TOOLTIP_BUSINESS_HOURS} />
          <BusinessHoursFields
            schedule={form.businessHoursSchedule}
            onChangeDay={onChangeDay}
            disabled={!isManager}
          />
        </div>

        {!isManager && (
          <p className="text-sm text-muted-foreground italic">
            Apenas administradores e gestores podem editar estas configurações.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
