import { lazy, Suspense, useEffect, useState } from "react";
import { useSimpleNavigation, View } from "../hooks/useSimpleNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";
import AddImovelModal from "@/components/AddImovelModal";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";

// Lazy modules (code splitting)
const DashboardContent = lazy(() => import("@/components/DashboardContent").then(m => ({ default: m.DashboardContent })));
import ReportsView from "@/components/DashboardReports";
const ClientsView = lazy(() => import("@/components/ClientsView").then(m => ({ default: m.ClientsView })));
const ClientsCRMView = lazy(() => import("@/components/ClientsCRMView").then(m => ({ default: m.ClientsCRMView })));
const PermissionsManagementView = lazy(() => import("@/components/PermissionsManagementView").then(m => ({ default: m.PermissionsManagementView })));
const InquilinatoView = lazy(() => import("@/components/InquilinatoView").then(m => ({ default: m.InquilinatoView })));
const DisparadorView = lazy(() => import("@/components/DisparadorView").then(m => ({ default: m.DisparadorView })));

const UserProfileView = lazy(() => import("@/components/UserProfileView").then(m => ({ default: m.UserProfileView })));
const PlantaoView = lazy(() => import("@/components/PlantaoView"));
const ConnectionsViewSimplified = lazy(() => import("@/components/ConnectionsViewSimplified").then(m => ({ default: m.ConnectionsViewSimplified })));
const PropertyList = lazy(() => import("@/components/PropertyList").then(m => ({ default: m.PropertyList })));
const ContractsView = lazy(() => import("@/components/ContractsView").then(m => ({ default: m.ContractsView })));
const AgendaView = lazy(() => import("@/components/AgendaView").then(m => ({ default: m.AgendaView })));
const UserManagementView = lazy(() => import("@/components/UserManagementView").then(m => ({ default: m.UserManagementView })));

import { useImoveisVivaReal } from "@/hooks/useImoveisVivaReal";
import { useUserProfile } from "@/hooks/useUserProfile";

const Index = () => {
  const { currentView, changeView } = useSimpleNavigation();
  const { profile, loading: profileLoading } = useUserProfile();
  const { loading } = useImoveisVivaReal();
  
  console.log(`🚀 Index renderizado - currentView: ${currentView}`);
  
  // Redirecionamento inicial baseado na role do usuário (APENAS UMA VEZ)
  useEffect(() => {
    if (!profileLoading && profile) {
      const currentPath = window.location.pathname.replace(/^\//, "");
      
      // Só redirecionar se estiver na raiz
      if (!currentPath || currentPath === '') {
        const defaultView = profile.role === 'corretor' ? 'properties' : 'dashboard';
        changeView(defaultView as View, 'initial-redirect');
      }
    }
  }, [profile, profileLoading, changeView]); // Dependências mínimas

  // Event listeners globais (simplificados)
  useEffect(() => {
    const handler = (e: any) => {
      const target = e?.detail as View;
      if (target) {
        changeView(target, "app-navigate-event");
      }
    };
    window.addEventListener("app:navigate", handler as any);
    return () => window.removeEventListener("app:navigate", handler as any);
  }, [changeView]);

  const renderContent = () => {
    console.log(`🎬 Renderizando conteúdo para: ${currentView}`);
    
    switch (currentView) {
      case "dashboard":
        return (
          <DashboardContent
            properties={[]}
            loading={loading}
            onNavigateToAgenda={() => changeView("agenda", "dashboard-button")}
          />
        );
      case "reports":
        console.log("🔧 Tentando renderizar ReportsView");
        return <ReportsView />;
      case "properties":
        return <PropertyList properties={[]} loading={loading} onAddNew={() => window.dispatchEvent(new Event("open-add-imovel-modal"))} />;
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
        return <UserManagementView />;
      case "permissions":
        return <PermissionsManagementView />;
      case "inquilinato":
        return <InquilinatoView />;
      case "disparador":
        return <DisparadorView />;
      case "profile":
        return <UserProfileView />;
      default:
        return <DashboardContent properties={[]} loading={loading} onNavigateToAgenda={() => changeView("agenda", "default-fallback")} />;
    }
  };

  return (
    <SidebarProvider className="bg-gray-950">
      <div className="flex min-h-screen bg-gray-950 flex-1 min-w-0">
        <AppSidebar 
          currentView={currentView} 
          onViewChange={(view) => changeView(view, "sidebar-click")} 
        />
        <div className="flex-1 min-w-0">
          <DashboardHeader />
          <main className="p-6 overflow-x-hidden">
            <Suspense fallback={<div className="text-gray-300">Carregando módulo...</div>}>
              {renderContent()}
              {/* Monta o modal globalmente para responder ao onAddNew */}
              <AddImovelModalMount />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
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

  return <AddImovelModal open={open} onOpenChange={setOpen} />;
};
