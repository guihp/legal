import type { DaySchedule } from '@/lib/businessHours';
import { DEFAULT_BUSINESS_SCHEDULE } from '@/lib/businessHours';

export const AI_CONFIG_SECTIONS = [
  'geral',
  'identidade',
  'contexto',
  'etiquetas',
  'visitas',
] as const;

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number];

export const AI_CONFIG_SECTION_META: Record<
  AiConfigSectionId,
  { label: string; description: string }
> = {
  geral: {
    label: 'Geral',
    description: 'Ativação e status da assistente',
  },
  identidade: {
    label: 'Identidade',
    description: 'Nome, mensagens e tom',
  },
  contexto: {
    label: 'Contexto',
    description: 'Políticas, regras e horários',
  },
  etiquetas: {
    label: 'Etiquetas',
    description: 'Catálogo de labels da IA',
  },
  visitas: {
    label: 'Visitas',
    description: 'Agendamento e corretores',
  },
};

export type AiConfigFormState = {
  aiInitialMessage: string;
  aiAssistantName: string;
  aiUnknownInfoMessage: string;
  aiCompanyMission: string;
  aiTone: string;
  aiPaymentMethods: string;
  aiVisitPolicy: string;
  aiTargetAudience: string;
  aiRules: string;
  aiAdditionalInfo: string;
  businessHoursSchedule: DaySchedule[];
};

export const EMPTY_AI_CONFIG_FORM: AiConfigFormState = {
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
  businessHoursSchedule: DEFAULT_BUSINESS_SCHEDULE,
};

export const TONE_PLACEHOLDER = `Ex.: Comunicação consultiva, humana e objetiva. Linguagem simples, sem termos técnicos em excesso. Sempre educada e proativa: responde com clareza, oferece próximos passos e evita pressão comercial. Pode usar emojis com moderação quando fizer sentido.`;

export const VISIT_POLICY_PLACEHOLDER = `Ex.: Visitas somente com agendamento mínimo de 24h. Atendimento presencial de segunda a sexta, das 9h às 18h, e sábado até 12h. Todo atendimento é acompanhado por corretor. Para condomínios fechados, solicitar documento com foto na portaria.`;

export const TARGET_AUDIENCE_PLACEHOLDER = `Ex.: Famílias de classe média que buscam primeiro imóvel com financiamento; investidores que procuram apartamentos compactos para locação; clientes de alto padrão interessados em casas em condomínio fechado na Zona Sul.`;

export const RULES_PLACEHOLDER = `Ex.: Nunca inventar valor, metragem ou condição comercial. Sempre confirmar disponibilidade antes de prometer visita. Não negociar preço final no chat: direcionar para corretor responsável. Quando faltar dado, informar com transparência e oferecer retorno humano.`;

export const ADDITIONAL_INFO_PLACEHOLDER = `Ex.: Diferenciais da empresa: aprovação de crédito com parceiros bancários, acompanhamento documental até a assinatura e suporte pós-venda por 90 dias. Regiões com maior atuação: Centro, Zona Sul e bairros com alta procura para aluguel.`;

export const UNKNOWN_INFO_PLACEHOLDER =
  'Ex.: Ótima pergunta. No momento esse detalhe não está disponível no meu cadastro com segurança. Se você quiser, eu registro agora e um corretor da nossa equipe te retorna com a informação exata.';

export const UNKNOWN_INFO_TOOLTIP =
  'Use quando o cliente pergunta algo que a assistente não tem como saber só pelo que está cadastrado — por exemplo: valor que ainda não foi consultado, condição de pagamento que vocês não descreveram aqui, ou detalhes do imóvel que não aparecem nos dados (metragem de um quarto, quantas pias tem a casa, quantas vagas na garagem, orientação do apartamento, etc.). A ideia é evitar que ela invente: ela segue o texto que você escreve no campo abaixo e pode oferecer anotar ou passar para um corretor.';

export const TOOLTIP_INITIAL_MESSAGE =
  'É a primeira mensagem que a assistente usa para receber o cliente no WhatsApp (ou outro canal). Escreva o texto final exatamente como você quer que o cliente receba, já com o nome da sua empresa.';

export const TOOLTIP_ASSISTANT_NAME =
  'Nome que a assistente usa para se apresentar (ex.: “Oi, sou a Marina…”). Ajuda a humanizar o atendimento e a manter a mesma “persona” em todas as conversas.';

export const TOOLTIP_MISSION =
  'Uma frase ou parágrafo curto sobre o propósito da sua empresa. A assistente usa isso para alinhar o discurso com o que vocês acreditam — por exemplo, foco em família, investimento ou atendimento premium.';

export const TOOLTIP_TONE =
  'Descreva como a assistente deve falar: mais formal ou mais de WhatsApp, se pode usar emoji, se deve ser breve ou explicar mais. Isso evita respostas “genéricas” ou fora do jeito da sua marca.';

export const TOOLTIP_PAYMENT =
  'Aqui vocês descrevem o que a assistente pode citar sobre pagamento. Exemplos do que vale incluir: PIX ou transferência; boleto; cartão (à vista ou parcelado); financiamento imobiliário; uso de FGTS; consórcio; permuta; entrada + saldo financiado. Se tiver desconto para pagamento à vista, parcelamento direto com a construtora ou proprietário, condições especiais para investidor, etc., escreva de forma clara — a assistente só repete o que estiver aqui; valores exatos e fechamento da negociação continuam com o corretor.';

export const TOOLTIP_VISIT_POLICY =
  'Explique como funcionam as visitas na sua imobiliária: precisa agendar? Atende sábado? Visita acompanhada? Documento ou identificação? Assim a assistente não promete o que vocês não fazem.';

export const TOOLTIP_TARGET_AUDIENCE =
  'Quem vocês mais atendem ou querem atrair (primeira casa, investidor, alto padrão, famílias…). Ajuda a assistente a usar exemplos e linguagem adequados, sem parecer desconectada do seu público.';

export const TOOLTIP_RULES =
  'Defina limites e combinados que a IA deve seguir em toda conversa. Exemplo: não prometer disponibilidade sem confirmar, não fechar desconto no chat, não inventar dados, sempre encaminhar para corretor em decisões comerciais.';

export const TOOLTIP_ADDITIONAL_INFO =
  'Use este campo para contexto estratégico que melhora o atendimento, mas não cabe nos campos acima: diferenciais da empresa, regiões foco, perfis de imóvel com maior giro, políticas internas e observações importantes para o time comercial.';

export const TOOLTIP_BUSINESS_HOURS =
  'Marque em cada dia se a loja ou o atendimento presencial fecha e, nos dias abertos, preencha os horários (abertura, intervalo de almoço e fechamento). Depois de salvar, a assistente pode usar esses horários para falar de disponibilidade e visitas de forma alinhada com a sua rotina.';

export const tooltipContentClass =
  'max-w-md whitespace-normal border-border bg-popover text-popover-foreground text-xs leading-relaxed px-3 py-2';

export const fieldClass = 'bg-background border-border text-foreground resize-y';
export const inputClass = 'bg-background border-border text-foreground';

export function parseAiConfigSection(value: string | null): AiConfigSectionId {
  if (value && (AI_CONFIG_SECTIONS as readonly string[]).includes(value)) {
    return value as AiConfigSectionId;
  }
  return 'geral';
}
