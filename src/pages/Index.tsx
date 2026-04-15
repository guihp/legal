import { lazy, Suspense, useEffect, useState } from "react";
import { useBasicNavigation, View } from "../hooks/useBasicNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";
import { AddImovelModal } from "@/components/AddImovelModal";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";

// Função helper para lazy loading com tratamento de erro
const createLazyComponent = (importFn: () => Promise<any>, componentName: string) => {
  return lazy(() =>
    importFn()
      .then(m => {
        console.log(`🔧 LazyLoad: ${componentName} carregado com sucesso`);
        return m;
      })
      .catch(error => {
        console.error(`🔧 LazyLoad: Erro ao carregar ${componentName}:`, error);
        // Retornar um componente de fallback em caso de erro
        return {
          default: () => (
            <div className="text-center p-8">
              <div className="text-red-400 mb-2">Erro ao carregar módulo</div>
              <div className="text-gray-400 text-sm">{componentName}</div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Recarregar
              </button>
            </div>
          )
        };
      })
  );
};

// Lazy modules (code splitting) com tratamento de erro robusto
const DashboardContent = createLazyComponent(
  () => import("@/components/DashboardContent").then(m => ({ default: m.DashboardContent })),
  "DashboardContent"
);
const ReportsView = createLazyComponent(
  () => import("@/components/ReportsView").then(m => ({ default: m.default })),
  "ReportsView"
);
const ClientsView = createLazyComponent(
  () => import("@/components/ClientsView").then(m => ({ default: m.ClientsView })),
  "ClientsView"
);
const ClientsCRMView = createLazyComponent(
  () => import("@/components/ClientsCRMView").then(m => ({ default: m.ClientsCRMView })),
  "ClientsCRMView"
);
const PermissionsManagementView = createLazyComponent(
  () => import("@/components/PermissionsManagementView").then(m => ({ default: m.PermissionsManagementView })),
  "PermissionsManagementView"
);
const InquilinatoView = createLazyComponent(
  () => import("@/components/InquilinatoView").then(m => ({ default: m.InquilinatoView })),
  "InquilinatoView"
);
const DisparadorView = createLazyComponent(
  () => import("@/components/DisparadorView").then(m => ({ default: m.DisparadorView })),
  "DisparadorView"
);

const UserProfileView = createLazyComponent(
  () => import("@/components/UserProfileView").then(m => ({ default: m.UserProfileView })),
  "UserProfileView"
);
const PlantaoView = createLazyComponent(
  () => import("@/components/PlantaoView"),
  "PlantaoView"
);
const ConnectionsViewSimplified = createLazyComponent(
  () => import("@/components/ConnectionsViewSimplified").then(m => ({ default: m.ConnectionsViewSimplified })),
  "ConnectionsViewSimplified"
);
const PropertyList = createLazyComponent(
  () => import("@/components/PropertyList").then(m => ({ default: m.PropertyList })),
  "PropertyList"
);
const ContractsView = createLazyComponent(
  () => import("@/components/ContractsView").then(m => ({ default: m.ContractsView })),
  "ContractsView"
);
const AgendaView = createLazyComponent(
  () => import("@/components/AgendaView").then(m => ({ default: m.AgendaView })),
  "AgendaView"
);
const UserManagementView = createLazyComponent(
  () => import("@/components/UserManagementView").then(m => ({ default: m.UserManagementView })),
  "UserManagementView"
);
const ConfigurationsView = createLazyComponent(
  () => import("@/components/ConfigurationsViewSimple").then(m => ({ default: m.ConfigurationsViewSimple })),
  "ConfigurationsView"
);
const ConversasView = createLazyComponent(
  () => import("@/components/ConversasViewPremium").then(m => ({ default: m.ConversasViewPremium })),
  "ConversasView"
);
const LandingPage = createLazyComponent(
  () => import("@/pages/LandingPage").then(m => ({ default: m.default })),
  "LandingPage"
);
const MarketingView = createLazyComponent(
  () => import("@/components/MarketingView").then(m => ({ default: m.MarketingView })),
  "MarketingView"
);
const MarketingLandingPagesView = createLazyComponent(
  () => import("@/components/MarketingLandingPagesView").then(m => ({ default: m.MarketingLandingPagesView })),
  "MarketingLandingPagesView"
);
const PartnershipsView = createLazyComponent(
  () => import("@/components/PartnershipsView").then(m => ({ default: m.PartnershipsView })),
  "PartnershipsView"
);
const N8nLeadsApiView = createLazyComponent(
  () => import("@/components/N8nLeadsApiView").then(m => ({ default: m.N8nLeadsApiView })),
  "N8nLeadsApiView"
);

