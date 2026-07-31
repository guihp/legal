import type { DaySchedule } from '@/lib/businessHours';
import { DEFAULT_BUSINESS_SCHEDULE } from '@/lib/businessHours';

/** Primary cream-nav sections (mockups). `etiquetas` kept for URL/back-compat. */
export const AI_CONFIG_SECTIONS = [
  'identidade',
  'contexto',
  'horario',
  'visitas',
  'etiquetas',
] as const;

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number];

/** Sections shown in the horizontal SEÇÃO nav (mockups). */
export const AI_CONFIG_NAV_SECTIONS: readonly AiConfigSectionId[] = [
  'identidade',
  'contexto',
  'horario',
  'visitas',
];

export const AI_CONFIG_SECTION_META: Record<
  AiConfigSectionId,
  { label: string; description: string }
> = {
  identidade: {
    label: 'Identidade e mensagens',
    description: 'Nome, tom e mensagens que abrem o atendimento',
  },
  contexto: {
    label: 'Contexto e regras',
    description: 'Base de conhecimento que orienta as respostas',
  },
  horario: {
    label: 'Horário de funcionamento',
    description: 'Dias abertos · fora do horário a IA informa retorno humano',
  },
  visitas: {
    label: 'Agendamento de visitas',
    description: 'Como a assistente escolhe o corretor da visita',
  },
  etiquetas: {
    label: 'Etiquetas',
    description: 'Catálogo de labels da IA',
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

export const TONE_PLACEHOLDER = `Atendimento humano, consultivo, atento e objetivo. Respostas curtas, educadas e naturais, como um consultor real no WhatsApp. Sem gírias ou linguagem informal demais.`;

export const TONE_HINT =
  'Emojis com moderação. Sempre oferecer próximo passo, sem pressão comercial.';

export const VISIT_POLICY_PLACEHOLDER = `Ex.: Visitas somente com agendamento mínimo de 24h. Atendimento presencial de segunda a sexta, das 9h às 18h, e sábado até 12h. Todo atendimento é acompanhado por corretor. Para condomínios fechados, solicitar documento com foto na portaria.`;

export const TARGET_AUDIENCE_PLACEHOLDER = `Ex.: Famílias de classe média que buscam primeiro imóvel com financiamento; investidores que procuram apartamentos compactos para locação; clientes de alto padrão interessados em casas em condomínio fechado na Zona Sul.`;

export const RULES_PLACEHOLDER = `Ex.: Nunca inventar valor, metragem ou condição comercial. Sempre confirmar disponibilidade antes de prometer visita. Não negociar preço final no chat: direcionar para corretor responsável. Quando faltar dado, informar com transparência e oferecer retorno humano.`;

export const ADDITIONAL_INFO_PLACEHOLDER = `Ex.: Diferenciais da empresa: aprovação de crédito com parceiros bancários, acompanhamento documental até a assinatura e suporte pós-venda por 90 dias. Regiões com maior atuação: Centro, Zona Sul e bairros com alta procura para aluguel.`;

export const UNKNOWN_INFO_PLACEHOLDER =
  'Vou confirmar essa informação para te passar tudo certinho. Prefiro verificar com precisão antes de responder.';

export const UNKNOWN_INFO_TOOLTIP =
  'Use quando o cliente pergunta algo que a assistente não tem como saber só pelo que está cadastrado — por exemplo: valor que ainda não foi consultado, condição de pagamento que vocês não descreveram aqui, ou detalhes do imóvel que não aparecem nos dados. A ideia é evitar que ela invente: ela segue o texto que você escreve no campo abaixo e pode oferecer anotar ou passar para um corretor.';

export const TOOLTIP_INITIAL_MESSAGE =
  'É a primeira mensagem que a assistente usa para receber o cliente no WhatsApp (ou outro canal). Escreva o texto final exatamente como você quer que o cliente receba. Variáveis: {nome}, {imovel}, {corretor}, {empresa}.';

export const TOOLTIP_ASSISTANT_NAME =
  'Nome que a assistente usa para se apresentar (ex.: “Oi, sou a Marina…”). Ajuda a humanizar o atendimento e a manter a mesma “persona” em todas as conversas.';

export const TOOLTIP_MISSION =
  'Uma frase ou parágrafo curto sobre o propósito da sua empresa. Aparece quando o cliente pergunta sobre a construtora/imobiliária.';

export const TOOLTIP_TONE =
  'Descreva como a assistente deve falar: mais formal ou mais de WhatsApp, se pode usar emoji, se deve ser breve ou explicar mais.';

export const TOOLTIP_PAYMENT =
  'A IA nunca fecha condição comercial — sempre direciona ao corretor. Descreva o que ela pode citar: PIX, boleto, cartão, financiamento, FGTS, etc.';

export const TOOLTIP_VISIT_POLICY =
  'Use para alinhar agendamento, dias/horários e documentos necessários.';

export const TOOLTIP_TARGET_AUDIENCE =
  'Ajuda a IA a priorizar linguagem e exemplos.';

export const TOOLTIP_RULES =
  'Restrições duras: a IA não pode contrariar estas regras.';

export const TOOLTIP_ADDITIONAL_INFO =
  'Diferenciais, regiões de atuação, parceiros bancários, suporte pós-venda.';

export const TOOLTIP_BUSINESS_HOURS =
  'Marque em cada dia se a loja ou o atendimento presencial fecha e, nos dias abertos, preencha os horários (abertura, intervalo de almoço e fechamento).';

export const tooltipContentClass =
  'max-w-md whitespace-normal border-border bg-popover text-popover-foreground text-xs leading-relaxed px-3 py-2';

export const fieldClass =
  'bg-white dark:bg-background border-border/80 text-foreground resize-y rounded-xl shadow-sm';
export const inputClass =
  'bg-white dark:bg-background border-border/80 text-foreground rounded-xl shadow-sm';

export function parseAiConfigSection(value: string | null): AiConfigSectionId {
  if (value === 'geral') return 'identidade';
  if (value && (AI_CONFIG_SECTIONS as readonly string[]).includes(value)) {
    return value as AiConfigSectionId;
  }
  return 'identidade';
}
