import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AiTestTopBar } from '@/components/ai-test/AiTestTopBar';
import { AiTestToolbar } from '@/components/ai-test/AiTestToolbar';
import { AiTestStatusBar } from '@/components/ai-test/AiTestStatusBar';
import { AiTestChatCard } from '@/components/ai-test/AiTestChatCard';
import { AiTestScenariosCard } from '@/components/ai-test/AiTestScenariosCard';
import { type AiTestScenario } from '@/components/ai-test/helpers';
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
import { safeRandomUUID } from '@/lib/safeRandomUUID';

const ASSISTANT_REPLY_TIMEOUT_MS = 90_000;

export function AiTestView() {
  const { company, loading: companyLoading, isManager } = useOwnCompany();
  const { instances, loading: instancesLoading } = useWhatsAppInstances();
  const { isOfficialApi } = useCompanyApiMode();
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
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

  const goConfigure = useCallback(() => {
    window.location.assign('/ai-configuration');
  }, []);

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
  }, [
    company,
    input,
    instancia,
    sessionId,
    sending,
    messages,
    clearReplyTimeout,
    reload,
    appendMessage,
    startAssistantPoll,
  ]);

  const handleClear = useCallback(async () => {
    if (!company?.id || clearing) return;

    const previousSessionId = sessionId;
    setClearing(true);
    clearReplyTimeout();
    setSending(false);
    setInput('');
    setActiveScenarioId(null);

    try {
      if (previousSessionId) {
        await clearAiTestSessionMessages(company.id, previousSessionId);
      }
      const nextSessionId = rotateAiTestSessionId(company.id);
      setSessionId(nextSessionId);
      toast.success('Nova sessão de teste iniciada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar conversa de teste';
      toast.error(message);
    } finally {
      setClearing(false);
    }
  }, [company?.id, sessionId, clearing, clearReplyTimeout]);

  const handleCopySession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      toast.success('Session ID copiado');
    } catch {
      toast.error('Não foi possível copiar o session ID');
    }
  }, [sessionId]);

  const handleSaveScenario = useCallback(() => {
    const text = input.trim() || messages.filter((m) => m.role === 'user').at(-1)?.content?.trim();
    if (!text) {
      toast.message('Digite ou envie uma mensagem do cliente antes de salvar o cenário.');
      return;
    }
    try {
      const key = `ai-test-saved-scenarios:${company?.id || 'local'}`;
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? (JSON.parse(existingRaw) as unknown[]) : [];
      const list = Array.isArray(existing) ? existing : [];
      list.unshift({
        id: safeRandomUUID(),
        prompt: text,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
      toast.success('Cenário salvo localmente neste navegador');
    } catch {
      toast.message('Cenários customizados ainda não sincronizam com o servidor.');
    }
  }, [input, messages, company?.id]);

  const handleScenario = useCallback((scenario: AiTestScenario) => {
    setActiveScenarioId(scenario.id);
    setInput(scenario.prompt);
  }, []);

  const handleSuggestion = useCallback((text: string) => {
    setInput(text);
  }, []);

  if (companyLoading || instancesLoading || (company?.id && !sessionId)) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="p-6 sm:p-8 text-center bg-[#F7F5F0] dark:bg-background min-h-[40vh]">
        <div className="text-red-600 mb-2 font-medium">Acesso restrito</div>
        <p className="text-muted-foreground text-sm">Apenas gestores podem testar a IA.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <AiTestTopBar />
            <AiTestToolbar
              clearing={clearing}
              onConfigure={goConfigure}
              onNewSession={() => void handleClear()}
              onSaveScenario={handleSaveScenario}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <AiTestStatusBar
          aiEnabled={aiEnabledInProduction}
          instancia={instancia}
          sessionId={sessionId}
          onCopySession={() => void handleCopySession()}
        />

        {!instancia ? (
          <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Nenhuma instância WhatsApp disponível. Configure uma conexão antes de enviar mensagens
            de teste.
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)] gap-4 items-start">
          {initialLoading ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm flex min-h-[420px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
            </div>
          ) : (
            <AiTestChatCard
              assistantName={assistantName}
              companyName={companyName}
              messages={messages}
              input={input}
              loading={sending}
              disabled={!canSend}
              onInputChange={setInput}
              onSend={() => void handleSend()}
              onRestart={() => void handleClear()}
              restarting={clearing}
              onSuggestion={handleSuggestion}
            />
          )}

          <div className="space-y-4 min-w-0">
            <AiTestScenariosCard activeId={activeScenarioId} onSelect={handleScenario} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiTestView;
