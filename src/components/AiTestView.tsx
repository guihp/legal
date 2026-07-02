import { Construction, ExternalLink, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOwnCompany } from '@/hooks/useOwnCompany';

export function AiTestView() {
  const { loading: companyLoading, isManager } = useOwnCompany();

  if (companyLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <div className="text-red-400 mb-2">Acesso restrito</div>
        <p className="text-gray-400 text-sm">Apenas gestores podem testar a IA.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-8 sm:py-12">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-xl font-semibold text-white sm:text-2xl">
          <Smartphone className="h-6 w-6 shrink-0 text-emerald-400 sm:h-7 sm:w-7" />
          Testar IA
        </h1>
        <Badge className="mt-3 border-amber-500/30 bg-amber-500/15 text-amber-300">
          Em desenvolvimento
        </Badge>
      </div>

      <div className="w-full rounded-2xl border border-gray-800 bg-gray-900/60 px-6 py-10 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Construction className="h-8 w-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white sm:text-xl">
          Simulador em construção
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
          Em breve você poderá simular conversas com a IA como se fosse um cliente interessado,
          direto nesta tela.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-6 border-gray-700 text-gray-200"
          onClick={() => window.location.assign('/ai-configuration')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Configurar IA
        </Button>
      </div>
    </div>
  );
}

export default AiTestView;
