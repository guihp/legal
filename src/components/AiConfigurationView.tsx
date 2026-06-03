import { useEffect, useState } from 'react';
import { Bot, HelpCircle, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { AiVisitSchedulingCard } from '@/components/AiVisitSchedulingCard';
import { PendingVisitBrokerAssignments } from '@/components/PendingVisitBrokerAssignments';
import { BusinessHoursFields } from '@/components/BusinessHoursFields';
import {
  clearLegacyLocalVisitSchedulingConfig,
  companyRowToVisitSchedulingConfig,
  configsEqual,
  loadLegacyLocalVisitSchedulingConfig,
  type AiVisitSchedulingConfig,
} from '@/lib/aiVisitScheduling';
import {
  DEFAULT_BUSINESS_SCHEDULE,
  parseBusinessHours,
  serializeBusinessHours,
  type DaySchedule,
} from '@/lib/businessHours';

const TONE_PLACEHOLDER = `Ex.: Comunicação consultiva, humana e objetiva. Linguagem simples, sem termos técnicos em excesso. Sempre educada e proativa: responde com clareza, oferece próximos passos e evita pressão comercial. Pode usar emojis com moderação quando fizer sentido.`;

const VISIT_POLICY_PLACEHOLDER = `Ex.: Visitas somente com agendamento mínimo de 24h. Atendimento presencial de segunda a sexta, das 9h às 18h, e sábado até 12h. Todo atendimento é acompanhado por corretor. Para condomínios fechados, solicitar documento com foto na portaria.`;

const TARGET_AUDIENCE_PLACEHOLDER = `Ex.: Famílias de classe média que buscam primeiro imóvel com financiamento; investidores que procuram apartamentos compactos para locação; clientes de alto padrão interessados em casas em condomínio fechado na Zona Sul.`;

const RULES_PLACEHOLDER = `Ex.: Nunca inventar valor, metragem ou condição comercial. Sempre confirmar disponibilidade antes de prometer visita. Não negociar preço final no chat: direcionar para corretor responsável. Quando faltar dado, informar com transparência e oferecer retorno humano.`;

const ADDITIONAL_INFO_PLACEHOLDER = `Ex.: Diferenciais da empresa: aprovação de crédito com parceiros bancários, acompanhamento documental até a assinatura e suporte pós-venda por 90 dias. Regiões com maior atuação: Centro, Zona Sul e bairros com alta procura para aluguel.`;

const UNKNOWN_INFO_PLACEHOLDER =
  'Ex.: Ótima pergunta. No momento esse detalhe não está disponível no meu cadastro com segurança. Se você quiser, eu registro agora e um corretor da nossa equipe te retorna com a informação exata.';

const UNKNOWN_INFO_TOOLTIP =
  'Use quando o cliente pergunta algo que a assistente não tem como saber só pelo que está cadastrado — por exemplo: valor que ainda não foi consultado, condição de pagamento que vocês não descreveram aqui, ou detalhes do imóvel que não aparecem nos dados (metragem de um quarto, quantas pias tem a casa, quantas vagas na garagem, orientação do apartamento, etc.). A ideia é evitar que ela invente: ela segue o texto que você escreve no campo abaixo e pode oferecer anotar ou passar para um corretor.';

const TOOLTIP_INITIAL_MESSAGE =
  'É a primeira mensagem que a assistente usa para receber o cliente no WhatsApp (ou outro canal). Escreva o texto final exatamente como você quer que o cliente receba, já com o nome da sua empresa.';

const TOOLTIP_ASSISTANT_NAME =
  'Nome que a assistente usa para se apresentar (ex.: “Oi, sou a Marina…”). Ajuda a humanizar o atendimento e a manter a mesma “persona” em todas as conversas.';

const TOOLTIP_MISSION =
  'Uma frase ou parágrafo curto sobre o propósito da sua empresa. A assistente usa isso para alinhar o discurso com o que vocês acreditam — por exemplo, foco em família, investimento ou atendimento premium.';

const TOOLTIP_TONE =
  'Descreva como a assistente deve falar: mais formal ou mais de WhatsApp, se pode usar emoji, se deve ser breve ou explicar mais. Isso evita respostas “genéricas” ou fora do jeito da sua marca.';

const TOOLTIP_PAYMENT =
  'Aqui vocês descrevem o que a assistente pode citar sobre pagamento. Exemplos do que vale incluir: PIX ou transferência; boleto; cartão (à vista ou parcelado); financiamento imobiliário; uso de FGTS; consórcio; permuta; entrada + saldo financiado. Se tiver desconto para pagamento à vista, parcelamento direto com a construtora ou proprietário, condições especiais para investidor, etc., escreva de forma clara — a assistente só repete o que estiver aqui; valores exatos e fechamento da negociação continuam com o corretor.';

const TOOLTIP_VISIT_POLICY =
  'Explique como funcionam as visitas na sua imobiliária: precisa agendar? Atende sábado? Visita acompanhada? Documento ou identificação? Assim a assistente não promete o que vocês não fazem.';

const TOOLTIP_TARGET_AUDIENCE =
  'Quem vocês mais atendem ou querem atrair (primeira casa, investidor, alto padrão, famílias…). Ajuda a assistente a usar exemplos e linguagem adequados, sem parecer desconectada do seu público.';

const TOOLTIP_RULES =
  'Defina limites e combinados que a IA deve seguir em toda conversa. Exemplo: não prometer disponibilidade sem confirmar, não fechar desconto no chat, não inventar dados, sempre encaminhar para corretor em decisões comerciais.';

const TOOLTIP_ADDITIONAL_INFO =
  'Use este campo para contexto estratégico que melhora o atendimento, mas não cabe nos campos acima: diferenciais da empresa, regiões foco, perfis de imóvel com maior giro, políticas internas e observações importantes para o time comercial.';

const TOOLTIP_BUSINESS_HOURS =
  'Marque em cada dia se a loja ou o atendimento presencial fecha e, nos dias abertos, preencha os horários (abertura, intervalo de almoço e fechamento). Depois de salvar, a assistente pode usar esses horários para falar de disponibilidade e visitas de forma alinhada com a sua rotina.';

const tooltipContentClass =
  'max-w-md whitespace-normal border-gray-600 bg-gray-900 text-gray-100 text-xs leading-relaxed px-3 py-2';

function LabelWithHelp({ label, tooltip, htmlFor }: { label: string; tooltip: string; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Label className="text-gray-300 mb-0" htmlFor={htmlFor}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex rounded-full text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            aria-label={`Ajuda: ${label.replace(/:$/, '')}`}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className={tooltipContentClass}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AiConfigurationView() {
  const { company, loading, updating, isManager, updateCompany } = useOwnCompany();
  const [form, setForm] = useState({
    aiInitialMessage: '',
    aiAssistantName: '',
    aiUnknownInfoMessage: '',
    aiCompanyMission: '',
    aiTone: '',
    aiPaymentMethods: '',
    aiVisitPolicy: '',
    aiTargetAudience: '',
    aiRules: '',
    aiAdditionalInfo: '',
    businessHoursSchedule: DEFAULT_BUSINESS_SCHEDULE as DaySchedule[],
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [visitSchedulingConfig, setVisitSchedulingConfig] = useState<AiVisitSchedulingConfig>(
    () => companyRowToVisitSchedulingConfig(null)
  );

  useEffect(() => {
    if (!company) return;
    setVisitSchedulingConfig(companyRowToVisitSchedulingConfig(company));
  }, [company]);

  useEffect(() => {
    if (!company?.id || !isManager) return;
    const legacy = loadLegacyLocalVisitSchedulingConfig(company.id);
    if (!legacy?.updatedAt) return;
    const dbConfig = companyRowToVisitSchedulingConfig(company);
    if (!configsEqual(legacy, dbConfig)) {
      void (async () => {
        const ok = await updateCompany({
          ai_visit_broker_mode: legacy.mode,
          ai_visit_priority_criterion: legacy.priorityCriterion,
          ai_visit_broker_priorities: legacy.brokerPriorities,
        });
        if (ok) clearLegacyLocalVisitSchedulingConfig(company.id);
      })();
    } else {
      clearLegacyLocalVisitSchedulingConfig(company.id);
    }
  }, [company?.id, isManager]);

  useEffect(() => {
    if (!company) return;
    setForm({
      aiInitialMessage: company.ai_initial_message || '',
      aiAssistantName: company.ai_assistant_name || '',
      aiUnknownInfoMessage: company.ai_unknown_info_message || '',
      aiCompanyMission: company.ai_company_mission || '',
      aiTone: company.ai_tone || '',
      aiPaymentMethods: company.ai_payment_methods || '',
      aiVisitPolicy: company.ai_visit_policy || '',
      aiTargetAudience: company.ai_target_audience || '',
      aiRules: company.ai_rules || '',
      aiAdditionalInfo: company.ai_additional_info || '',
      businessHoursSchedule: parseBusinessHours(company.business_hours),
    });
  }, [company]);

  useEffect(() => {
    if (!company) return;
    const same =
      form.aiInitialMessage === (company.ai_initial_message || '') &&
      form.aiAssistantName === (company.ai_assistant_name || '') &&
      form.aiUnknownInfoMessage === (company.ai_unknown_info_message || '') &&
      form.aiCompanyMission === (company.ai_company_mission || '') &&
      form.aiTone === (company.ai_tone || '') &&
      form.aiPaymentMethods === (company.ai_payment_methods || '') &&
      form.aiVisitPolicy === (company.ai_visit_policy || '') &&
      form.aiTargetAudience === (company.ai_target_audience || '') &&
      form.aiRules === (company.ai_rules || '') &&
      form.aiAdditionalInfo === (company.ai_additional_info || '') &&
      serializeBusinessHours(form.businessHoursSchedule) === (company.business_hours || '');
    setHasChanges(!same);
  }, [form, company]);

  const updateSchedule = (dayKey: string, patch: Partial<DaySchedule>) => {
    setForm((prev) => ({
      ...prev,
      businessHoursSchedule: prev.businessHoursSchedule.map((day) =>
        day.dayKey === dayKey ? { ...day, ...patch } : day
      ),
    }));
  };

  const handleSave = async () => {
    const ok = await updateCompany({
      business_hours: serializeBusinessHours(form.businessHoursSchedule),
      ai_initial_message: form.aiInitialMessage,
      ai_assistant_name: form.aiAssistantName,
      ai_unknown_info_message: form.aiUnknownInfoMessage,
      ai_company_mission: form.aiCompanyMission,
      ai_tone: form.aiTone,
      ai_payment_methods: form.aiPaymentMethods,
      ai_visit_policy: form.aiVisitPolicy,
      ai_target_audience: form.aiTargetAudience,
      ai_rules: form.aiRules,
      ai_additional_info: form.aiAdditionalInfo,
    });
    if (ok) setHasChanges(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex gap-3">
        <Bot className="h-8 w-8 text-blue-400 shrink-0 mt-1" />
        <div className="space-y-3 min-w-0 flex-1 max-w-3xl">
          <div>
            <h1 className="text-2xl font-semibold text-white">Configuração para IA</h1>
            <p className="text-sm text-gray-400 mt-1">
              Textos e contexto usados pela assistente no atendimento (ex.: WhatsApp).
            </p>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed border-l-2 border-blue-500/40 pl-4">
            Depois que você salvar,{' '}
            <span className="text-gray-300">quem entrar em contato pela primeira vez</span> ou{' '}
            <span className="text-gray-300">iniciar uma conversa nova</span> costuma ser atendido já com
            essas informações. Quem{' '}
            <span className="text-gray-300">já está numa conversa aberta no WhatsApp</span> pode levar um
            tempinho para “pegar” tudo que mudou — é normal, porque a assistente lembra do que já foi dito
            naquela conversa.
          </p>
        </div>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Identidade e mensagens:</CardTitle>
          <CardDescription className="text-gray-400">
            Ao clicar em <strong className="text-gray-300 font-medium">Salvar</strong>, o que você
            preencheu fica registrado na sua empresa e passa a orientar como a assistente responde nos
            atendimentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <LabelWithHelp label="Mensagem inicial:" tooltip={TOOLTIP_INITIAL_MESSAGE} htmlFor="ai-initial-message" />
            <Textarea
              id="ai-initial-message"
              value={form.aiInitialMessage}
              onChange={(e) => setForm((p) => ({ ...p, aiInitialMessage: e.target.value }))}
              disabled={!isManager}
              rows={4}
              className="bg-gray-900/50 border-gray-600 text-white resize-y min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Nome da IA:" tooltip={TOOLTIP_ASSISTANT_NAME} htmlFor="ai-assistant-name" />
            <Input
              id="ai-assistant-name"
              value={form.aiAssistantName}
              onChange={(e) => setForm((p) => ({ ...p, aiAssistantName: e.target.value }))}
              disabled={!isManager}
              placeholder="Ex.: Marina, Assistente IMOBI..."
              className="bg-gray-900/50 border-gray-600 text-white"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp
              label="O que a IA deve dizer quando não tiver a resposta no cadastro:"
              tooltip={UNKNOWN_INFO_TOOLTIP}
              htmlFor="ai-unknown-info"
            />
            <Textarea
              id="ai-unknown-info"
              value={form.aiUnknownInfoMessage}
              onChange={(e) => setForm((p) => ({ ...p, aiUnknownInfoMessage: e.target.value }))}
              disabled={!isManager}
              placeholder={UNKNOWN_INFO_PLACEHOLDER}
              rows={3}
              className="bg-gray-900/50 border-gray-600 text-white resize-y"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Missão da empresa:" tooltip={TOOLTIP_MISSION} htmlFor="ai-mission" />
            <Textarea
              id="ai-mission"
              value={form.aiCompanyMission}
              onChange={(e) => setForm((p) => ({ ...p, aiCompanyMission: e.target.value }))}
              disabled={!isManager}
              placeholder="Ex.: Construir histórias, não apenas casas."
              rows={2}
              className="bg-gray-900/50 border-gray-600 text-white resize-y"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Tom da IA:" tooltip={TOOLTIP_TONE} htmlFor="ai-tone" />
            <Textarea
              id="ai-tone"
              value={form.aiTone}
              onChange={(e) => setForm((p) => ({ ...p, aiTone: e.target.value }))}
              disabled={!isManager}
              placeholder={TONE_PLACEHOLDER}
              rows={4}
              className="bg-gray-900/50 border-gray-600 text-white resize-y min-h-[100px]"
            />
            <p className="text-xs text-gray-500">{TONE_PLACEHOLDER}</p>
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Métodos de pagamento:" tooltip={TOOLTIP_PAYMENT} htmlFor="ai-payments" />
            <Textarea
              id="ai-payments"
              value={form.aiPaymentMethods}
              onChange={(e) => setForm((p) => ({ ...p, aiPaymentMethods: e.target.value }))}
              disabled={!isManager}
              placeholder="Ex.: PIX, boleto, cartão em até 12x, financiamento bancário..."
              rows={3}
              className="bg-gray-900/50 border-gray-600 text-white resize-y"
            />
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Política de visita:" tooltip={TOOLTIP_VISIT_POLICY} htmlFor="ai-visit-policy" />
            <Textarea
              id="ai-visit-policy"
              value={form.aiVisitPolicy}
              onChange={(e) => setForm((p) => ({ ...p, aiVisitPolicy: e.target.value }))}
              disabled={!isManager}
              placeholder={VISIT_POLICY_PLACEHOLDER}
              rows={4}
              className="bg-gray-900/50 border-gray-600 text-white resize-y min-h-[100px]"
            />
            <p className="text-xs text-gray-500">
              Use para alinhar agendamento, dias/horários de visita e regras (ex.: acompanhamento, documentos).
            </p>
          </div>

          <div className="space-y-2">
            <LabelWithHelp
              label="Público-alvo:"
              tooltip={TOOLTIP_TARGET_AUDIENCE}
              htmlFor="ai-target-audience"
            />
            <Textarea
              id="ai-target-audience"
              value={form.aiTargetAudience}
              onChange={(e) => setForm((p) => ({ ...p, aiTargetAudience: e.target.value }))}
              disabled={!isManager}
              placeholder={TARGET_AUDIENCE_PLACEHOLDER}
              rows={3}
              className="bg-gray-900/50 border-gray-600 text-white resize-y"
            />
            <p className="text-xs text-gray-500">
              Quem a imobiliária atende com mais frequência — ajuda a IA a priorizar linguagem e exemplos.
            </p>
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Regras da IA:" tooltip={TOOLTIP_RULES} htmlFor="ai-rules" />
            <Textarea
              id="ai-rules"
              value={form.aiRules}
              onChange={(e) => setForm((p) => ({ ...p, aiRules: e.target.value }))}
              disabled={!isManager}
              placeholder={RULES_PLACEHOLDER}
              rows={4}
              className="bg-gray-900/50 border-gray-600 text-white resize-y min-h-[100px]"
            />
            <p className="text-xs text-gray-500">{RULES_PLACEHOLDER}</p>
          </div>

          <div className="space-y-2">
            <LabelWithHelp
              label="Informações adicionais:"
              tooltip={TOOLTIP_ADDITIONAL_INFO}
              htmlFor="ai-additional-info"
            />
            <Textarea
              id="ai-additional-info"
              value={form.aiAdditionalInfo}
              onChange={(e) => setForm((p) => ({ ...p, aiAdditionalInfo: e.target.value }))}
              disabled={!isManager}
              placeholder={ADDITIONAL_INFO_PLACEHOLDER}
              rows={4}
              className="bg-gray-900/50 border-gray-600 text-white resize-y min-h-[100px]"
            />
            <p className="text-xs text-gray-500">{ADDITIONAL_INFO_PLACEHOLDER}</p>
          </div>

          <div className="space-y-2">
            <LabelWithHelp label="Horário de funcionamento detalhado:" tooltip={TOOLTIP_BUSINESS_HOURS} />
            <BusinessHoursFields
              schedule={form.businessHoursSchedule}
              onChangeDay={updateSchedule}
              disabled={!isManager}
            />
          </div>

          {!isManager && (
            <p className="text-sm text-gray-500 italic">
              Apenas administradores e gestores podem editar estas configurações.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isManager || !hasChanges || updating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AiVisitSchedulingCard
        companyId={company?.id}
        isManager={isManager}
        initialConfig={visitSchedulingConfig}
        externalSaving={updating}
        onSave={async (config) =>
          updateCompany({
            ai_visit_broker_mode: config.mode,
            ai_visit_priority_criterion: config.priorityCriterion,
            ai_visit_broker_priorities: config.brokerPriorities,
          })
        }
      />

      <PendingVisitBrokerAssignments />
    </div>
    </TooltipProvider>
  );
}

export default AiConfigurationView;
