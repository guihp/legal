import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { LoginPage } from "./components/LoginPage";
import { UserOnboarding } from "./components/UserOnboarding";
import { SessionRecovery } from "./components/SessionRecovery";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ContractTemplatesProvider } from "./contexts/ContractTemplatesContext";
import { supabase } from './integrations/supabase/client';
import { useUserProfile } from './hooks/useUserProfile';
import { useAuthAudit } from './hooks/useAuthAudit';
import { useAuthManager } from './hooks/useAuthManager';
import { useCompanyAccess } from './hooks/useCompanyAccess';
import { BlockedAccessScreen, GracePeriodBanner } from './components/shared/SubscriptionAlert';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { Toaster } from './components/ui/sonner';

function AppContent() {
  const { profile, loading: profileLoading, error: profileError } = useUserProfile();
  const { accessStatus, loading: accessLoading } = useCompanyAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  // Hook para auditoria de autenticação
  useAuthAudit();

  if (profileLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">Carregando perfil...</div>
      </div>
    );
  }

  // Se há erro no perfil, mostrar erro
  if (profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Erro ao carregar perfil</div>
          <div className="text-gray-400">{profileError}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Se não tem perfil, mostrar onboarding
  if (!profile) {
    return <UserOnboarding onComplete={() => { /* evita reload global em dev */ }} />;
  }

  // Se é super_admin, mostrar layout administrativo
  if (profile.role === 'super_admin') {
    return (
      <AdminLayout
        userName={profile.full_name}
        userEmail={profile.email}
      />
    );
  }

  // Verificar acesso da empresa (exceto super_admin)
  if (accessStatus && !accessStatus.canAccess) {
    return (
      <BlockedAccessScreen
        accessStatus={accessStatus}
        onLogout={async () => { await supabase.auth.signOut(); }}
      />
    );
  }

  const mustChangePassword = false; // revertido: sem fluxo obrigatório de troca de senha

  const handleChangePassword = async () => {
    try {
      setChanging(true);
      setChangeError(null);
      if (!newPassword || newPassword.length < 6) {
        setChangeError('A nova senha deve ter pelo menos 6 caracteres');
        setChanging(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setChangeError('A confirmação de senha não confere');
        setChanging(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Marcar como alterada
      // revertido: sem marcação no perfil
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setChangeError(err.message || 'Erro ao alterar senha');
    } finally {
      setChanging(false);
    }
  };

  return (
    <ContractTemplatesProvider>
      {/* Banner de impersonação (super_admin acessando como outro usuário) */}
      <ImpersonationBanner />

      {/* Banner de período de carência */}
      {accessStatus?.isGracePeriod && (
        <GracePeriodBanner accessStatus={accessStatus} />
      )}
      {/* Persistência de rota atual */}
      {null}
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Index />} />
        {/* Rotas reais por módulo */}
        <Route path="/dashboard" element={<Index />} />
        <Route path="/properties" element={<Index />} />
        <Route path="/contracts" element={<Index />} />
        <Route path="/agenda" element={<Index />} />
        <Route path="/plantao" element={<Index />} />
        <Route path="/reports" element={<Index />} />
        <Route path="/clients" element={<Index />} />
        <Route path="/clients-crm" element={<Index />} />
        <Route path="/connections" element={<Index />} />
        <Route path="/users" element={<Index />} />
        <Route path="/permissions" element={<Index />} />
        <Route path="/inquilinato" element={<Index />} />
        <Route path="/disparador" element={<Index />} />
        <Route path="/conversas" element={<Index />} />
        <Route path="/configurations" element={<Index />} />
        <Route path="/profile" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Modal obrigatório de troca de senha */}
      <Dialog open={mustChangePassword} onOpenChange={() => { }}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Troca de senha necessária</DialogTitle>
            <DialogDescription className="text-gray-400">Defina uma nova senha para continuar usando o sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (mínimo 6 caracteres)"
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
            />
            {changeError && <div className="text-sm text-red-400">{changeError}</div>}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleChangePassword}
                disabled={changing}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {changing ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </ContractTemplatesProvider>
  );
}

function App() {
  const { session, loading } = useAuthManager();
  const [sessionError, setSessionError] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  // Detectar problemas de sessão e mostrar recuperação
  useEffect(() => {
    if (sessionError && !showRecovery) {
      setShowRecovery(true);
    }
  }, [sessionError, showRecovery]);

  const handleRecoverySuccess = () => {
    setShowRecovery(false);
    setSessionError(false);
  };

  const handleRecoveryFailed = () => {
    setShowRecovery(false);
    setSessionError(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (showRecovery) {
    return (
      <SessionRecovery
        onRecoverySuccess={handleRecoverySuccess}
        onRecoveryFailed={handleRecoveryFailed}
      />
    );
  }

  if (!session) {
    // Permitir acesso à Landing Page mesmo sem sessão
    if (window.location.pathname === '/landing') {
      const LandingPage = lazy(() => import("@/pages/LandingPage"));
      return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/landing" element={
              <Suspense fallback={<div className="min-h-screen bg-black" />}>
                <LandingPage />
              </Suspense>
            } />
            <Route path="*" element={<LoginPage onLoginSuccess={() => { }} />} />
          </Routes>
        </Router>
      );
    }
    return <LoginPage onLoginSuccess={() => { /* evita reload global em dev */ }} />;
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      {/* REMOVIDO PersistRoute temporariamente para testar se está causando conflito */}
      <AppContent />
    </Router>
  );
}

export default App;

// REMOVIDO: Componente PersistRoute que estava causando problemas de recarregamento
// O componente tinha múltiplos listeners de eventos que conflitavam com a API de visibilidade
// e causavam loops de renderização quando a janela era minimizada ou a aba era trocada
