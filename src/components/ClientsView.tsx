import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useBasicNavigation } from '@/hooks/useBasicNavigation';
import { KanbanLead, LeadStage } from '@/types/kanban';
import { AddLeadModal } from '@/components/AddLeadModal';
import { LeadViewModal } from '@/components/LeadViewModal';
import { supabase } from '@/integrations/supabase/client';
import { PipelineTopBar } from '@/components/pipeline/PipelineTopBar';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineKpis, type PipelineKpi } from '@/components/pipeline/PipelineKpis';
import { PipelineColumn } from '@/components/pipeline/PipelineColumn';
import { PipelineDragPreview } from '@/components/pipeline/PipelineLeadCard';
import {
  PIPELINE_STAGES,
  daysBetween,
  formatCompactBRL,
  formatRelativePt,
  isOpenPipelineStage,
  normalizeStage,
  periodLabelPt,
  startOfMonth,
  sumLeadValues,
} from '@/components/pipeline/helpers';

export function ClientsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [defaultCreateStage, setDefaultCreateStage] = useState<LeadStage | null>(null);
  const [leadToEdit, setLeadToEdit] = useState<KanbanLead | null>(null);
  const [viewLeadId, setViewLeadId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const [availableBrokers, setAvailableBrokers] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<Set<string>>(new Set());
  const [showBrokerFilter, setShowBrokerFilter] = useState(false);

  const {
    leads,
    loading,
    error,
    updateLeadStage,
    fetchLeads,
  } = useKanbanLeads();

  const { profile } = useUserProfile();
  const { changeView } = useBasicNavigation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  );

  useEffect(() => {
    if (!loading && !error) setLastFetchedAt(new Date());
  }, [loading, error, leads.length]);

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('list_company_users', {
          target_company_id: profile?.company_id || null,
          search: null,
          roles: ['corretor'],
          limit_count: 100,
          offset_count: 0,
        });

        if (rpcError) throw rpcError;

        const activeBrokers = (data || []).filter(
          (user: { role?: string; is_active?: boolean }) =>
            user.role === 'corretor' && user.is_active === true,
        );
        setAvailableBrokers(activeBrokers);
      } catch (err) {
        console.error('Erro ao carregar corretores:', err);
        if (profile?.role === 'admin') {
          try {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('user_profiles')
              .select('id, full_name, role, is_active')
              .eq('role', 'corretor')
              .eq('is_active', true)
              .order('full_name');

            if (!fallbackError && fallbackData) {
              setAvailableBrokers(fallbackData);
            }
          } catch (fallbackErr) {
            console.error('Fallback admin falhou:', fallbackErr);
          }
        }
      }
    };

    if (profile && (profile.role === 'gestor' || profile.role === 'admin')) {
      fetchBrokers();
    } else if (profile) {
      setAvailableBrokers([]);
    }
  }, [profile]);

  const handleBrokerToggle = useCallback((brokerId: string) => {
    setSelectedBrokers((prev) => {
      const next = new Set(prev);
      if (next.has(brokerId)) next.delete(brokerId);
      else next.add(brokerId);
      return next;
    });
  }, []);

  const filteredLeads = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    return leads.filter((lead) => {
      if (!lead) return false;

      const matchesSearch =
        !searchLower ||
        (lead.nome || '').toLowerCase().includes(searchLower) ||
        (lead.email || '').toLowerCase().includes(searchLower) ||
        (lead.telefone || '').toLowerCase().includes(searchLower) ||
        (lead.interesse || '').toLowerCase().includes(searchLower) ||
        (lead.imovel_interesse || '').toLowerCase().includes(searchLower);

      const matchesBroker =
        selectedBrokers.size === 0 ||
        (lead.id_corretor_responsavel && selectedBrokers.has(lead.id_corretor_responsavel)) ||
        (!lead.id_corretor_responsavel && selectedBrokers.has('unassigned'));

      return matchesSearch && matchesBroker;
    });
  }, [leads, searchTerm, selectedBrokers]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, KanbanLead[]>();
    for (const stage of PIPELINE_STAGES) {
      map.set(stage.title, []);
    }
    for (const lead of filteredLeads) {
      const key = normalizeStage(lead.stage || '');
      for (const stage of PIPELINE_STAGES) {
        if (normalizeStage(stage.title) === key) {
          map.get(stage.title)!.push(lead);
          break;
        }
      }
    }
    return map;
  }, [filteredLeads]);

  const kpis = useMemo((): PipelineKpi[] => {
    const items: PipelineKpi[] = [];
    const openLeads = filteredLeads.filter((l) => isOpenPipelineStage(l.stage));
    const weekAgo = Date.now() - 7 * 86_400_000;
    const newLast7 = openLeads.filter((l) => {
      const t = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
      return !Number.isNaN(t) && t >= weekAgo;
    }).length;

    items.push({
      key: 'ativos',
      label: 'Leads ativos',
      value: String(openLeads.length),
      hint: newLast7 > 0 ? `+${newLast7} nos últimos 7 dias` : undefined,
      hintTone: newLast7 > 0 ? 'positive' : 'neutral',
      dot: 'bg-emerald-500',
    });

    const negociacao = filteredLeads.filter((l) => normalizeStage(l.stage) === 'em negociação');
    const negociacaoValue = sumLeadValues(negociacao);
    items.push({
      key: 'negociacao',
      label: 'Em negociação',
      value: String(negociacao.length),
      hint: negociacaoValue > 0 ? `${formatCompactBRL(negociacaoValue)} em jogo` : undefined,
      hintTone: 'neutral',
      dot: 'bg-amber-400',
    });

    const monthStart = startOfMonth().getTime();
    const fechamentosMes = filteredLeads.filter((l) => {
      if (normalizeStage(l.stage) !== 'fechamento') return false;
      const ts = l.updatedAt || l.createdAt;
      if (!ts) return true;
      const t = new Date(ts).getTime();
      return !Number.isNaN(t) && t >= monthStart;
    });
    items.push({
      key: 'fechamentos',
      label: 'Fechamentos (mês)',
      value: String(fechamentosMes.length),
      hint: undefined,
      hintTone: 'neutral',
      dot: 'bg-rose-500',
    });

    const pipelineValue = sumLeadValues(openLeads);
    if (pipelineValue > 0) {
      const ticket =
        openLeads.filter((l) => (l.valorEstimado || l.valor || 0) > 0).length > 0
          ? pipelineValue /
            openLeads.filter((l) => (l.valorEstimado || l.valor || 0) > 0).length
          : 0;
      items.push({
        key: 'valor',
        label: 'Valor do pipeline',
        value: formatCompactBRL(pipelineValue),
        hint: ticket > 0 ? `ticket médio ${formatCompactBRL(ticket)}` : undefined,
        hintTone: 'neutral',
        dot: 'bg-sky-500',
      });
    }

    const closedWithDates = filteredLeads.filter(
      (l) =>
        normalizeStage(l.stage) === 'fechamento' &&
        l.createdAt &&
        (l.updatedAt || l.createdAt),
    );
    const cycles = closedWithDates
      .map((l) => daysBetween(l.createdAt!, l.updatedAt || l.createdAt!))
      .filter((d): d is number => d != null && d >= 0);
    if (cycles.length > 0) {
      const avg = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
      items.push({
        key: 'ciclo',
        label: 'Ciclo médio',
        value: `${avg} d`,
        hint: `${cycles.length} fechamento${cycles.length > 1 ? 's' : ''}`,
        hintTone: 'neutral',
        dot: 'bg-violet-500',
      });
    }

    return items;
  }, [filteredLeads]);

  const subtitle = useMemo(() => {
    const parts = [`Funil comercial · ${periodLabelPt()}`];
    if (lastFetchedAt) {
      const rel = formatRelativePt(lastFetchedAt.toISOString());
      if (rel) parts.push(`atualizado ${rel}`);
    }
    return parts.join(' · ');
  }, [lastFetchedAt]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      isDraggingRef.current = false;

      if (!over) {
        setActiveId(null);
        return;
      }

      const draggedId = active.id as string;
      const overData = over.data.current;
      const activeLead = leads.find((lead) => lead.id === draggedId);

      if (!activeLead) {
        setActiveId(null);
        return;
      }

      let newStage = activeLead.stage;

      if (overData?.type === 'column') {
        newStage = overData.stage;
      } else if (overData?.type === 'lead') {
        newStage = overData.lead.stage;
      } else {
        const stage = PIPELINE_STAGES.find((s) => s.id === over.id);
        if (stage) newStage = stage.title;
      }

      if (newStage !== activeLead.stage) {
        const success = await updateLeadStage(draggedId, newStage as LeadStage);
        if (!success) console.error('Falha ao atualizar estágio do lead');
      }

      setActiveId(null);
    },
    [leads, updateLeadStage],
  );

  const activeLead = useMemo(
    () => (activeId ? leads.find((lead) => lead.id === activeId) ?? null : null),
    [activeId, leads],
  );

  useEffect(() => {
    const handleOpenView = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) setViewLeadId(id);
    };
    const handleOpenEdit = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const target = leads.find((l) => l.id === id);
      if (target) {
        setDefaultCreateStage(null);
        setLeadToEdit(target);
        setIsAddLeadModalOpen(true);
      }
    };
    window.addEventListener('openLeadView', handleOpenView);
    window.addEventListener('openLeadEdit', handleOpenEdit);
    return () => {
      window.removeEventListener('openLeadView', handleOpenView);
      window.removeEventListener('openLeadEdit', handleOpenEdit);
    };
  }, [leads]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-broker-filter]')) {
        setShowBrokerFilter(false);
      }
    };
    if (showBrokerFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBrokerFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchLeads();
      setLastFetchedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeads]);

  const openCreateLead = useCallback((stage?: LeadStage) => {
    setLeadToEdit(null);
    setDefaultCreateStage(stage || null);
    setIsAddLeadModalOpen(true);
  }, []);

  const handleEdgeScroll = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !hScrollRef.current) return;
    const container = hScrollRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edge = 80;
    const max = rect.width;
    let dx = 0;
    if (x < edge) dx = -Math.ceil((edge - x) / 10) * 10;
    else if (x > max - edge) dx = Math.ceil((x - (max - edge)) / 10) * 10;
    if (dx !== 0) container.scrollLeft += dx;
  }, []);

  if (loading) {
    return (
      <div className="min-h-[40vh] md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] w-full min-w-0 bg-background text-foreground flex items-center justify-center rounded-xl border border-border/60">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] w-full min-w-0 bg-background text-foreground flex items-center justify-center rounded-xl border border-border/60">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar leads: {error}</p>
          <Button onClick={handleRefresh}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col rounded-xl border border-border/60 overflow-x-hidden md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] md:overflow-hidden">
      <div className="relative z-10 flex flex-col w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden">
        <div className="border-b border-border/70 bg-[#F7F5F0]/80 dark:bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <PipelineTopBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />

            <PipelineToolbar
              subtitle={subtitle}
              view="kanban"
              onViewChange={(v) => {
                if (v === 'lista') changeView('clients-crm', 'pipeline-view-switch');
              }}
              availableBrokers={availableBrokers}
              selectedBrokers={selectedBrokers}
              showBrokerFilter={showBrokerFilter}
              onToggleBrokerFilter={() => setShowBrokerFilter((s) => !s)}
              onBrokerToggle={handleBrokerToggle}
              onClearBrokers={() => setSelectedBrokers(new Set())}
              onNewLead={() => openCreateLead()}
            />

            <PipelineKpis items={kpis} />
          </div>
        </div>

        {/* Mobile: page scrolls vertically; board keeps a usable height + horizontal swipe.
            Desktop: fill remaining viewport like before. */}
        <div className="p-3 sm:p-5 min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="relative min-w-0 w-full max-w-full rounded-xl border border-border/50 bg-transparent overflow-hidden h-[min(70vh,36rem)] md:h-full md:min-h-0">
              <div
                ref={hScrollRef}
                className="h-full min-h-0 min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/40"
                onMouseMove={handleEdgeScroll}
              >
                <div
                  className="flex gap-3.5 items-stretch h-full min-h-0 px-0.5 py-0.5"
                  style={{
                    minWidth: `${PIPELINE_STAGES.length * 294}px`,
                    width: 'max-content',
                  }}
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <PipelineColumn
                      key={stage.id}
                      stage={stage}
                      leads={leadsByStage.get(stage.title) ?? []}
                      availableBrokers={availableBrokers}
                      onAddLead={openCreateLead}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeLead ? <PipelineDragPreview lead={activeLead} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <AddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={() => {
          setIsAddLeadModalOpen(false);
          setLeadToEdit(null);
          setDefaultCreateStage(null);
        }}
        leadToEdit={leadToEdit}
        defaultStage={defaultCreateStage}
      />

      <LeadViewModal
        isOpen={!!viewLeadId}
        onClose={() => setViewLeadId(null)}
        leadId={viewLeadId}
      />
    </div>
  );
}
