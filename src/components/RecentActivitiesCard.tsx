import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { logAudit } from "@/lib/audit/logger";
import { TestTube } from "lucide-react";

type Role = 'admin' | 'gestor' | 'corretor';

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  resource: string;
  resource_id: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    id: string;
    full_name: string | null;
    role: string | null;
  };
}

interface UserOption { id: string; name: string; role: Role }

// Função para traduzir ações para português
function formatAction(action: string): string {
  const translations: Record<string, string> = {
    'lead.created': 'Criou um lead',
    'lead.updated': 'Atualizou um lead',
    'lead.deleted': 'Excluiu um lead',
    'lead.stage_changed': 'Alterou status do lead',
    'property.created': 'Cadastrou um novo imóvel',
    'property.updated': 'Editou informações de um imóvel',
    'property.deleted': 'Removeu um imóvel do sistema',
    'property.images_uploaded': 'Adicionou fotos ao imóvel',
    'property.images_removed': 'Removeu fotos do imóvel',
    'property.availability_changed': 'Alterou disponibilidade do imóvel',
    'property.xml_imported': 'Importou imóveis via XML VivaReal',
    'property.viewed': 'Visualizou detalhes do imóvel',
    'contract.created': 'Criou um contrato',
    'contract.updated': 'Atualizou um contrato',
    'contract.deleted': 'Excluiu um contrato',
    'whatsapp.message_sent': 'Enviou mensagem WhatsApp',
    'whatsapp.chat_created': 'Criou conversa WhatsApp',
    'whatsapp.instance_created': 'Criou instância WhatsApp',
    'whatsapp.instance_status_updated': 'Atualizou status da instância',
    'whatsapp.instance_connected': 'Conectou instância WhatsApp',
    'whatsapp.instance_disconnected': 'Desconectou instância WhatsApp',
    'whatsapp.instance_qr_generated': 'Gerou QR Code WhatsApp',
    'user.login': 'Fez login',
    'user.logout': 'Fez logout',
    'user.created': 'Criou um usuário',
    'user.profile_updated': 'Atualizou perfil',
    'user.deactivated': 'Desativou usuário',
    'user.activated': 'Reativou usuário',
    'user.deleted': 'Deletou usuário permanentemente',
    'permissions.updated': 'Atualizou permissões',
    'bulk_whatsapp.started': 'Iniciou disparo em massa',
    'bulk_whatsapp.finished': 'Finalizou disparo em massa',
    'agenda.event_created': 'Criou evento na agenda',
    'system.test': 'Executou teste do sistema',
  };
  return translations[action] || action;
}

// Função para traduzir recursos para português
function formatResource(resource: string): string {
  const translations: Record<string, string> = {
    'lead': 'Lead',
    'property': 'Propriedade',
    'contract': 'Contrato',
    'whatsapp_message': 'Mensagem WhatsApp',
    'whatsapp_chat': 'Chat WhatsApp',
    'whatsapp_instance': 'Instância WhatsApp',
    'user_profile': 'Perfil de Usuário',
    'permission': 'Permissão',
    'bulk_whatsapp': 'Disparo em Massa',
    'agenda_event': 'Evento da Agenda',
    'test_resource': 'Recurso de Teste',
  };
  return translations[resource] || resource;
}

