import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { invokeEdge } from "@/integrations/supabase/invoke";
import { PlantaoTopBar } from "@/components/plantao/PlantaoTopBar";
import { PlantaoToolbar, type PlantaoTab } from "@/components/plantao/PlantaoToolbar";
import { PlantaoKpis } from "@/components/plantao/PlantaoKpis";
import { CalendarsTable } from "@/components/plantao/CalendarsTable";
import { EscalaPanel } from "@/components/plantao/EscalaPanel";
import {
  DIAS_SEMANA,
  type EscalaSlot,
  buildPlantaoKpis,
  buildPlantaoSubtitle,
  computeWeeklyStats,
  getCalendarSyncStatus,
} from "@/components/plantao/helpers";

const pad2 = (n: number) => String(n).padStart(2, '0');

// Normaliza tempo vindo do banco (ex.: '09:00:00') para 'HH:MM'
const toHHMM = (t: any): string => {
  if (!t || typeof t !== 'string') return '';
  const parts = t.split(':');
  if (parts.length >= 2) return `${pad2(parseInt(parts[0] || '0', 10))}:${pad2(parseInt(parts[1] || '0', 10))}`;
  return t;
};

// Ajusta minutos para 00 ou 30 para o seletor atual
const toHalfHour = (hhmm: string): string => {
  const [hStr, mStr] = (hhmm || '').split(':');
  const h = Math.min(23, Math.max(0, parseInt(hStr || '0', 10) || 0));
  const mRaw = Math.min(59, Math.max(0, parseInt(mStr || '0', 10) || 0));
  const m = mRaw < 30 ? 0 : 30;
  return `${pad2(h)}:${pad2(m)}`;
};