import { useImoveisVivaReal } from "@/hooks/useImoveisVivaReal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePermissions } from "@/hooks/usePermissions";
import { PreviewProvider } from "@/contexts/PreviewContext";
import { useOwnCompany } from "@/hooks/useOwnCompany";

const Index = () => {
  const { currentView, changeView } = useBasicNavigation();
  const { hasPermission } = usePermissions();
  const { company } = useOwnCompany();
  const companyPlanRaw = String(company?.plan || 'essential').toLowerCase();
  const normalizePlan = (plan: string): 'essential' | 'growth' | 'professional' => {
    // Compatibilidade com legado: "basic" e "enterprise" convergem para os planos atuais
    if (plan === 'basic' || plan === 'basico' || plan === 'essentials') return 'essential';
    if (plan === 'pro' || plan === 'enterprise' || plan === 'profissional') return 'professional';
    if (plan === 'growth') return 'growth';
    if (plan === 'professional') return 'professional';
    return 'essential';
  };
  const companyPlan = normalizePlan(companyPlanRaw);
  const planTier: Record<typeof companyPlan, number> = {
    essential: 1,
    growth: 2,
    professional: 3,
  };

  const PlanBlockedScreen = ({ feature, requiredPlan }: { feature: string; requiredPlan: string }) => (
    <div className="p-8 text-center">
      <div className="text-amber-400 mb-4 text-lg font-semibold">🔒 Recurso Indisponível</div>
      <p className="text-gray-400 text-sm mb-2">
        O módulo <strong>{feature}</strong> não está disponível no seu plano atual.
      </p>
      <p className="text-gray-500 text-xs">
        Faça upgrade para o plano <strong>{requiredPlan}</strong> para desbloquear este recurso.
      </p>
    </div>
  );

  //

  const renderContent = () => {
    //

    switch (currentView) {
      case "dashboard":
        return (
          <DashboardContent
            properties={[]}
            loading={false}
            onNavigateToAgenda={() => changeView("agenda", "dashboard-button")}
          />
        );
      case "reports":
        if (planTier[companyPlan] < 2) {
          return <PlanBlockedScreen feature="Relatórios" requiredPlan="Growth ou Professional" />;
        }
        return <ReportsView />;
      case "properties":
        return <PropertyList properties={[]} loading={false} onAddNew={() => window.dispatchEvent(new Event("open-add-imovel-modal"))} />;
      case "contracts":
        return <ContractsView />;
      case "agenda":
        return <AgendaView />;
      case "plantao":
        return <PlantaoView />;
      case "clients":
        return <ClientsView />;
      case "clients-crm":
        return <ClientsCRMView />;
      case "connections":
        return <ConnectionsViewSimplified />;
      case "users":
        // Plano Essential não tem gestão de usuários
        if (planTier[companyPlan] < 2) {
          return <PlanBlockedScreen feature="Gestão de Usuários" requiredPlan="Growth ou Professional" />;
        }
        // Verificar permissão de acesso ao módulo de Usuários
        if (!hasPermission('menu_users')) {
          console.log('🚫 Acesso negado ao módulo de Usuários');
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <div className="text-gray-400 text-sm">
                Você não tem permissão para acessar o módulo de Gestão de Usuários.
              </div>
              <div className="text-gray-400 text-sm mt-2">
                Entre em contato com seu administrador para solicitar acesso.
              </div>
            </div>
          );
        }

        return <UserManagementView />;
      case "permissions":
        // Verificar permissão de acesso ao módulo de Permissões usando a função específica
        if (!hasPermission('menu_permissions')) {
          console.log('🚫 Acesso negado ao módulo de Permissões');
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <div className="text-gray-400 text-sm">
                Você não tem permissão para acessar o módulo de Configuração de Permissões.
              </div>
              <div className="text-gray-400 text-sm mt-2">
                Apenas administradores e gestores podem configurar permissões.
              </div>
            </div>
          );
        }

        return <PermissionsManagementView />;
      case "inquilinato":
        return <InquilinatoView />;
      case "disparador":
        return <DisparadorView />;
      case "conversas":
        return <ConversasView />;
      case "marketing":
        if (planTier[companyPlan] < 3) {
          return <PlanBlockedScreen feature="Presença Digital" requiredPlan="Professional" />;
        }
        if (!hasPermission('menu_marketing')) {
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <p className="text-gray-400 text-sm">Você não tem permissão para o módulo Presença digital.</p>
            </div>
          );
        }
        return <MarketingView section="overview" />;
      case "marketing-site":
        if (planTier[companyPlan] < 3) {
          return <PlanBlockedScreen feature="Site Vitrine" requiredPlan="Professional" />;
        }
        if (!hasPermission('menu_marketing')) {
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <p className="text-gray-400 text-sm">Você não tem permissão para o módulo Presença digital.</p>
            </div>
          );
        }
        return <MarketingView section="website" />;
      case "marketing-lps":
        if (planTier[companyPlan] < 3) {
          return <PlanBlockedScreen feature="Landing Pages" requiredPlan="Professional" />;
        }
        if (!hasPermission('menu_marketing')) {
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <p className="text-gray-400 text-sm">Você não tem permissão para o módulo Presença digital.</p>
            </div>
          );
        }
        return <MarketingLandingPagesView />;
      case "partnerships":
        return <PartnershipsView />;
      case "n8n-leads-api":
        return <N8nLeadsApiView />;
      case "landing" as any: // Cast para evitar erro de tipo estrito se 'landing' não estiver em basicNavigation
        return <LandingPage />;
      case "configurations":
        console.log('🔧 Renderizando ConfigurationsView...');

        // Verificar permissão de acesso ao módulo Configurações
        if (!hasPermission('menu_configurations')) {
          console.log('🚫 Acesso negado ao módulo Configurações');
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Acesso Negado</div>
              <div className="text-gray-400 text-sm">
                Você não tem permissão para acessar o módulo de Configurações.
              </div>
              <div className="text-gray-400 text-sm mt-2">
                Entre em contato com seu administrador para solicitar acesso.
              </div>
            </div>
          );
        }

        try {
          return <ConfigurationsView />;
        } catch (error) {
          console.error('❌ Erro ao renderizar ConfigurationsView:', error);
          return (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-4">Erro ao carregar Configurações</div>
              <div className="text-gray-400 text-sm">{String(error)}</div>
            </div>
          );
        }
      case "profile":
        return <UserProfileView />;
      default:
        return <DashboardContent properties={[]} loading={false} onNavigateToAgenda={() => changeView("agenda", "default-fallback")} />;
    }
  };

  return (
    <PreviewProvider>
      <SidebarProvider className="bg-background">
        <div className="flex min-h-screen bg-background text-foreground flex-1 min-w-0">
          <AppSidebar
            currentView={currentView}
            onViewChange={(view) => changeView(view, "sidebar-click")}
          />
          <div className="flex-1 min-w-0">
            <DashboardHeader />
            <main className="p-6 overflow-x-hidden overflow-y-visible">
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <div className="text-muted-foreground">Carregando módulo...</div>
                  </div>
                </div>
              }>
                {renderContent()}
                {/* Monta o modal globalmente para responder ao onAddNew */}
                <AddImovelModalMount />
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PreviewProvider>
  );
};

export default Index;

// Montagem do modal de Adicionar Imóvel escutando evento global disparado pelo PropertyList
const AddImovelModalMount: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-add-imovel-modal", handler);
    return () => window.removeEventListener("open-add-imovel-modal", handler);
  }, []);

  return <AddImovelModal isOpen={open} onClose={() => setOpen(false)} />;
};
