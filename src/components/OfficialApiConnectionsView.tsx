import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, CheckCircle, Calendar, MessageSquare } from "lucide-react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useConversasList } from '@/hooks/useConversasList';
import { useInstagramConversasList } from '@/hooks/useInstagramConversasList';
import { useInstagramInstances } from '@/hooks/useInstagramInstances';
import { supabase } from '@/integrations/supabase/client';
import { CompanyInstagramConnectionsSection } from '@/components/CompanyInstagramConnectionsSection';

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
  const { profile } = useUserProfile();
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

  // Para evitar o flickering do card de conversas durante o polling,
  // só mostramos o skeleton na primeira carga (quando ainda não há dados)
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

      // 1. Fetch Agendamentos
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

      // 2. Contagem global de mensagens: WhatsApp (tabela dinâmica legada) + Instagram (CRM unificado)
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
            const tableName = `imobipro_messages_${cleanPhone}`;
            const { count, error: mErr } = await supabase
              .from(tableName as any)
              .select('*', { count: 'exact', head: true });
            if (!mErr && count !== null) waCount = count;
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
    <div className="space-y-6 min-h-0 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Status da Conexão{' '}
            <span className="text-sm font-medium ml-2 px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded border border-green-500/20">
              API Oficial do WhatsApp
            </span>
          </h1>
          <p className="text-muted-foreground">
            Monitoramento das métricas e integridade da sua instância dedicada
          </p>
        </div>
      </div>

      <CompanyInstagramConnectionsSection />

      {/* Status Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-foreground font-medium text-lg">Online e Operante</h3>
                <span className="text-muted-foreground text-sm">Integração homologada</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Title */}
      <div className="flex items-center gap-2 pt-4">
        <h2 className="text-xl font-semibold text-foreground">Métricas de Performance da Equipe e IA</h2>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* Card 1: Conversas no Dia */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium text-sm">Conversas no Dia</h3>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-purple-500" />
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

        {/* Card 2: Mensagens Trocadas */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium text-sm">Mensagens Trocadas Global</h3>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
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
              WhatsApp (instância oficial) + Instagram (CRM), incluindo IA e corretores
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Agendamentos */}
        <Card className="bg-card border-border shadow-sm transition-transform duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium text-sm">Agendamentos Aprovados</h3>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-orange-500" />
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
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1" />
              Leads capturados com sucesso
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
