import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AddLeadModal } from '@/components/AddLeadModal';
import { BulkAssignModal } from '@/components/BulkAssignModal';
import { LeadViewModal } from '@/components/LeadViewModal';
import { PipelineKpis } from '@/components/pipeline/PipelineKpis';
import type { KanbanLead } from '@/types/kanban';
import { ClientsCrmTopBar } from '@/components/clients-crm/ClientsCrmTopBar';
import { ClientsCrmToolbar } from '@/components/clients-crm/ClientsCrmToolbar';
import { ClientsCrmFilters } from '@/components/clients-crm/ClientsCrmFilters';
import { ClientsCrmTable } from '@/components/clients-crm/ClientsCrmTable';
import {
  buildCrmKpis,
  countByCrmTab,
  leadMatchesCrmTab,
  type CrmFilterTab,
} from '@/components/clients-crm/helpers';

const PAGE_SIZE = 10;

export function ClientsCRMView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<CrmFilterTab>('todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewLeadId, setViewLeadId] = useState<string | null>(null);
  const [leadToEdit, setLeadToEdit] = useState<KanbanLead | null>(null);
  const [selectedBrokers, setSelectedBrokers] = useState<Set<string>>(new Set());
  const [showBrokerFilter, setShowBrokerFilter] = useState(false);
  const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string; role: string }>>(
    [],
  );
  const brokerFilterRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const { leads, loading, fetchLeads, bulkAssignLeads } = useKanbanLeads();
  const { profile, getCompanyUsers } = useUserProfile();
  const canSeeAllBrokers = profile?.role === 'gestor' || profile?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    const loadBrokers = async () => {
      if (!canSeeAllBrokers) return;
      try {
        const users = await getCompanyUsers();
        if (cancelled) return;
        const onlyBrokers = (users || []).filter(
          (u: { role?: string }) => (u.role ?? 'corretor') === 'corretor',
        );
        setBrokers(
          onlyBrokers.map((u: { id: string; full_name?: string; role?: string }) => ({
            id: u.id,
            full_name: u.full_name || 'Sem nome',
            role: u.role || 'corretor',
          })),
        );
      } catch {
        /* silencioso */
      }
    };
    loadBrokers();
    return () => {
      cancelled = true;
    };
  }, [canSeeAllBrokers, getCompanyUsers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const root = document.querySelector('[data-broker-filter]');
      if (root && !root.contains(target)) {
        setShowBrokerFilter(false);
      }
    };
    if (showBrokerFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBrokerFilter]);

  const brokerFilteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (!canSeeAllBrokers || selectedBrokers.size === 0) return true;
      return (
        (lead.id_corretor_responsavel && selectedBrokers.has(lead.id_corretor_responsavel)) ||
        (selectedBrokers.has('unassigned') && !lead.id_corretor_responsavel)
      );
    });
  }, [leads, canSeeAllBrokers, selectedBrokers]);

  const tabCounts = useMemo(
    () => countByCrmTab(brokerFilteredLeads),
    [brokerFilteredLeads],
  );

  const filteredLeads = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return brokerFilteredLeads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.nome.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.telefone && lead.telefone.includes(searchTerm)) ||
        (lead.interesse && lead.interesse.toLowerCase().includes(q));
      return matchesSearch && leadMatchesCrmTab(lead, selectedTab);
    });
  }, [brokerFilteredLeads, searchTerm, selectedTab]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, selectedTab, selectedBrokers]);

  const kpis = useMemo(() => buildCrmKpis(brokerFilteredLeads), [brokerFilteredLeads]);

  const subtitle = useMemo(() => {
    const n = brokerFilteredLeads.length;
    return `Base de relacionamento · ${n} registro${n !== 1 ? 's' : ''}`;
  }, [brokerFilteredLeads.length]);

  const handleBrokerToggle = useCallback((brokerId: string) => {
    setSelectedBrokers((prev) => {
      const next = new Set(prev);
      if (next.has(brokerId)) next.delete(brokerId);
      else next.add(brokerId);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchLeads();
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeads]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAllPage = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const lead of paginatedLeads) {
          if (checked) next.add(lead.id);
          else next.delete(lead.id);
        }
        return next;
      });
    },
    [paginatedLeads],
  );

  const handleViewLead = useCallback((lead: KanbanLead) => {
    setViewLeadId(lead.id);
  }, []);

  const handleEditLead = useCallback((lead: KanbanLead) => {
    setLeadToEdit(lead);
    setShowEditModal(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[40vh] md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] w-full bg-[#F7F5F0] dark:bg-background flex items-center justify-center rounded-xl border border-border/60">
        <Users className="h-8 w-8 text-emerald-700 animate-pulse" />
        <p className="ml-3 text-muted-foreground">Carregando clientes...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col rounded-xl border border-border/60 overflow-x-hidden md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] md:overflow-hidden">
      <div className="relative z-10 flex flex-col w-full md:flex-1 md:min-h-0 md:overflow-hidden">
        <div className="border-b border-border/70 bg-[#F7F5F0]/80 dark:bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <ClientsCrmTopBar onRefresh={handleRefresh} refreshing={refreshing} />
            <div ref={brokerFilterRef}>
              <ClientsCrmToolbar
                subtitle={subtitle}
                canBulkAssign={canSeeAllBrokers}
                onBulkAssign={() => setShowBulkAssignModal(true)}
                availableBrokers={canSeeAllBrokers ? brokers : []}
                selectedBrokers={selectedBrokers}
                showBrokerFilter={showBrokerFilter}
                onToggleBrokerFilter={() => setShowBrokerFilter((s) => !s)}
                onBrokerToggle={handleBrokerToggle}
                onClearBrokers={() => setSelectedBrokers(new Set())}
                onNewClient={() => setShowAddModal(true)}
              />
            </div>
            <PipelineKpis items={kpis} />
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-4 overflow-x-hidden md:flex-1 md:min-h-0 md:overflow-y-auto md:overflow-x-hidden">
          <div className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm space-y-4">
            <ClientsCrmFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
              counts={tabCounts}
            />
            <ClientsCrmTable
              leads={paginatedLeads}
              filteredTotal={filteredLeads.length}
              brokers={brokers}
              profileId={profile?.id}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAllPage={handleToggleSelectAllPage}
              onView={handleViewLead}
              onEdit={handleEditLead}
              mode="tabela"
              isMobile={isMobile}
              page={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      <AddLeadModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      <AddLeadModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setLeadToEdit(null);
        }}
        leadToEdit={leadToEdit}
      />

      <BulkAssignModal
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        leads={leads}
        brokers={brokers}
        onBulkAssign={bulkAssignLeads}
      />

      <LeadViewModal
        isOpen={!!viewLeadId}
        onClose={() => setViewLeadId(null)}
        leadId={viewLeadId}
      />
    </div>
  );
}
