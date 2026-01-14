import { useState, useEffect } from 'react';
import { 
  Building2, Search, Filter, MoreVertical, Ban, CheckCircle, 
  Clock, AlertTriangle, RefreshCw, Plus, Eye, Edit, Calendar, Home, UserCheck, Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdminCompanies, AdminCompany } from '@/hooks/useAdminCompanies';

interface AdminCompanyListProps {
  onViewDetails?: (company: AdminCompany) => void;
  onCreateCompany?: () => void;
}

export function AdminCompanyList({ onViewDetails, onCreateCompany }: AdminCompanyListProps) {
  const { 
    companies, 
    loading, 
    error,
    listCompanies, 
    blockCompany, 
    unblockCompany, 
    renewSubscription 
  } = useAdminCompanies();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; company: AdminCompany | null }>({ 
    open: false, 
    company: null 
  });
  const [unblockDialog, setUnblockDialog] = useState<{ open: boolean; company: AdminCompany | null }>({ 
    open: false, 
    company: null 
  });
  const [renewDialog, setRenewDialog] = useState<{ open: boolean; company: AdminCompany | null }>({ 
    open: false, 
    company: null 
  });
  const [blockReason, setBlockReason] = useState('');
  const [renewDays, setRenewDays] = useState(30);
  const [actionLoading, setActionLoading] = useState(false);

  // Buscar empresas quando filtros mudarem
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      listCompanies(
        statusFilter === 'all' ? undefined : statusFilter,
        search || undefined
      );
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, statusFilter, listCompanies]);

  const getStatusBadge = (company: AdminCompany) => {
    if (company.blocked_at) {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueada</Badge>;
    }

    switch (company.subscription_status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>;
      case 'trial':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Trial</Badge>;
      case 'grace':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Carencia</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expirada</Badge>;
      case 'blocked':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueada</Badge>;
      default:
        return <Badge variant="outline">{company.subscription_status}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const handleBlock = async () => {
    if (!blockDialog.company) return;
    setActionLoading(true);
    await blockCompany(blockDialog.company.id, blockReason);
    setActionLoading(false);
    setBlockDialog({ open: false, company: null });
    setBlockReason('');
  };

  const handleUnblock = async () => {
    if (!unblockDialog.company) return;
    setActionLoading(true);
    await unblockCompany(unblockDialog.company.id, 'active');
    setActionLoading(false);
    setUnblockDialog({ open: false, company: null });
  };

  const handleRenew = async () => {
    if (!renewDialog.company) return;
    setActionLoading(true);
    await renewSubscription(renewDialog.company.id, renewDays);
    setActionLoading(false);
    setRenewDialog({ open: false, company: null });
    setRenewDays(30);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-400" />
            Empresas
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie todas as empresas do sistema
          </p>
        </div>
        <Button 
          onClick={onCreateCompany}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, email ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-600 text-white"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-900/50 border-gray-600 text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="trial">Em Trial</SelectItem>
                <SelectItem value="grace">Em Carencia</SelectItem>
                <SelectItem value="blocked">Bloqueadas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => listCompanies()}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Erro ao carregar empresas</p>
                <p className="text-red-300/70 text-sm mt-1">{error}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => listCompanies()}
                  className="mt-3 border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Empresas */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
              <p>Erro ao carregar empresas</p>
              <p className="text-sm text-red-400/70 mt-2">{error}</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Building2 className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="text-left p-4 text-gray-400 font-medium">Empresa</th>
                    <th className="text-left p-4 text-gray-400 font-medium">WhatsApp IA</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Imóveis</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Leads</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Expiração</th>
                    <th className="text-right p-4 text-gray-400 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {companies.map((company) => (
                    <tr 
                      key={company.id} 
                      className="hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{company.name}</p>
                          <p className="text-gray-400 text-sm">{company.email || '-'}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {company.whatsapp_ai_phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-400" />
                            <span className="text-gray-300 font-mono text-sm">
                              {company.whatsapp_ai_phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(company)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Home className="h-3 w-3 text-purple-400" />
                          <span className="text-gray-300 font-medium">
                            {company.property_count || 0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-amber-400" />
                          <span className="text-gray-300 font-medium">
                            {company.lead_count || 0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">
                          {company.subscription_status === 'trial' 
                            ? formatDate(company.trial_ends_at)
                            : formatDate(company.subscription_expires_at)
                          }
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                            <DropdownMenuLabel className="text-gray-400">Acoes</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem 
                              onClick={() => onViewDetails?.(company)}
                              className="text-gray-300 hover:text-white hover:bg-gray-700"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setRenewDialog({ open: true, company })}
                              className="text-gray-300 hover:text-white hover:bg-gray-700"
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Renovar Assinatura
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            {company.blocked_at || company.subscription_status === 'blocked' ? (
                              <DropdownMenuItem 
                                onClick={() => setUnblockDialog({ open: true, company })}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-gray-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Desbloquear
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => setBlockDialog({ open: true, company })}
                                className="text-red-400 hover:text-red-300 hover:bg-gray-700"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Bloquear
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Bloqueio */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => setBlockDialog({ open, company: blockDialog.company })}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="h-5 w-5" />
              Bloquear Empresa
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Bloquear "{blockDialog.company?.name}". Os usuarios nao conseguirao fazer login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Motivo do bloqueio</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Inadimplencia, solicitacao do cliente..."
                className="bg-gray-900/50 border-gray-600 text-white mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBlockDialog({ open: false, company: null })}
              className="border-gray-600 text-gray-300"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBlock}
              disabled={actionLoading}
            >
              {actionLoading ? 'Bloqueando...' : 'Bloquear Empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Desbloqueio */}
      <Dialog open={unblockDialog.open} onOpenChange={(open) => setUnblockDialog({ open, company: unblockDialog.company })}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              Desbloquear Empresa
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Desbloquear "{unblockDialog.company?.name}" e reativar acesso?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setUnblockDialog({ open: false, company: null })}
              className="border-gray-600 text-gray-300"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUnblock}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? 'Desbloqueando...' : 'Desbloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Renovacao */}
      <Dialog open={renewDialog.open} onOpenChange={(open) => setRenewDialog({ open, company: renewDialog.company })}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Calendar className="h-5 w-5" />
              Renovar Assinatura
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Adicionar dias a assinatura de "{renewDialog.company?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Dias a adicionar</Label>
              <Select value={String(renewDays)} onValueChange={(v) => setRenewDays(Number(v))}>
                <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias (1 mes)</SelectItem>
                  <SelectItem value="60">60 dias (2 meses)</SelectItem>
                  <SelectItem value="90">90 dias (3 meses)</SelectItem>
                  <SelectItem value="180">180 dias (6 meses)</SelectItem>
                  <SelectItem value="365">365 dias (1 ano)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRenewDialog({ open: false, company: null })}
              className="border-gray-600 text-gray-300"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleRenew}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading ? 'Renovando...' : `Adicionar ${renewDays} dias`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminCompanyList;
