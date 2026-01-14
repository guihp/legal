import { useState } from 'react';
import { Shield, LogOut, User, Building2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/hooks/useImpersonation';

export function ImpersonationBanner() {
  const { activeSession, isImpersonating, loading, endImpersonation } = useImpersonation();
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    setEnding(true);
    await endImpersonation();
    setEnding(false);
  };

  if (loading || !isImpersonating || !activeSession) {
    return null;
  }

  const startTime = new Date(activeSession.started_at);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-600 to-amber-500 text-white px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">Modo Administrador</span>
          </div>
          
          <div className="h-4 w-px bg-amber-400/50" />
          
          <div className="flex items-center gap-2 text-amber-100">
            <User className="h-4 w-4" />
            <span>Logado como: <strong>{activeSession.impersonated_email}</strong></span>
          </div>
          
          {activeSession.impersonated_company_id && (
            <>
              <div className="h-4 w-px bg-amber-400/50" />
              <div className="flex items-center gap-2 text-amber-100">
                <Building2 className="h-4 w-4" />
                <span>Empresa vinculada</span>
              </div>
            </>
          )}
          
          <div className="h-4 w-px bg-amber-400/50" />
          
          <div className="flex items-center gap-2 text-amber-100 text-sm">
            <Clock className="h-4 w-4" />
            <span>{minutes} min</span>
          </div>
        </div>
        
        <Button
          onClick={handleEnd}
          disabled={ending}
          size="sm"
          variant="secondary"
          className="bg-white/20 hover:bg-white/30 text-white border-0"
        >
          {ending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Encerrando...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Voltar ao Painel Admin
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
