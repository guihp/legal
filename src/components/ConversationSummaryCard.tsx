import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ConversationSummaryData } from '@/lib/parseConversationSummaryResponse';

const QUALIDADE_LABELS: Record<string, string> = {
  cordialidade: 'Cordialidade',
  clareza: 'Clareza',
  objetividade: 'Objetividade',
  resolutividade: 'Resolutividade',
  consistencia: 'Consistência',
};

function normalizeScore10(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 10) return Math.min(10, Math.max(0, n / 10));
  return Math.min(10, Math.max(0, n));
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'aberto':
    case 'agendado':
      return 'text-emerald-800 border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-300';
    case 'pendente':
      return 'text-amber-800 border-amber-500/40 bg-amber-500/10 dark:text-amber-300';
    case 'fechado':
      return 'text-rose-800 border-rose-500/40 bg-rose-500/10 dark:text-rose-300';
    default:
      return 'text-blue-800 border-blue-500/40 bg-blue-500/10 dark:text-blue-300';
  }
}

function formatTime(seconds: number | undefined) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

interface ConversationSummaryCardProps {
  summary: ConversationSummaryData;
  className?: string;
}

export function ConversationSummaryCard({ summary, className }: ConversationSummaryCardProps) {
  const qualidadeItems = useMemo(() => {
    if (!summary.qualidade || typeof summary.qualidade !== 'object') return [];
    return Object.entries(summary.qualidade)
      .map(([key, raw]) => ({
        key,
        label: QUALIDADE_LABELS[key] || key.replace(/_/g, ' '),
        score: normalizeScore10(raw),
      }))
      .filter((item) => item.key);
  }, [summary.qualidade]);

  const hasMetricas =
    summary.metricas &&
    Object.values(summary.metricas).some((v) => v != null && v !== 0);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-[#F7F5F0]/90 dark:bg-gray-900/40 p-3 sm:p-3.5 space-y-3',
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Resumo da conversa
      </p>

      {(summary.status_atendimento || summary.nota_atendimento != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {summary.status_atendimento && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                getStatusColor(summary.status_atendimento),
              )}
            >
              {summary.status_atendimento}
            </span>
          )}
          {summary.nota_atendimento != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              Nota {summary.nota_atendimento}/10
            </span>
          )}
        </div>
      )}

      {summary.resumo_conversa && (
        <p className="text-xs leading-relaxed text-foreground/90 dark:text-gray-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {summary.resumo_conversa}
        </p>
      )}

      {!!summary.proximas_acoes?.length && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Próximas ações
          </p>
          <ul className="space-y-1">
            {summary.proximas_acoes.map((acao, index) => (
              <li key={index} className="flex items-start gap-1.5 text-xs text-foreground/90">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{acao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!summary.pendencias?.length && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pendências
          </p>
          <ul className="space-y-1">
            {summary.pendencias.map((item, index) => (
              <li key={index} className="text-xs text-foreground/90 flex items-start gap-1.5">
                <span className="text-amber-600 mt-0.5 shrink-0">•</span>
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!summary.riscos?.length && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Riscos
          </p>
          <ul className="space-y-1">
            {summary.riscos.map((item, index) => (
              <li key={index} className="text-xs text-foreground/90 flex items-start gap-1.5">
                <span className="text-rose-600 mt-0.5 shrink-0">•</span>
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMetricas && summary.metricas && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Métricas
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {summary.metricas.total_mensagens != null && (
              <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  {summary.metricas.total_mensagens}
                </div>
                <div className="text-[10px] text-muted-foreground">Mensagens</div>
              </div>
            )}
            {summary.metricas.mensagens_ia != null && (
              <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {summary.metricas.mensagens_ia}
                </div>
                <div className="text-[10px] text-muted-foreground">IA</div>
              </div>
            )}
            {summary.metricas.mensagens_human != null && (
              <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  {summary.metricas.mensagens_human}
                </div>
                <div className="text-[10px] text-muted-foreground">Humano</div>
              </div>
            )}
            {summary.metricas.tempo_primeira_resposta_segundos != null && (
              <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {formatTime(summary.metricas.tempo_primeira_resposta_segundos)}
                </div>
                <div className="text-[10px] text-muted-foreground">1ª resposta</div>
              </div>
            )}
          </div>
        </div>
      )}

      {qualidadeItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Qualidade
          </p>
          <div className="space-y-2">
            {qualidadeItems.slice(0, 4).map(({ key, label, score }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between gap-2 text-[11px]">
                  <span className="text-foreground/90 capitalize truncate">{label}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {score.toFixed(score % 1 === 0 ? 0 : 1)}/10
                  </span>
                </div>
                <Progress value={score * 10} className="h-1.5 bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
