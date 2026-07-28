import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LabelWithHelp } from '../LabelWithHelp';
import {
  fieldClass,
  inputClass,
  TONE_PLACEHOLDER,
  TOOLTIP_ASSISTANT_NAME,
  TOOLTIP_INITIAL_MESSAGE,
  TOOLTIP_MISSION,
  TOOLTIP_TONE,
  UNKNOWN_INFO_PLACEHOLDER,
  UNKNOWN_INFO_TOOLTIP,
  type AiConfigFormState,
} from '../constants';

type AiConfigIdentidadeSectionProps = {
  form: AiConfigFormState;
  isManager: boolean;
  onChange: (patch: Partial<AiConfigFormState>) => void;
};

export function AiConfigIdentidadeSection({
  form,
  isManager,
  onChange,
}: AiConfigIdentidadeSectionProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <CardTitle className="text-base text-foreground">Identidade e mensagens</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Nome, saudação e tom da assistente. Use Salvar na barra inferior para gravar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="space-y-1.5">
          <LabelWithHelp
            label="Mensagem inicial"
            tooltip={TOOLTIP_INITIAL_MESSAGE}
            htmlFor="ai-initial-message"
          />
          <Textarea
            id="ai-initial-message"
            value={form.aiInitialMessage}
            onChange={(e) => onChange({ aiInitialMessage: e.target.value })}
            disabled={!isManager}
            rows={4}
            className={`${fieldClass} min-h-[96px]`}
          />
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
            placeholder="Ex.: Marina, Assistente IMOBI..."
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp
            label="Quando não souber a resposta"
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
          <LabelWithHelp label="Missão da empresa" tooltip={TOOLTIP_MISSION} htmlFor="ai-mission" />
          <Textarea
            id="ai-mission"
            value={form.aiCompanyMission}
            onChange={(e) => onChange({ aiCompanyMission: e.target.value })}
            disabled={!isManager}
            placeholder="Ex.: Construir histórias, não apenas casas."
            rows={2}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <LabelWithHelp label="Tom da IA" tooltip={TOOLTIP_TONE} htmlFor="ai-tone" />
          <Textarea
            id="ai-tone"
            value={form.aiTone}
            onChange={(e) => onChange({ aiTone: e.target.value })}
            disabled={!isManager}
            placeholder={TONE_PLACEHOLDER}
            rows={4}
            className={`${fieldClass} min-h-[96px]`}
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
