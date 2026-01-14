import { useState, useEffect } from 'react';
import { History, RefreshCw, Filter, Building2, User, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminCompanies, CompanyAccessLog } from '@/hooks/useAdminCompanies';

export function AdminAccessLogs() {
  const { getAccessLogs, loading } = useAdminCompanies();
  const [logs, setLogs] = useState<CompanyAccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const loadLogs = async () => {
    setLogsLoading(true);
    const data = await getAccessLogs(undefined, 100);
    setLogs(data);
    setLogsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'blocked':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400">Bloqueio</Badge>;
      case 'unblocked':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Desbloqueio</Badge>;
      case 'subscription_changed':
        return <Badge className="bg-blue-500/20 text-blue-400">Assinatura</Badge>;
      case 'plan_changed':
        return <Badge className="bg-purple-500/20 text-purple-400">Plano</Badge>;
      case 'created':
        return <Badge className="bg-cyan-500/20 text-cyan-400">Criacao</Badge>;
      case 'grace_period_started':
        return <Badge className="bg-amber-500/20 text-amber-400">Carencia</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">Expirado</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <History className="h-8 w-8 text-blue-400" />
            Logs de Acesso
          </h1>
          <p className="text-gray-400 mt-1">
            Historico de acoes administrativas sobre empresas
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={loadLogs}
          disabled={logsLoading}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Logs List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {getActionBadge(log.action)}
                        <span className="text-white font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {log.company_name || 'Empresa não encontrada'}
                        </span>
                      </div>
                      
                      {log.reason && (
                        <p className="text-gray-400 text-sm pl-1">
                          {log.reason}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {log.performed_by_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.performed_by_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      {(log.previous_status || log.new_status) && (
                        <div className="flex items-center gap-2 text-xs">
                          {log.previous_status && (
                            <span className="text-gray-500">
                              De: <span className="text-gray-400">{log.previous_status}</span>
                            </span>
                          )}
                          {log.previous_status && log.new_status && (
                            <span className="text-gray-600">→</span>
                          )}
                          {log.new_status && (
                            <span className="text-gray-500">
                              Para: <span className="text-gray-400">{log.new_status}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <div className="text-xs text-gray-500 font-mono bg-gray-900/50 rounded px-2 py-1 inline-block">
                          {JSON.stringify(log.meta)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminAccessLogs;
