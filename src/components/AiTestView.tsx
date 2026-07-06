import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneWhatsAppSimulator } from '@/components/ai-test/PhoneWhatsAppSimulator';
import { useCompanyApiMode } from '@/hooks/useCompanyApiMode';
import { useAiTestMessages } from '@/hooks/useAiTestMessages';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import {
  clearAiTestSessionMessages,
  getOrCreateAiTestSessionId,
  insertUserAiTestMessage,
  rotateAiTestSessionId,
  sendAiTestMessage,
} from '@/lib/aiTestSimulator';
import { resolveWhatsappSendInstancia } from '@/lib/resolveWhatsappSendInstancia';

const ASSISTANT_REPLY_TIMEOUT_MS = 90_000;

export function AiTestView() {
  const { company, loading: companyLoading, isManager } = useOwnCompany();
  const { instances, loading: instancesLoading } = useWhatsAppInstances();
  const { isOfficialApi } = useCompanyApiMode();
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const awaitingReplyRef = useRef(false);
  const replyTimeoutRef = useRef<number | null>(null);
  const assistantCountAtSendRef = useRef(0);

  useEffect(() => {
    if (!company?.id) return;
    setSessionId(getOrCreateAiTestSessionId(company.id));
  }, [company?.id]);

  const {
    messages,
    appendMessage,
    initialLoading,
    reload,
    startAssistantPoll,
    stopAssistantPoll,
  } = useAiTestMessages({
    companyId: company?.id,
    sessionId,
  });

  const instancia = useMemo(() => {
    try {
      return resolveWhatsappSendInstancia({
        selectedInstance: null,
        conversationInstancia: null,
        scopedInstance: null,
        instances,
        isOfficialApi,
      });
    } catch {
      return isOfficialApi ? 'default' : '';
    }
  }, [instances, isOfficialApi]);

  const assistantName = company?.ai_assistant_name?.trim() || 'Assistente IA';
  const companyName = company?.name || 'Sua imobiliária';
  const aiEnabledInProduction = company?.ai_assistant_enabled ?? false;
  const canSend = Boolean(company?.id && instancia && sessionId && !sending && !clearing);

  const clearReplyTimeout = useCallback(() => {
    if (replyTimeoutRef.current != null) {
      window.clearTimeout(replyTimeoutRef.current);
      replyTimeoutRef.current = null;
    }
    awaitingReplyRef.current = false;
    stopAssistantPoll();
  }, [stopAssistantPoll]);

  useEffect(() => {
    if (!awaitingReplyRef.current) return;
    const assistantCount = messages.filter((m) => m.role === 'assistant').length;
    if (assistantCount > assistantCountAtSendRef.current) {
      clearReplyTimeout();
      setSending(false);
    }
  }, [messages, clearReplyTimeout]);

  useEffect(() => () => clearReplyTimeout(), [clearReplyTimeout]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !company?.id || !instancia || !sessionId || sending) return;

    setInput('');
    setSending(true);
    awaitingReplyRef.current = true;
    assistantCountAtSendRef.current = messages.filter((m) => m.role === 'assistant').length;
    startAssistantPoll();

    replyTimeoutRef.current = window.setTimeout(() => {
      clearReplyTimeout();
      setSending(false);
      toast.error('A IA não respondeu a tempo. Verifique o fluxo n8n de teste.');
    }, ASSISTANT_REPLY_TIMEOUT_MS);

    try {
      const userMsg = await insertUserAiTestMessage({
        companyId: company.id,
        sessionId,
        content: text,
      });
      appendMessage(userMsg);

      await sendAiTestMessage({
        companyId: company.id,
        sessionId,
        message: text,
        instancia,
      });
    } catch (err) {
      clearReplyTimeout();
      setSending(false);
      const message = err instanceof Error ? err.message : 'Erro ao testar a IA';
      toast.error(message);
      void reload();
    }
  }, [company, input, instancia, sessionId, sending, messages, clearReplyTimeout, reload, appendMessage, startAssistantPoll]);

  const handleClear = useCallback(async () => {
    if (!company?.id || clearing) return;

    const previousSessionId = sessionId;
    setClearing(true);
    clearReplyTimeout();
    setSending(false);
    setInput('');

    try {
      if (previousSessionId) {
        await clearAiTestSessionMessages(company.id, previousSessionId);
      }
      const nextSessionId = rotateAiTestSessionId(company.id);
      setSessionId(nextSessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar conversa de teste';
      toast.error(message);
    } finally {
      setClearing(false);
    }
  }, [company?.id, sessionId, clearing, clearReplyTimeout]);

  if (companyLoading || instancesLoading || (company?.id && !sessionId)) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <div className="text-red-400 mb-2">Acesso restrito</div>
        <p className="text-gray-400 text-sm">Apenas gestores podem testar a IA.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 py-4 sm:gap-6 sm:py-8">
      <div className="w-full text-center">
        <h1 className="flex items-center justify-center gap-2 text-xl font-semibold text-white sm:text-2xl">
          <Smartphone className="h-6 w-6 shrink-0 text-emerald-400 sm:h-7 sm:w-7" />
          Testar IA
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-gray-400">
          Simule uma conversa de WhatsApp. Cada sessão usa um{' '}
          <span className="text-gray-300">session_id</span> UUID exclusivo; ao limpar, uma nova
          sessão é criada e o histórico de teste é apagado do banco.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge
            className={
              aiEnabledInProduction
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
            }
          >
            {aiEnabledInProduction ? 'IA ativa em produção' : 'IA desativada em produção'}
          </Badge>
          {instancia ? (
            <Badge variant="outline" className="border-gray-700 text-gray-400">
              Instância: {instancia}
            </Badge>
          ) : (
            <Badge className="border-red-500/30 bg-red-500/15 text-red-300">
              Nenhuma instância WhatsApp disponível
            </Badge>
          )}
          {sessionId ? (
            <Badge variant="outline" className="max-w-full border-gray-700 text-gray-400">
              <span className="truncate">Sessão: {sessionId}</span>
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-200"
          onClick={() => window.location.assign('/ai-configuration')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Configurar IA
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-200"
          onClick={() => void handleClear()}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Limpar conversa
        </Button>
      </div>

      {initialLoading ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : (
        <PhoneWhatsAppSimulator
          companyName={companyName}
          assistantName={assistantName}
          messages={messages}
          input={input}
          loading={sending}
          disabled={!canSend}
          onInputChange={setInput}
          onSend={() => void handleSend()}
        />
      )}
    </div>
  );
}

export default AiTestView;
