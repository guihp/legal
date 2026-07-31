import { AI_CONFIG_EMERALD, interpolatePreview } from './helpers';

type Props = {
  assistantName: string;
  companyName: string;
  initialMessage: string;
};

export function AiConfigPreview({ assistantName, companyName, initialMessage }: Props) {
  const greeting = interpolatePreview(
    initialMessage.trim() ||
      `Bom dia, {nome}! 😊\nSeja bem-vindo(a) à ${companyName || '{empresa}'}.\n\nEu sou ${assistantName || 'a assistente'} e vou te ajudar no que precisar.`,
    { nome: 'Tayelle', empresa: companyName || 'nossa imobiliária' },
  );

  const followUp =
    'Temos, sim! Posso te mostrar as opções prontas e na planta. Prefere começar por qual?';

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Prévia da abordagem</h3>
        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          WhatsApp
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-[#F7F5F0]/80 dark:bg-muted/30 p-3 space-y-2.5 min-h-[160px]">
        <Bubble side="assistant">{greeting}</Bubble>
        <Bubble side="user">Oi! Vi o anúncio das casas, ainda tem disponível?</Bubble>
        <Bubble side="assistant">{followUp}</Bubble>
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: 'assistant' | 'user';
  children: string;
}) {
  const isAi = side === 'assistant';
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={
          isAi
            ? 'max-w-[92%] rounded-2xl rounded-bl-md px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm'
            : 'max-w-[92%] rounded-2xl rounded-br-md px-3 py-2 text-sm whitespace-pre-wrap break-words bg-white dark:bg-background border border-border/70 text-foreground shadow-sm'
        }
        style={
          isAi
            ? { backgroundColor: AI_CONFIG_EMERALD, color: '#ffffff' }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
