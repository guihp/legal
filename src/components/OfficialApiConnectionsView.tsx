import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, CheckCircle, Calendar, MessageSquare } from "lucide-react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useConversasList } from '@/hooks/useConversasList';
import { useInstagramConversasList } from '@/hooks/useInstagramConversasList';
import { useInstagramInstances } from '@/hooks/useInstagramInstances';
import { supabase } from '@/integrations/supabase/client';
import { CompanyInstagramConnectionsSection } from '@/components/CompanyInstagramConnectionsSection';
import { ConnectionsTopBar } from '@/components/connections/ConnectionsTopBar';
import { buildConnectionsSubtitle } from '@/components/connections/helpers';

function isSameLocalCalendarDay(isoOrDate: string | Date, ref: Date = new Date()): boolean {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getDate() === ref.getDate() &&
    d.getMonth() === ref.getMonth() &&
    d.getFullYear() === ref.getFullYear()
  );
}

export function OfficialApiConnectionsView() {
  const { profile, isManager } = useUserProfile();
  const { conversas, loading: loadingConversas } = useConversasList(null);
  const { companyInstagramId, scopedInstance } = useInstagramInstances();
  const { conversas: conversasInstagram, loading: loadingConversasInstagram } = useInstagramConversasList(
    scopedInstance,
    companyInstagramId
  );
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [agendamentosHoje, setAgendamentosHoje] = useState(0);
  const [agendamentosSemana, setAgendamentosSemana] = useState(0);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const hasLoadedConversasOnce = useRef(false);
  if (!loadingConversas && !hasLoadedConversasOnce.current) {
    hasLoadedConversasOnce.current = true;
  }
  const hasLoadedInstagramOnce = useRef(false);
  if (!loadingConversasInstagram && !hasLoadedInstagramOnce.current) {
    hasLoadedInstagramOnce.current = true;
  }
  const showConversasLoading =
    (loadingConversas && !hasLoadedConversasOnce.current) ||
    (loadingConversasInstagram && !hasLoadedInstagramOnce.current);

  const conversasHoje = useMemo(() => {
    const today = new Date();
    const wa = conversas.filter((c) => isSameLocalCalendarDay(c.lastMessageDate, today)).length;
    const ig = conversasInstagram.filter((c) => isSameLocalCalendarDay(c.lastMessageDate, today)).length;
    return wa + ig;
  }, [conversas, conversasInstagram]);

  const totalChatsAtivos = conversas.length + conversasInstagram.length;

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!profile?.company_id) return;

      try {
        const resetAtTime = new Date();
        resetAtTime.setHours(0, 0, 0, 0);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        const { data: leads, error } = await supabase
          .from('leads')
          .select('stage, updated_at')
          .eq('company_id', profile.company_id)
          .in('stage', ['visita-agendada', 'Visita Agendada']);

        if (!error && leads) {
          const hoje = leads.filter(l => new Date(l.updated_at) >= resetAtTime).length;
          const semana = leads.filter(l => new Date(l.updated_at) >= weekAgo).length;
          setAgendamentosHoje(hoje);
          setAgendamentosSemana(semana);
        }
      } catch (err) {
        console.error('Erro ao buscar agendamentos:', err);
      } finally {
        setLoadingLeads(false);
      }

      try {
        const { data: cData } = await supabase
          .from('companies')
          .select('phone, whatsapp_ai_phone')
          .eq('id', profile.company_id)
          .single();

        let waCount = 0;
        const rawPhone = (cData as any)?.whatsapp_ai_phone || (cData as any)?.phone;
        if (rawPhone) {
          const cleanPhone = String(rawPhone).replace(/\D/g, '');
          if (cleanPhone) {
            // Preferir crm_*; fallback ao nome legado se o shard ainda não foi renomeado.
            const candidates = [
              `crm_whatsapp_messages_${cleanPhone}`,
              `imobipro_messages_${cleanPhone}`,
            ];
            for (const tableName of candidates) {
              const { count, error: mErr } = await supabase
                .from(tableName as any)
                .select('*', { count: 'exact', head: true });
              if (!mErr && count !== null) {
                waCount = count;
                break;
              }
            }
          }
        }

        let igCount = 0;
        const { count: igTotal, error: igErr } = await supabase
          .from('crm_instagram_messages')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', profile.company_id);
        if (!igErr && igTotal !== null) igCount = igTotal;

        setTotalMessages(waCount + igCount);
      } catch (err) {
        console.error('Erro ao contar mensagens totais:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMetrics();
  }, [profile?.company_id]);

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <ConnectionsTopBar />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
                  Conexões
                </h1>
                <span className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  API Oficial do WhatsApp
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {buildConnectionsSubtitle(isManager)} · monitoramento da instância dedicada
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium text-lg">Online e operante</h3>
                    <span className="text-muted-foreground text-sm">Integração homologada via API oficial</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Métricas de performance da equipe e IA
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-muted-foreground font-medium text-sm">Conversas no dia</h3>
                      <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                    </div>
                    {showConversasLoading ? (
                      <div className="h-9 w-16 rounded bg-muted animate-pulse" />
                    ) : (
                      <div className="text-3xl font-bold text-foreground">{conversasHoje}</div>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Total de {totalChatsAtivos} conversas ativas (WhatsApp e Instagram)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-muted-foreground font-medium text-sm">Mensagens trocadas</h3>
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    {loadingMessages ? (
                      <div className="h-9 w-16 rounded bg-muted animate-pulse" />
                    ) : (
                      <div className="text-3xl font-bold text-foreground">
                        {totalMessages.toLocaleString('pt-BR')}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      WhatsApp (instância oficial) + Instagram (CRM)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm md:col-span-2 xl:col-span-1">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-muted-foreground font-medium text-sm">Agendamentos aprovados</h3>
                      <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                    {loadingLeads ? (
                      <div className="h-9 w-24 rounded bg-muted animate-pulse" />
                    ) : (
                      <div className="flex items-end gap-3">
                        <div className="text-4xl font-bold text-foreground">{agendamentosHoje}</div>
                        <div className="text-sm text-muted-foreground mb-1 font-medium tracking-wide uppercase">hoje</div>
                        <div className="w-px h-6 bg-border mb-2 mx-1" />
                        <div className="text-2xl font-bold text-foreground/70">{agendamentosSemana}</div>
                        <div className="text-xs text-muted-foreground mb-1.5 uppercase font-medium">semana</div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block mr-1" />
                      Leads capturados com sucesso
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 min-w-0">
            <CompanyInstagramConnectionsSection />
          </div>
        </div>
      </div>
    </div>
  );
}
