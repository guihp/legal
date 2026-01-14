import { AlertTriangle, Clock, XCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CompanyAccessStatus } from '@/hooks/useCompanyAccess';

interface SubscriptionAlertProps {
  accessStatus: CompanyAccessStatus;
  onContactSupport?: () => void;
}

export function SubscriptionAlert({ accessStatus, onContactSupport }: SubscriptionAlertProps) {
  // Não mostrar alerta se tudo está OK ou se é super_admin
  if (accessStatus.isSuperAdmin) return null;
  if (accessStatus.status === 'active' && !accessStatus.isGracePeriod) return null;

  const getAlertVariant = () => {
    if (!accessStatus.canAccess) return 'destructive';
    if (accessStatus.isGracePeriod) return 'destructive';
    if (accessStatus.status === 'trial') return 'default';
    return 'default';
  };

  const getIcon = () => {
    if (!accessStatus.canAccess) return <XCircle className="h-4 w-4" />;
    if (accessStatus.isGracePeriod) return <AlertTriangle className="h-4 w-4" />;
    if (accessStatus.status === 'trial') return <Clock className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const getTitle = () => {
    if (!accessStatus.canAccess) return 'Acesso Bloqueado';
    if (accessStatus.isGracePeriod) return 'Assinatura Vencida';
    if (accessStatus.status === 'trial') return 'Período de Teste';
    return 'Aviso';
  };

  // Mostrar apenas alertas relevantes
  if (accessStatus.canAccess && accessStatus.status === 'active' && !accessStatus.isGracePeriod) {
    return null;
  }

  return (
    <Alert variant={getAlertVariant()} className="mb-4">
      {getIcon()}
      <AlertTitle>{getTitle()}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{accessStatus.message}</span>
        {onContactSupport && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onContactSupport}
            className="ml-4"
          >
            Contatar Suporte
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Banner fixo no topo para períodos de carência
 */
export function GracePeriodBanner({ accessStatus }: { accessStatus: CompanyAccessStatus }) {
  if (!accessStatus.isGracePeriod) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
      <AlertTriangle className="inline h-4 w-4 mr-2" />
      {accessStatus.message}
      {accessStatus.daysRemaining !== null && accessStatus.daysRemaining <= 3 && (
        <span className="ml-2 font-bold">
          Regularize sua assinatura para evitar bloqueio!
        </span>
      )}
    </div>
  );
}

/**
 * Tela de bloqueio completo
 */
export function BlockedAccessScreen({ 
  accessStatus, 
  onLogout 
}: { 
  accessStatus: CompanyAccessStatus; 
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Acesso Bloqueado
        </h1>
        
        <p className="text-gray-400 mb-6">
          {accessStatus.message}
        </p>

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            onClick={() => window.open('mailto:suporte@imobipro.com.br', '_blank')}
          >
            Contatar Suporte
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full text-gray-400 hover:text-white"
            onClick={onLogout}
          >
            Sair
          </Button>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Se você acredita que isso é um erro, entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
