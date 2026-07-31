import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  canCreate: boolean;
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
};

export function UserManagementHeader({ canCreate, loading, onCreate, onRefresh }: Props) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Gerenciamento de usuários
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Gerencie membros da equipe, cargos e status de acesso da sua imobiliária.
        </p>
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        {canCreate && (
          <Button
            onClick={onCreate}
            className="btn-on-emerald flex-1 bg-emerald-800 text-white hover:bg-emerald-700 sm:flex-none dark:bg-emerald-700 dark:hover:bg-emerald-600"
            style={{ color: '#ffffff' }}
          >
            <Plus className="mr-2 h-4 w-4" style={{ color: '#ffffff' }} />
            Novo usuário
          </Button>
        )}
      </div>
    </header>
  );
}
