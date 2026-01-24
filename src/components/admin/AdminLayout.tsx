import { useState } from 'react';
import {
  LayoutDashboard, Building2, History, Settings, LogOut,
  Shield, ChevronDown, Menu, X, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboard } from './AdminDashboard';
import { AdminCompanyList } from './AdminCompanyList';
import { AdminCompanyCreate } from './AdminCompanyCreate';
import { AdminCompanyDetailsView } from './AdminCompanyDetails';
import { AdminAccessLogs } from './AdminAccessLogs';
import { AdminImpersonation } from './AdminImpersonation';
import { AdminCompany } from '@/hooks/useAdminCompanies';

type AdminView = 'dashboard' | 'companies' | 'create-company' | 'company-details' | 'logs' | 'impersonation' | 'settings';

interface AdminLayoutProps {
  userName?: string;
  userEmail?: string;
}

export function AdminLayout({ userName, userEmail }: AdminLayoutProps) {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const menuItems = [
    { id: 'dashboard' as AdminView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'companies' as AdminView, label: 'Empresas', icon: Building2 },
    { id: 'impersonation' as AdminView, label: 'Acessar Contas', icon: Users },
    { id: 'logs' as AdminView, label: 'Logs de Acesso', icon: History },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'companies':
        return (
          <AdminCompanyList
            onCreateCompany={() => setCurrentView('create-company')}
            onViewDetails={(company: AdminCompany) => {
              setSelectedCompanyId(company.id);
              setCurrentView('company-details');
            }}
          />
        );
      case 'create-company':
        return (
          <AdminCompanyCreate
            onBack={() => setCurrentView('companies')}
            onSuccess={(companyId) => {
              setSelectedCompanyId(companyId);
              setCurrentView('company-details');
            }}
          />
        );
      case 'company-details':
        return selectedCompanyId ? (
          <AdminCompanyDetailsView
            companyId={selectedCompanyId}
            onBack={() => {
              setSelectedCompanyId(null);
              setCurrentView('companies');
            }}
          />
        ) : null;
      case 'logs':
        return <AdminAccessLogs />;
      case 'impersonation':
        return <AdminImpersonation />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-64' : 'w-0 -ml-64'} 
          transition-all duration-300 ease-in-out
          bg-gray-900/80 backdrop-blur-sm border-r border-gray-800 flex flex-col
          fixed lg:static h-full z-50
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">IAFÉ IMOBI</h1>
              <p className="text-xs text-red-400">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${currentView === item.id
                  ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <span className="text-white font-medium">
                  {userName?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {userName || 'Super Admin'}
                </p>
                <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-gray-700 text-red-400 hover:text-red-300 hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="hidden lg:block">
            <h2 className="text-lg font-medium text-white">
              {menuItems.find(item => item.id === currentView)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Painel Administrativo Global
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default AdminLayout;
