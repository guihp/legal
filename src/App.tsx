import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import { LoginPage } from "./components/LoginPage";
import { UserOnboarding } from "./components/UserOnboarding";
import { SessionRecovery } from "./components/SessionRecovery";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { GoogleCalendarCallbackPage } from "./components/GoogleCalendarCallbackPage";
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
import { useCustomDomain } from './hooks/useCustomDomain';

// Paginas Publicas
const SiteVitrine = lazy(() => import("@/pages/public/SiteVitrine"));
const PropertyLandingPage = lazy(() => import("@/pages/public/PropertyLandingPage"));
const SignupPage = lazy(() => import("@/pages/public/SignupPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));

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

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  const blockedSubdomains = ['www', 'app', 'admin', 'imobi'];
  const isIp = /^[0-9.]+$/.test(hostname);

  // Domínio raiz configurado (não deve ser interpretado como slug de empresa)
  const configuredSiteDomain = (import.meta as any)?.env?.VITE_PUBLIC_SITE_DOMAIN as string | undefined;
  const configuredAppUrl = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
  const configuredAppHost = (() => {
    try {
      return configuredAppUrl ? new URL(configuredAppUrl).hostname : undefined;
    } catch {
      return undefined;
    }
  })();

  const rootHost = (configuredSiteDomain || configuredAppHost || '').trim();
  const rootPartsCount = rootHost ? rootHost.split('.').length : 0;

  // Considera subdomínio de empresa apenas quando houver algo ANTES do domínio raiz.
  // Ex: jastelo.imobi.iafeoficial.com (4 partes) -> subdomainSlug=jastelo
  // Ex: imobi.iafeoficial.com (3 partes, domínio raiz) -> NÃO é subdomínio
  // Ex: jastelo.localhost (2 partes) -> subdomainSlug=jastelo
  const isLocalhostSubdomain = parts.length === 2 && parts[1] === 'localhost' && !blockedSubdomains.includes(parts[0]);
  const isCompanySubdomain =
    !isIp &&
    !!rootHost &&
    hostname.endsWith(rootHost) &&
    parts.length === rootPartsCount + 1 &&
    !blockedSubdomains.includes(parts[0]);

  const isSubdomain = isLocalhostSubdomain || isCompanySubdomain;
  const subdomainSlug = isSubdomain ? parts[0] : null;

  // Se for rota pública, não exige perfil nem acesso
  const isPublicRoute = location.pathname.startsWith('/s/') || location.pathname.startsWith('/imovel/') || location.pathname.startsWith('/cadastro/') || isSubdomain;
  
  if (isPublicRoute) {
    if (isSubdomain && subdomainSlug) {
      if (location.pathname.startsWith('/imovel/')) {
        return (
          <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Carregando...</div></div>}>
            <Routes>
              <Route path="/imovel/:slug" element={<PropertyLandingPage />} />
              <Route path="*" element={<SiteVitrine companySlug={subdomainSlug} />} />
            </Routes>
          </Suspense>
        );
      }
      
      return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Carregando...</div></div>}>
          <SiteVitrine companySlug={subdomainSlug} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Carregando...</div></div>}>
        <Routes>
          <Route path="/s/:companySlug" element={<SiteVitrine />} />
          <Route path="/imovel/:slug" element={<PropertyLandingPage />} />
          <Route path="/cadastro/:token" element={<SignupPage />} />
        </Routes>
      </Suspense>
    );
  }

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

  const mustChangePassword = false;

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
      <ImpersonationBanner />
      {accessStatus?.isGracePeriod && (
        <GracePeriodBanner accessStatus={accessStatus} />
      )}
      <Routes>
        <Route path="/s/:companySlug" element={<Suspense fallback={<div>Carregando...</div>}><SiteVitrine /></Suspense>} />
        <Route path="/imovel/:slug" element={<Suspense fallback={<div>Carregando...</div>}><PropertyLandingPage /></Suspense>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/google/callback" element={<GoogleCalendarCallbackPage />} />
        {/*
          Catchall único para todas as views internas do app. Antes havia uma
          <Route /> por view (/dashboard, /properties, /contracts, …) — como
          cada <Route> é um match distinto, o React Router desmontava e
          remontava o <Index /> a cada troca de página, refazendo lazy-loads
          e refetches dos hooks. Com um único catchall, a mesma instância
          de <Index /> permanece montada e apenas a URL muda; o
          useBasicNavigation já lê location.pathname para decidir a view.
        */}
        <Route path="*" element={<Index />} />
      </Routes>

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
  // Detecta custom domain ANTES de checar sessão — o site público white-label
  // deve responder mesmo sem usuário logado.
  const customDomain = useCustomDomain();
  const { session, loading } = useAuthManager();
  const [sessionError, setSessionError] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

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

  // Custom domain (white-label) — renderiza o site vitrine da empresa
  // correspondente, sem exigir login, sem catchall de /s/:slug.
  if (customDomain.isCustomDomain && customDomain.siteSlug) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense
          fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
              <div className="text-white">Carregando...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/imovel/:slug" element={<PropertyLandingPage />} />
            <Route path="*" element={<SiteVitrine companySlug={customDomain.siteSlug} />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  // Aguarda tanto o loading da sessão quanto o lookup do custom domain
  if (loading || customDomain.loading) {
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
    const isPublicRoute = window.location.pathname.startsWith('/s/') || window.location.pathname.startsWith('/imovel/') || window.location.pathname.startsWith('/cadastro/');
    if (window.location.pathname === '/landing' || isPublicRoute) {
      return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Carregando...</div></div>}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/s/:companySlug" element={<SiteVitrine />} />
              <Route path="/imovel/:slug" element={<PropertyLandingPage />} />
              <Route path="/cadastro/:token" element={<SignupPage />} />
              <Route path="*" element={<LoginPage onLoginSuccess={() => { }} />} />
            </Routes>
          </Suspense>
        </Router>
      );
    }
    return <LoginPage onLoginSuccess={() => { }} />;
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AppContent />
    </Router>
  );
}

export default App;