const PlantaoView = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [calendars, setCalendars] = useState<Array<{
    name: string;
    id: string;
    timeZone: string;
    accessRole: string;
    color: string;
    primary: string;
    defaultReminders?: string;
    conferenceAllowed?: string;
  }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<PlantaoTab>('calendarios');
  const [escalaSelectedCalendarId, setEscalaSelectedCalendarId] = useState<string>("");
  const [isAddAgendaOpen, setIsAddAgendaOpen] = useState(false);
  const [newAgendaName, setNewAgendaName] = useState("");
  const [addingAgenda, setAddingAgenda] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string>("");
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");
  const [deletingAgenda, setDeletingAgenda] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configCalendarId, setConfigCalendarId] = useState<string | null>(null);
  const [assignedUserLocal, setAssignedUserLocal] = useState<string>("");
  const [companyUsers, setCompanyUsers] = useState<{ id: string; full_name: string; email: string; role?: string }[]>([]);
  const { profile, isManager, getCompanyUsers } = useUserProfile();
  const [dirtyCalendars, setDirtyCalendars] = useState<Record<string, boolean>>({});
  const [savingCalendars, setSavingCalendars] = useState<Record<string, boolean>>({});
  const [escalas, setEscalas] = useState<Record<string, { calendarName: string; assignedUserId?: string; assignedUserName?: string; slots: EscalaSlot[] }>>({});

  const dias = [...DIAS_SEMANA];

  const puxarAgendas = async (mode: "auto" | "manual" = "manual") => {
    try {
      setLoading(true);
      setStatus(mode === "auto" ? "Sincronizando agendas automaticamente..." : "Buscando agendas...");

      // 1. Obter dados do usuário e empresa PRIMEIRO
      const { data: { user } } = await supabase.auth.getUser();
      let companyId = null;
      let userProfile = null; // Guardar perfil completo para uso posterior

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id, role')
          .eq('id', user.id)
          .single();
        userProfile = profile;
        companyId = profile?.company_id;
      }

      const { data: edgeData, error: edgeError } = await invokeEdge<any, any>("google-calendar-api", {
        body: { action: "list_calendars" },
      });
      if (edgeError) throw new Error(edgeError.message || "Falha ao carregar calendários Google");
      const list = Array.isArray(edgeData?.calendars) ? edgeData.calendars : [];

      const normalized = list.map((item: any) => ({
        name: item?.name ?? "Sem nome",
        id: item?.id ?? "",
        timeZone: item?.timeZone ?? "",
        accessRole: item?.accessRole ?? "",
        color: item?.color ?? "#6b7280",
        primary: item?.primary ? "Yes" : "No",
        _assigned_user_id: null,
      }));

      console.log(`✅ Encontrados ${normalized.length} calendários.`);

      let finalCalendars = normalized;

      // 3. Filtragem usando dados já obtidos
      // IMPORTANTE: O N8N já filtra por company_id, então todos os calendários retornados
      // já são da empresa correta. A filtragem aqui é apenas por role do usuário.
      if (user && userProfile?.company_id) {
        // Buscar agendas da empresa no banco (para casos onde precisamos verificar vínculos)
        const { data: companySchedules } = await supabase
          .from('oncall_schedules')
          .select('calendar_id, assigned_user_id')
          .eq('company_id', userProfile.company_id);

        if (userProfile.role === 'corretor') {
          // Corretor vê apenas os calendários onde está vinculado
          // Verificar se assigned_user_id vem do N8N (novo formato)
          const fromN8N = normalized.filter(c => c._assigned_user_id === user.id);
          
          // Também verificar no banco (para compatibilidade com calendários antigos)
          const myIds = companySchedules
            ?.filter(s => s.assigned_user_id === user.id)
            .map(s => s.calendar_id) || [];
          
          // Combinar ambos: calendários do N8N com assigned_user_id OU do banco
          finalCalendars = normalized.filter(c => 
            c._assigned_user_id === user.id || myIds.includes(c.id)
          );
          
          console.log(`🔐 Corretor: ${finalCalendars.length} calendários visíveis (${fromN8N.length} do N8N, ${myIds.length} do banco).`);
        } else {
          // Gestor/Admin vê TODOS os calendários que vêm do N8N
          // O N8N já filtra por company_id, então todos são da empresa correta
          finalCalendars = normalized;
          
          console.log(`🔐 Gestor/Admin: ${finalCalendars.length} calendários visíveis (todos da empresa via N8N).`);
        }
      }

      setCalendars(finalCalendars);
      setLastCount(finalCalendars.length);
      setLastUpdated(new Date());
      setStatus(
        finalCalendars.length > 0
          ? `Agendas sincronizadas com sucesso (${finalCalendars.length} calendários)`
          : "Nenhum calendário encontrado para sua empresa"
      );
    } catch (e: any) {
      setStatus(e?.message || "Falha ao puxar agendas");
    } finally {
      setLoading(false);
    }
  };

  // Disparar automaticamente quando a aba Calendários estiver ativa
  useEffect(() => {
    if (activeTab === 'calendarios') {
      puxarAgendas("auto");
    }
  }, [activeTab]);

  // Controlar aba baseado no perfil do usuário
  useEffect(() => {
    if (profile?.role === 'corretor' && activeTab !== 'escala') {
      console.log('🔄 PlantaoView: Forçando corretor para aba escala');
      setActiveTab('escala');
    } else if (profile?.role && profile.role !== 'corretor' && activeTab !== 'calendarios') {
      console.log('🔄 PlantaoView: Definindo aba calendários para gestor/admin');
      setActiveTab('calendarios');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reagir a mudança de role
  }, [profile?.role]);

  // Ações Calendários
  const handleAddAgenda = async () => {
    setIsAddAgendaOpen(true);
  };


  const submitAddAgenda = async () => {
    const name = newAgendaName.trim();
    if (!name) {
      toast.error('Informe o nome da agenda');
      return;
    }

    // Obter user e profile ANTES da chamada
    let currentUser = null;
    let currentProfile = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        currentProfile = profile;
      }
    } catch (err) {
      console.error("Erro ao buscar usuário:", err);
    }

    try {
      setAddingAgenda(true);
      const { data: createdData, error: createError } = await invokeEdge<any, any>("google-calendar-api", {
        body: { action: "create_calendar", name },
      });
      if (createError) throw new Error(createError.message || "Falha ao criar agenda");
      const createdId = createdData?.calendar?.id;

      // Se não retornou ID, tentar buscar na lista atualizada
      if (!createdId) {
        // Fallback: listar e encontrar pelo nome (assumindo único por enquanto)
        // Isso é arriscado mas necessário se o webhook não retornar ID
      }

      if (currentUser && createdId && currentProfile?.company_id) {
        await supabase.from('oncall_schedules').insert({
          calendar_id: createdId,
          calendar_name: name,
          company_id: currentProfile.company_id,
          user_id: currentUser.id
          // assigned_user_id opcional
        });
      } else if (currentUser && !createdId) {
        // Tentar estratégia de auto-claiming no próximo load
        toast.info("Agenda criada. Verifique se ela aparece na lista.");
      }

      toast.success('Agenda adicionada com sucesso');
      setIsAddAgendaOpen(false);
      setNewAgendaName("");
      // Recarregar lista
      await puxarAgendas('manual');
    } catch (e) {
      console.error(e);
      toast.error('Falha ao adicionar agenda');
    } finally {
      setAddingAgenda(false);
    }
  };

  const handleDeleteCalendar = (calendarId: string, calendarName?: string) => {
    setDeleteTargetId(calendarId);
    setDeleteTargetName(calendarName || "");
    setIsDeleteOpen(true);
  };

  const confirmDeleteCalendar = async () => {
    // Obter user e profile ANTES
    let currentUser = null;
    let currentProfile = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        currentProfile = profile;
      }
    } catch (err) {
      console.error("Erro ao buscar usuário para exclusão:", err);
    }

    try {
      setDeletingAgenda(true);

      const { error: deleteApiError } = await invokeEdge<any, any>("google-calendar-api", {
        body: { action: "delete_calendar", calendar_id: deleteTargetId },
      });
      if (deleteApiError) throw new Error(deleteApiError.message || "Falha ao remover agenda no Google");

      // 2. Depois, excluir o registro da tabela oncall_schedules
      try {
        if (!currentUser) throw new Error('Usuário não autenticado');

        const company_id = currentProfile?.company_id;
        if (!company_id) {
          console.warn('company_id não encontrado, mas continuando com a exclusão');
        }

        // Excluir registro da tabela oncall_schedules
        const { error: deleteError } = await supabase
          .from('oncall_schedules')
          .delete()
          .eq('calendar_id', deleteTargetId)
          .eq('company_id', company_id);

        if (deleteError) {
          console.error('Erro ao excluir da tabela oncall_schedules:', deleteError);
          // Não falhar a operação se a exclusão do banco falhar
        } else {
          console.log('Registro removido da tabela oncall_schedules com sucesso');
        }
      } catch (dbError) {
        console.error('Erro ao excluir do banco de dados:', dbError);
      }

      // 3. Limpar estado local
      const nextEscalas = { ...escalas };
      delete nextEscalas[deleteTargetId];
      persistEscalas(nextEscalas);

      toast.success('Agenda removida com sucesso');
      setIsDeleteOpen(false);
      setDeleteTargetId("");
      setDeleteTargetName("");

      // 4. Recarregar lista de agendas
      await puxarAgendas('manual');

    } catch (e) {
      console.error(e);
      toast.error('Falha ao remover agenda');
    } finally {
      setDeletingAgenda(false);
    }
  };

  const filteredCalendars = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return calendars.filter((c) => {
      return term === "" || c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term);
    });
  }, [calendars, searchTerm]);

  // Removido localStorage; manter apenas estado em memória e banco
  const persistEscalas = useCallback((data: typeof escalas) => {
    console.log('💾 persistEscalas: Tentando atualizar estado:', {
      dadosRecebidos: data,
      estadoAtual: escalas
    });

    setEscalas(prevEscalas => {
      // Só atualizar se houver mudanças reais
      const isEqual = JSON.stringify(prevEscalas) === JSON.stringify(data);
      console.log('🔍 persistEscalas: Comparação de estado:', {
        isEqual,
        prevCount: Object.keys(prevEscalas).length,
        newCount: Object.keys(data).length
      });

      if (isEqual) {
        console.log('⚡ persistEscalas: Estados iguais, mantendo anterior');
        return prevEscalas;
      }

      console.log('✅ persistEscalas: Estado atualizado!');
      return data;
    });
  }, []);

  const setDayWorking = (calendarId: string, dia: string, works: boolean) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = [...current.slots];
    const idx = nextSlots.findIndex(s => s.dia === dia);
    if (works) {
      if (idx === -1) {
        nextSlots.push({ dia, inicio: '09:00', fim: '18:00' });
      }
    } else {
      if (idx !== -1) {
        nextSlots.splice(idx, 1);
      }
    }
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    setDirtyCalendars(prev => ({ ...prev, [calendarId]: true }));
  };

  const setDayTime = (calendarId: string, dia: string, field: 'inicio' | 'fim', value: string) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = [...current.slots];
    const idx = nextSlots.findIndex(s => s.dia === dia);
    // util: validação de horários (inicio < fim)
    const toMinutes = (t: string) => {
      const [hh, mm] = (t || '00:00').split(':');
      const h = parseInt(hh || '0', 10);
      const m = parseInt(mm || '0', 10);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const currentInicio = idx === -1 ? '09:00' : nextSlots[idx].inicio;
    const currentFim = idx === -1 ? '18:00' : nextSlots[idx].fim;
    const candidateInicio = field === 'inicio' ? value : currentInicio;
    const candidateFim = field === 'fim' ? value : currentFim;

    if (toMinutes(candidateInicio) >= toMinutes(candidateFim)) {
      toast.error('Horário inválido: o início deve ser antes do fim.');
      return; // não persiste alteração inválida
    }

    if (idx === -1) {
      nextSlots.push({ dia, inicio: candidateInicio, fim: candidateFim });
    } else {
      nextSlots[idx] = { ...nextSlots[idx], inicio: candidateInicio, fim: candidateFim } as EscalaSlot;
    }
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    setDirtyCalendars(prev => ({ ...prev, [calendarId]: true }));
  };

  // (Removido) copiar/colar horários — simplificado conforme solicitação

  // (Removido) presets de dias e limpar tudo — a pedido do usuário

  const loadSchedule = async (calendarId: string, calendarName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar escala por calendar_id (mais genérico)
      const { data, error } = await supabase
        .from('oncall_schedules')
        .select(`
          *,
          assigned_user_profile:assigned_user_id(id, full_name, email)
        `)
        .eq('calendar_id', calendarId)
        .eq('company_id', profile?.company_id as any)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const assignedUserProfile = (data as any).assigned_user_profile;
        const assignedUserName = assignedUserProfile ?
          (assignedUserProfile.full_name || assignedUserProfile.email) : undefined;

        const slots = [
          (data as any).mon_works ? { dia: 'Segunda', inicio: toHalfHour(toHHMM((data as any).mon_start)), fim: toHalfHour(toHHMM((data as any).mon_end)) } : null,
          (data as any).tue_works ? { dia: 'Terça', inicio: toHalfHour(toHHMM((data as any).tue_start)), fim: toHalfHour(toHHMM((data as any).tue_end)) } : null,
          (data as any).wed_works ? { dia: 'Quarta', inicio: toHalfHour(toHHMM((data as any).wed_start)), fim: toHalfHour(toHHMM((data as any).wed_end)) } : null,
          (data as any).thu_works ? { dia: 'Quinta', inicio: toHalfHour(toHHMM((data as any).thu_start)), fim: toHalfHour(toHHMM((data as any).thu_end)) } : null,
          (data as any).fri_works ? { dia: 'Sexta', inicio: toHalfHour(toHHMM((data as any).fri_start)), fim: toHalfHour(toHHMM((data as any).fri_end)) } : null,
          (data as any).sat_works ? { dia: 'Sábado', inicio: toHalfHour(toHHMM((data as any).sat_start)), fim: toHalfHour(toHHMM((data as any).sat_end)) } : null,
          (data as any).sun_works ? { dia: 'Domingo', inicio: toHalfHour(toHHMM((data as any).sun_start)), fim: toHalfHour(toHHMM((data as any).sun_end)) } : null,
        ].filter(Boolean) as EscalaSlot[];

        persistEscalas({
          ...escalas,
          [calendarId]: {
            calendarName,
            assignedUserId: (data as any).assigned_user_id || undefined,
            assignedUserName,
            slots
          }
        });
      } else {
        persistEscalas({
          ...escalas,
          [calendarId]: {
            calendarName,
            assignedUserId: undefined,
            assignedUserName: undefined,
            slots: []
          }
        });
      }
    } catch (e) {
      console.error('Falha ao carregar escala:', e);
      persistEscalas({
        ...escalas,
        [calendarId]: {
          calendarName,
          assignedUserId: undefined,
          assignedUserName: undefined,
          slots: []
        }
      });
    }
  };

  // Carrega todas as escalas do usuário para os calendários atuais
  const loadAllSchedules = useCallback(async () => {
    try {
      console.log('🚀 loadAllSchedules INICIADO');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ loadAllSchedules: Usuário não autenticado');
        return;
      }
      if (!calendars || calendars.length === 0) {
        console.log('⚠️ loadAllSchedules: Nenhum calendário carregado');
        return;
      }
      if (!profile) {
        console.log('⚠️ loadAllSchedules: Profile não carregado');
        return;
      }

      console.log('👤 loadAllSchedules: Dados do usuário:', {
        userId: user.id,
        userRole: profile?.role,
        companyId: profile?.company_id,
        calendarsCount: calendars.length
      });

      const calendarIds = calendars.map(c => c.id);

      // Buscar escalas com JOIN para trazer o nome do corretor vinculado
      let query = supabase
        .from('oncall_schedules')
        .select(`
          *,
          assigned_user_profile:assigned_user_id(id, full_name, email)
        `);

      if (profile?.role === 'admin' || profile?.role === 'gestor') {
        console.log('📋 loadAllSchedules: Query para gestor/admin - filtrando por company_id:', profile.company_id);
        query = query.eq('company_id', profile.company_id);
      } else if (profile?.role === 'corretor') {
        console.log('👨‍💼 loadAllSchedules: Query para corretor - filtrando por assigned_user_id:', user.id);
        query = query.eq('assigned_user_id', user.id);
      } else {
        console.log('❓ loadAllSchedules: Role desconhecido, bloqueando acesso');
        query = query.eq('id', 'never-match');
      }

      const { data, error } = await query;

      console.log('📊 loadAllSchedules: Resultado da consulta:', {
        userRole: profile?.role,
        dataCount: data?.length || 0,
        data: data,
        error: error,
        escalasAntes: Object.keys(escalas).length
      });

      if (error) throw error;

      const next: typeof escalas = { ...escalas };

      // Inicializa todas as agendas conhecidas com slots vazios caso não haja registro
      for (const c of calendars) {
        if (!next[c.id]) {
          next[c.id] = {
            calendarName: c.name,
            assignedUserId: undefined,
            assignedUserName: undefined,
            slots: []
          };
        }
      }

      // Preenche com as escalas vindas do banco
      for (const row of (data || [])) {
        const calendarId = (row as any).calendar_id as string;
        const calendarName = calendars.find(x => x.id === calendarId)?.name || (row as any).calendar_name || 'Agenda Externa';
        const assignedUserProfile = (row as any).assigned_user_profile;
        const assignedUserName = assignedUserProfile ?
          (assignedUserProfile.full_name || assignedUserProfile.email) : undefined;

        console.log('📝 loadAllSchedules: Processando escala:', {
          calendarId,
          calendarName,
          assignedUserId: (row as any).assigned_user_id,
          assignedUserName,
          assignedUserProfile
        });

        const slots: EscalaSlot[] = [
          (row as any).mon_works ? { dia: 'Segunda', inicio: toHalfHour(toHHMM((row as any).mon_start)), fim: toHalfHour(toHHMM((row as any).mon_end)) } : null,
          (row as any).tue_works ? { dia: 'Terça', inicio: toHalfHour(toHHMM((row as any).tue_start)), fim: toHalfHour(toHHMM((row as any).tue_end)) } : null,
          (row as any).wed_works ? { dia: 'Quarta', inicio: toHalfHour(toHHMM((row as any).wed_start)), fim: toHalfHour(toHHMM((row as any).wed_end)) } : null,
          (row as any).thu_works ? { dia: 'Quinta', inicio: toHalfHour(toHHMM((row as any).thu_start)), fim: toHalfHour(toHHMM((row as any).thu_end)) } : null,
          (row as any).fri_works ? { dia: 'Sexta', inicio: toHalfHour(toHHMM((row as any).fri_start)), fim: toHalfHour(toHHMM((row as any).fri_end)) } : null,
          (row as any).sat_works ? { dia: 'Sábado', inicio: toHalfHour(toHHMM((row as any).sat_start)), fim: toHalfHour(toHHMM((row as any).sat_end)) } : null,
          (row as any).sun_works ? { dia: 'Domingo', inicio: toHalfHour(toHHMM((row as any).sun_start)), fim: toHalfHour(toHHMM((row as any).sun_end)) } : null,
        ].filter(Boolean) as EscalaSlot[];


        next[calendarId] = {
          calendarName,
          assignedUserId: (row as any).assigned_user_id || undefined,
          assignedUserName,
          slots,
        };
      }

      console.log('🔄 loadAllSchedules: Estado final antes de persistir:', {
        nextEscalas: next,
        totalCalendarios: Object.keys(next).length
      });

      persistEscalas(next);
    } catch (e) {
      console.error('Falha ao carregar escalas:', e);
    }
  }, [calendars, profile?.id, profile?.role]);

  const addCalendario = () => {
    if (!selectedCalendarId) return;
    const cal = calendars.find(c => c.id === selectedCalendarId);
    if (!cal) return;
    if (escalas[selectedCalendarId]) return;
    loadSchedule(selectedCalendarId, cal.name);
    setSelectedCalendarId("");
  };

  const addSlot = (calendarId: string) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = [...current.slots, { dia: 'Segunda', inicio: '09:00', fim: '18:00' }];
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    // salvar imediatamente no banco
    salvarCalendario(calendarId);
  };

  const updateSlot = (
    calendarId: string,
    index: number,
    field: keyof EscalaSlot,
    value: string
  ) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = current.slots.map((s, i) => i === index ? { ...s, [field]: value } : s);
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    salvarCalendario(calendarId);
  };

  const removeSlot = (calendarId: string, index: number) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = current.slots.filter((_, i) => i !== index);
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    salvarCalendario(calendarId);
  };

  const removeCalendario = (calendarId: string) => {
    const next = { ...escalas };
    delete next[calendarId];
    persistEscalas(next);
    // Limpar no banco (setar todos dias como não trabalha)
    const cfg = { calendarName: '', slots: [] } as { calendarName: string; slots: EscalaSlot[] };
    escalas[calendarId] = cfg;
    salvarCalendario(calendarId);
  };

  const salvarCalendario = (calendarId: string, assignedOverride?: string) => {
    // Persist já acontece a cada alteração local, aqui iremos consolidar e enviar ao Supabase
    const cfg = escalas[calendarId];
    if (!cfg) return;

    // Montar payload diário: dias ausentes vão como não trabalha
    const dayMap: Record<string, { works: boolean; start: string | null; end: string | null }> = {
      Segunda: { works: false, start: null, end: null },
      Terça: { works: false, start: null, end: null },
      Quarta: { works: false, start: null, end: null },
      Quinta: { works: false, start: null, end: null },
      Sexta: { works: false, start: null, end: null },
      Sábado: { works: false, start: null, end: null },
      Domingo: { works: false, start: null, end: null },
    };
    for (const slot of cfg.slots) {
      if (dayMap[slot.dia]) {
        dayMap[slot.dia] = { works: true, start: slot.inicio, end: slot.fim };
      }
    }
    // Chamada Supabase
    (async () => {
      try {
        setSavingCalendars(prev => ({ ...prev, [calendarId]: true }));
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');
        // Buscar company_id do perfil
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        const company_id = (profile as any)?.company_id || null;
        if (!company_id) {
          // fallback: permitir null em ambiente MVP
          console.warn('company_id não encontrado; gravando com company_id nulo (MVP)');
        }
        const effectiveAssigned = (assignedOverride ?? cfg.assignedUserId) || null;
        // CORREÇÃO: user_id deve ser sempre do usuário que está logado (quem criou/editou)
        // assigned_user_id é quem está vinculado à agenda
        const rowUserId = user.id;
        const payload = {
          calendar_id: calendarId,
          calendar_name: cfg.calendarName,
          user_id: rowUserId,
          company_id,
          assigned_user_id: effectiveAssigned,
          mon_works: dayMap['Segunda'].works, mon_start: dayMap['Segunda'].start, mon_end: dayMap['Segunda'].end,
          tue_works: dayMap['Terça'].works, tue_start: dayMap['Terça'].start, tue_end: dayMap['Terça'].end,
          wed_works: dayMap['Quarta'].works, wed_start: dayMap['Quarta'].start, wed_end: dayMap['Quarta'].end,
          thu_works: dayMap['Quinta'].works, thu_start: dayMap['Quinta'].start, thu_end: dayMap['Quinta'].end,
          fri_works: dayMap['Sexta'].works, fri_start: dayMap['Sexta'].start, fri_end: dayMap['Sexta'].end,
          sat_works: dayMap['Sábado'].works, sat_start: dayMap['Sábado'].start, sat_end: dayMap['Sábado'].end,
          sun_works: dayMap['Domingo'].works, sun_start: dayMap['Domingo'].start, sun_end: dayMap['Domingo'].end,
        } as any;

        // upsert usando unique constraint por empresa+calendário: (company_id, calendar_id)
        const { data: upsertData, error } = await supabase
          .from('oncall_schedules')
          .upsert(payload, {
            onConflict: 'company_id,calendar_id',
            ignoreDuplicates: false
          })
          .select();


        if (error) throw error;

        // Toast específico baseado no tipo de operação
        if (assignedOverride !== undefined) {
          if (assignedOverride === null) {
            toast.success('Vinculação removida da agenda');
          } else {
            const assignedUser = companyUsers.find(u => u.id === assignedOverride);
            const userType = assignedUser?.role === 'gestor' ? 'Gestor' : 'Corretor';
            toast.success(`${userType} vinculado à agenda com sucesso`);
          }
        } else if (cfg.slots.length > 0) {
          toast.success('Horários do plantão salvos com sucesso');
        } else {
          toast.success('Configuração da escala salva no banco');
        }

        setDirtyCalendars(prev => ({ ...prev, [calendarId]: false }));
        // Recarregar do banco para garantir consistência visual
        console.log('🔄 salvarCalendario: Recarregando escalas após salvar...');
        await loadAllSchedules();
        console.log('✅ salvarCalendario: Recarregamento concluído');
      } catch (e: any) {
        console.error('Erro ao salvar calendário:', e);
        toast.error(`Erro ao salvar: ${e.message || 'Falha ao comunicar com o banco de dados'}`);
      } finally {
        setSavingCalendars(prev => ({ ...prev, [calendarId]: false }));
      }
    })();
  };

  // Carregar CORRETORES e GESTORES da empresa para o seletor de vinculação de agenda
  useEffect(() => {
    const loadUsers = async () => {
      try {
        if (isManager) {
          const users = await getCompanyUsers();
          // Filtrar usuários com role 'corretor' ou 'gestor' (admin não pode ser vinculado)
          const availableUsers = users
            .filter(u => (u as any).role === 'corretor' || (u as any).role === 'gestor')
            .map(u => ({
              id: u.id,
              full_name: (u as any).full_name,
              email: (u as any).email,
              role: (u as any).role
            }));
          setCompanyUsers(availableUsers);
        } else if (profile && profile.role === 'corretor') {
          // Corretores só veem a si mesmos (não devem acessar o seletor mesmo)
          setCompanyUsers([{
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role
          }]);
        }
      } catch (e) {
        console.error('Falha ao carregar usuários da empresa:', e);
        toast.error('Erro ao carregar lista de usuários');
      }
    };

    // Só carregar se ainda não carregamos e temos perfil
    if (profile && companyUsers.length === 0) {
      loadUsers();
    }
  }, [isManager, profile?.id, profile?.role]);

  // Ao entrar na aba Escala, garantir carregamento das agendas e escalas do banco
  useEffect(() => {
    const ensureData = async () => {
      if (activeTab !== 'escala') return;
      if (!profile) return; // Aguardar profile carregar
      if (calendars.length === 0) {
        await puxarAgendas('auto');
      }
      await loadAllSchedules();
    };
    ensureData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile]);

  // Carregar escalas também na aba Calendários (KPIs + coluna Responsável)
  useEffect(() => {
    if (activeTab !== 'calendarios') return;
    if (!profile || calendars.length === 0) return;
    if (Object.keys(escalas).length > 0) return;
    void loadAllSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, calendars.length, profile?.id]);

  // Quando a lista de calendários mudar e a aba Escala estiver ativa, recarregar escalas
  useEffect(() => {
    if (activeTab === 'escala' && calendars.length > 0 && profile) {
      // Só recarregar se realmente precisamos
      const hasEscalas = Object.keys(escalas).length > 0;
      if (!hasEscalas) {
        loadAllSchedules();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars.length, profile?.id, activeTab]);

  const schedulesToShow = useMemo(() => {
    const allScheduleIds = new Set([
      ...calendars.map((c) => c.id),
      ...Object.keys(escalas),
    ]);

    return Array.from(allScheduleIds)
      .map((calendarId) => {
        const apiCalendar = calendars.find((c) => c.id === calendarId);
        const dbSchedule = escalas[calendarId];
        return {
          id: calendarId,
          name: apiCalendar?.name || dbSchedule?.calendarName || 'Agenda Externa',
        };
      })
      .filter((item) => {
        if (profile?.role === 'admin' || profile?.role === 'gestor') return true;
        if (profile?.role === 'corretor') {
          return escalas[item.id]?.assignedUserId === profile?.id;
        }
        return false;
      });
  }, [calendars, escalas, profile?.id, profile?.role]);

  useEffect(() => {
    if (schedulesToShow.length === 0) return;
    if (!escalaSelectedCalendarId || !schedulesToShow.some((s) => s.id === escalaSelectedCalendarId)) {
      setEscalaSelectedCalendarId(schedulesToShow[0].id);
      if (!escalas[schedulesToShow[0].id]) {
        void loadSchedule(schedulesToShow[0].id, schedulesToShow[0].name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulesToShow.map((s) => s.id).join('|')]);

  const handleSelectEscalaCalendar = (calendarId: string) => {
    setEscalaSelectedCalendarId(calendarId);
    const cal = schedulesToShow.find((s) => s.id === calendarId);
    if (cal && !escalas[calendarId]) {
      void loadSchedule(calendarId, cal.name);
    }
  };

  const totalBrokers = useMemo(
    () => companyUsers.filter((u) => u.role === 'corretor').length || companyUsers.length,
    [companyUsers],
  );

  const kpis = useMemo(() => {
    const syncedCount = calendars.filter((c) => getCalendarSyncStatus(c) === 'synced').length;
    const attentionCalendars = calendars.filter((c) => getCalendarSyncStatus(c) === 'token_expiring');
    const brokersOnScale = Object.values(escalas).filter(
      (e) => e.assignedUserId && e.slots.length > 0,
    ).length;

    let weeklyHours = 0;
    const daysSet = new Set<string>();
    for (const cfg of Object.values(escalas)) {
      const stats = computeWeeklyStats(cfg.slots);
      weeklyHours += stats.totalHours;
      cfg.slots.forEach((s) => daysSet.add(s.dia));
    }

    return buildPlantaoKpis({
      calendarCount: calendars.length,
      syncedCount,
      brokersOnScale,
      totalBrokers,
      weeklyHours,
      daysWithPlantao: daysSet.size,
      attentionCount: attentionCalendars.length,
      attentionHint:
        attentionCalendars.length > 0
          ? 'token do Google expirando'
          : 'tudo ok',
    });
  }, [calendars, escalas, totalBrokers]);

  const applyDefaultAll = (calendarId: string) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots: EscalaSlot[] = dias.map((d) => ({ dia: d, inicio: '09:00', fim: '18:00' }));
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    setDirtyCalendars((prev) => ({ ...prev, [calendarId]: true }));
  };

  const disableWeekend = (calendarId: string) => {
    const current = escalas[calendarId];
    if (!current) return;
    const nextSlots = current.slots.filter((s) => s.dia !== 'Sábado' && s.dia !== 'Domingo');
    persistEscalas({ ...escalas, [calendarId]: { ...current, slots: nextSlots } });
    setDirtyCalendars((prev) => ({ ...prev, [calendarId]: true }));
  };

  const copyEscalaFrom = (targetId: string, sourceId: string) => {
    const source = escalas[sourceId];
    const target = escalas[targetId];
    if (!source || !target) return;
    persistEscalas({
      ...escalas,
      [targetId]: {
        ...target,
        slots: source.slots.map((s) => ({ ...s })),
      },
    });
    setDirtyCalendars((prev) => ({ ...prev, [targetId]: true }));
    toast.success('Escala copiada — clique em Salvar escala para persistir');
  };

  const handleConfigureCalendar = (calendarId: string) => {
    setConfigCalendarId(calendarId);
    setAssignedUserLocal(escalas[calendarId]?.assignedUserId || '__remove__');
    setIsConfigOpen(true);
  };

  const handleSaveAssignment = () => {
    if (!configCalendarId) return;
    const effectiveUserId = assignedUserLocal === '__remove__' ? null : assignedUserLocal;
    const selectedUser = effectiveUserId ? companyUsers.find((u) => u.id === effectiveUserId) : null;
    const assignedUserName = selectedUser ? (selectedUser.full_name || selectedUser.email) : undefined;

    persistEscalas({
      ...escalas,
      [configCalendarId]: {
        ...escalas[configCalendarId],
        assignedUserId: effectiveUserId ?? undefined,
        assignedUserName,
      },
    });
    setDirtyCalendars((prev) => ({ ...prev, [configCalendarId]: true }));
    salvarCalendario(configCalendarId, effectiveUserId);
    setIsConfigOpen(false);
    setConfigCalendarId(null);
  };

  const selectedEscalaCfg = escalas[escalaSelectedCalendarId] || {
    calendarName: schedulesToShow.find((s) => s.id === escalaSelectedCalendarId)?.name || '',
    slots: [] as EscalaSlot[],
  };

  const canEditSelectedEscala =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    (profile?.role === 'corretor' && selectedEscalaCfg.assignedUserId === profile?.id);

  const handleRefresh = () => {
    if (activeTab === 'calendarios') {
      void puxarAgendas('manual');
    } else {
      void (async () => {
        if (calendars.length === 0) await puxarAgendas('auto');
        await loadAllSchedules();
      })();
    }
  };

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <PlantaoTopBar />
            <PlantaoToolbar
              subtitle={buildPlantaoSubtitle(lastUpdated)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isManager={isManager}
              loading={loading}
              canAddAgenda={isManager}
              onRefresh={handleRefresh}
              onAddAgenda={handleAddAgenda}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <PlantaoKpis items={kpis} />

        {activeTab === 'calendarios' && isManager ? (
          <CalendarsTable
            calendars={filteredCalendars}
            totalCount={calendars.length}
            loading={loading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            lastUpdated={lastUpdated}
            escalas={escalas}
            companyUsers={companyUsers}
            statusMessage={status}
            isManager={isManager}
            onCopyId={async (id) => {
              await navigator.clipboard.writeText(id);
              toast.success('Calendar ID copiado');
            }}
            onDelete={handleDeleteCalendar}
            onConfigure={handleConfigureCalendar}
          />
        ) : null}

        {activeTab === 'escala' ? (
          <EscalaPanel
            schedules={schedulesToShow}
            selectedCalendarId={escalaSelectedCalendarId}
            onSelectCalendar={handleSelectEscalaCalendar}
            cfg={selectedEscalaCfg}
            canEdit={!!canEditSelectedEscala}
            isDirty={!!dirtyCalendars[escalaSelectedCalendarId]}
            isSaving={!!savingCalendars[escalaSelectedCalendarId]}
            isManager={isManager}
            onOpenConfigure={() => handleConfigureCalendar(escalaSelectedCalendarId)}
            onToggleDay={(dia, works) => setDayWorking(escalaSelectedCalendarId, dia, works)}
            onSetDayTime={(dia, field, value) => setDayTime(escalaSelectedCalendarId, dia, field, value)}
            onSave={() => salvarCalendario(escalaSelectedCalendarId)}
            onCopyFrom={(sourceId) => copyEscalaFrom(escalaSelectedCalendarId, sourceId)}
            onApplyDefaultAll={() => applyDefaultAll(escalaSelectedCalendarId)}
            onDisableWeekend={() => disableWeekend(escalaSelectedCalendarId)}
          />
        ) : null}
      </div>

      <Dialog open={isAddAgendaOpen} onOpenChange={setIsAddAgendaOpen}>
        <DialogContent className="rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Adicionar nova agenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome da agenda</label>
              <Input
                value={newAgendaName}
                onChange={(e) => setNewAgendaName(e.target.value)}
                placeholder="Ex.: Corretor João"
                className="mt-1 rounded-xl bg-background border-border"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsAddAgendaOpen(false)} disabled={addingAgenda}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
                onClick={submitAddAgenda}
                disabled={addingAgenda}
              >
                {addingAgenda ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remover agenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja remover esta agenda?</p>
            {deleteTargetName ? (
              <p className="text-xs text-muted-foreground">
                Agenda: <span className="text-foreground">{deleteTargetName}</span>
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsDeleteOpen(false)} disabled={deletingAgenda}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={confirmDeleteCalendar}
                disabled={deletingAgenda}
              >
                {deletingAgenda ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConfigOpen && !!configCalendarId}
        onOpenChange={(open) => {
          setIsConfigOpen(open);
          if (!open) setConfigCalendarId(null);
        }}
      >
        <DialogContent className="rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Configurar responsável</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Vincular agenda ao usuário</label>
              <select
                value={assignedUserLocal}
                onChange={(e) => setAssignedUserLocal(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="__remove__">Remover vinculação</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.role === 'gestor' ? 'Gestor' : 'Corretor'})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setIsConfigOpen(false);
                  setConfigCalendarId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
                onClick={handleSaveAssignment}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default PlantaoView;