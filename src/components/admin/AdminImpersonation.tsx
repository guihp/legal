import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  LogIn, 
  Building2, 
  User, 
  Loader2,
  Shield,
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useImpersonation, UserForImpersonation } from '@/hooks/useImpersonation';
import { useAdminCompanies } from '@/hooks/useAdminCompanies';

export function AdminImpersonation() {
  const { users, loadingUsers, loadUsers, startImpersonation } = useImpersonation();
  const { companies, listCompanies } = useAdminCompanies();
  
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserForImpersonation | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadUsers();
    listCompanies();
  }, [listCompanies]);

  // Filtrar quando busca ou empresa mudar
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(
        selectedCompany === 'all' ? undefined : selectedCompany,
        search || undefined
      );
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search, selectedCompany, loadUsers]);

  const handleImpersonate = async () => {
    if (!selectedUser) return;
    
    setProcessing(true);
    await startImpersonation(selectedUser.user_id, reason || undefined);
    setProcessing(false);
    setConfirming(false);
    setSelectedUser(null);
    setReason('');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</Badge>;
      case 'gestor':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Gestor</Badge>;
      case 'corretor':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Corretor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="h-7 w-7 text-amber-400" />
          Acessar como Usuário
        </h2>
        <p className="text-gray-400 mt-1">
          Acesse o sistema como qualquer usuário para suporte ou verificação
        </p>
      </div>

      {/* Aviso */}
      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium">Atenção</p>
              <p className="text-amber-200/70 text-sm mt-1">
                Todas as sessões de impersonação são registradas e auditadas. 
                Use esta funcionalidade apenas para suporte técnico ou verificação de problemas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtrar Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, email ou empresa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Disponíveis
            {!loadingUsers && (
              <Badge variant="secondary" className="ml-2">
                {users.length} usuário{users.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Selecione um usuário para acessar o sistema como ele
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className={`
                    p-4 rounded-lg border transition-all cursor-pointer
                    ${user.is_active 
                      ? 'bg-gray-900/30 border-gray-700 hover:bg-gray-900/50 hover:border-gray-600' 
                      : 'bg-gray-900/10 border-gray-800 opacity-60'}
                  `}
                  onClick={() => user.is_active && setSelectedUser(user)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {user.full_name || 'Sem nome'}
                          </span>
                          {getRoleBadge(user.role)}
                          {!user.is_active && (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {user.company_name && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Building2 className="h-4 w-4" />
                          {user.company_name}
                        </div>
                      )}
                      {user.is_active && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setConfirming(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <LogIn className="h-4 w-4 mr-2" />
                          Acessar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              Confirmar Acesso
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Você está prestes a acessar o sistema como outro usuário
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {selectedUser.full_name || 'Sem nome'}
                    </div>
                    <div className="text-sm text-gray-400">{selectedUser.email}</div>
                    {selectedUser.company_name && (
                      <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {selectedUser.company_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  Motivo do acesso (opcional)
                </label>
                <Textarea
                  placeholder="Ex: Verificar problema reportado pelo usuário..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  rows={3}
                />
              </div>
              
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <p className="text-amber-200 text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Esta sessão será registrada para auditoria
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(false);
                setSelectedUser(null);
                setReason('');
              }}
              className="border-gray-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImpersonate}
              disabled={processing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Acessando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Acessar como Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminImpersonation;