export function RecentActivitiesCard() {
  const { profile } = useUserProfile();
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [usersByRole, setUsersByRole] = useState<Record<Role, UserOption[]>>({ admin: [], gestor: [], corretor: [] });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const canSeeAll = profile?.role === 'admin' || profile?.role === 'gestor';

  // Função para testar o sistema de logs
  const testAuditLog = async () => {
    try {
      await logAudit({
        action: 'system.test',
        resource: 'test_resource',
        resourceId: `test-${Date.now()}`,
        meta: {
          test_time: new Date().toISOString(),
          user_role: profile?.role,
          test_source: 'manual_dashboard_test'
        }
      });
      // Recarregar logs para mostrar o novo log
      loadLogs();
    } catch (error) {
      console.error('Erro ao testar audit log:', error);
    }
  };

  const loadUsers = async () => {
    if (!canSeeAll) return;
    // Reutiliza view user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true });
    if (!error && Array.isArray(data)) {
      const grouped: Record<Role, UserOption[]> = { admin: [], gestor: [], corretor: [] };
      for (const u of data as any[]) {
        const r = (u.role ?? 'corretor') as Role;
        grouped[r].push({ id: u.id, name: u.full_name || 'Sem nome', role: r });
      }
      setUsersByRole(grouped);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    
    try {
      // Verificar se o usuário tem permissão para ver logs
      if (profile?.role === 'corretor') {
        console.log('🔒 Corretor não tem acesso aos audit logs');
        setLogs([]);
        setLoading(false);
        return;
      }

      // Primeiro, buscar os logs
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      // Filtro por usuário quando selecionado
      if (userFilter !== 'all') {
        query = query.eq('actor_id', userFilter);
      }
      
      const { data: logsData, error: logsError } = await query;
      
      if (logsError) {
        console.error('Erro ao carregar logs:', logsError);
        setLogs([]);
        setLoading(false);
        return;
      }

      if (!logsData || logsData.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      // Buscar dados dos usuários únicos
      const actorIds = [...new Set(logsData.map(log => log.actor_id))];
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .in('id', actorIds);

      if (usersError) {
        console.error('Erro ao carregar usuários:', usersError);
        // Ainda assim, mostrar os logs sem dados do usuário
        setLogs(logsData);
        setLoading(false);
        return;
      }

      // Criar mapa de usuários para fácil acesso
      const usersMap = new Map();
      if (usersData) {
        usersData.forEach(user => {
          usersMap.set(user.id, user);
        });
      }

      // Combinar logs com dados dos usuários
      const logsWithUsers = logsData.map(log => ({
        ...log,
        actor: usersMap.get(log.actor_id) || null
      }));

      setLogs(logsWithUsers);
    } catch (error) {
      console.error('Erro geral ao carregar logs:', error);
      setLogs([]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeAll]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, userFilter]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`audit_logs_rt_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        // Recarregar a primeira página em tempo real
        setPage(0);
        loadLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Opções de usuário conforme roleFilter
  const userOptions = useMemo(() => {
    if (!canSeeAll) return [] as UserOption[];
    if (roleFilter === 'all') return [...usersByRole.admin, ...usersByRole.gestor, ...usersByRole.corretor];
    return usersByRole[roleFilter] ?? [];
  }, [usersByRole, roleFilter, canSeeAll]);

  return (
    <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Atividades Recentes</CardTitle>
          {(profile?.role === 'admin' || profile?.role === 'gestor') && (
            <Button
              onClick={testAuditLog}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Testar Log
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        {canSeeAll && (
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as any); setUserFilter('all'); }}>
              <SelectTrigger className="w-full md:w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="corretor">Corretor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={(v) => setUserFilter(v)}>
              <SelectTrigger className="w-full md:w-72 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {userOptions.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lista de atividades */}
        <div className="space-y-3">
          {logs.map((log) => {
            const formatLogDescription = (log: AuditLog) => {
              const meta = log.meta || {};
              
              // Formatação específica para propriedades
              if (log.action.startsWith('property.')) {
                if (log.action === 'property.created') {
                  return `${meta.title || 'Novo imóvel'} - ${meta.type || ''} em ${meta.city || 'cidade não informada'}`;
                }
                if (log.action === 'property.updated') {
                  return `${meta.title || `ID #${log.resource_id?.slice(0, 8)}`} - ${meta.updated_fields?.join(', ') || 'dados atualizados'}`;
                }
                if (log.action === 'property.deleted') {
                  return `${meta.title || meta.listing_id || `ID #${log.resource_id?.slice(0, 8)}`} em ${meta.cidade || 'localização não informada'}`;
                }
                if (log.action === 'property.availability_changed') {
                  return `${meta.title || meta.listing_id || `ID #${log.resource_id?.slice(0, 8)}`} → ${meta.new_availability || 'nova disponibilidade'}`;
                }
                if (log.action === 'property.images_uploaded') {
                  return `${meta.property_title || `ID #${log.resource_id?.slice(0, 8)}`} - ${meta.images_count || 0} foto(s)`;
                }
              }
              
              // Formatação específica para usuários
              if (log.action.startsWith('user.')) {
                if (log.action === 'user.created') {
                  return `${meta.full_name || meta.email || 'Novo usuário'} - ${meta.role || 'função não informada'}`;
                }
                if (log.action === 'user.profile_updated') {
                  return `${meta.full_name || meta.email || `ID #${log.resource_id?.slice(0, 8)}`} - dados do perfil`;
                }
                if (log.action === 'user.deleted') {
                  return `${meta.deleted_user || `ID #${log.resource_id?.slice(0, 8)}`} - remoção permanente`;
                }
              }
              
              // Formatação padrão
              return log.resource_id && log.resource_id !== 'undefined' 
                ? `ID #${log.resource_id.slice(0, 8)}` 
                : 'ação realizada';
            };

            return (
              <div key={log.id} className="p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{formatAction(log.action)}</span>
                      {log.actor && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">por</span>
                          <span className="text-green-400 font-medium">
                            {log.actor.full_name || 'Nome não disponível'}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-blue-400">
                            {log.actor.role || 'corretor'}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400 font-mono text-xs">
                            ID: {log.actor.id.slice(0, 8)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-blue-400">
                      {formatLogDescription(log)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 ml-3">
                    {new Date(log.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                {log.meta?.availability_note && (
                  <div className="mt-2 text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1">
                    💬 {log.meta.availability_note}
                  </div>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="text-center py-6 text-gray-400">Carregando atividades...</div>
          )}
          {!loading && logs.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <div className="mb-2">📝 Nenhuma atividade encontrada</div>
              <div className="text-xs">As ações dos usuários aparecerão aqui automaticamente</div>
            </div>
          )}
        </div>

        {/* Paginação interna */}
        <div className="flex justify-between items-center mt-4 text-sm text-gray-300">
          <button
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >Anterior</button>
          <span>Página {page + 1}</span>
          <button
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={logs.length < pageSize}
          >Próxima</button>
        </div>
      </CardContent>
    </Card>
  );
}


