import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useOwnCompany } from '@/hooks/useOwnCompany';

export function CompanyDataEditor() {
  const { company, loading, updating, isManager, updateCompany, daysRemaining } = useOwnCompany();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cnpj: '',
    phone: '',
    address: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Preencher formulário quando carregar empresa
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        email: company.email || '',
        cnpj: company.cnpj || '',
        phone: company.phone || '',
        address: company.address || '',
      });
    }
  }, [company]);

  // Detectar mudanças
  useEffect(() => {
    if (!company) return;
    const changed = 
      formData.name !== (company.name || '') ||
      formData.email !== (company.email || '') ||
      formData.cnpj !== (company.cnpj || '') ||
      formData.phone !== (company.phone || '') ||
      formData.address !== (company.address || '');
    setHasChanges(changed);
  }, [formData, company]);

  const handleSave = async () => {
    const success = await updateCompany(formData);
    if (success) {
      setHasChanges(false);
    }
  };

  const getStatusBadge = () => {
    if (!company) return null;
    
    switch (company.subscription_status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>;
      case 'trial':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Período de Teste</Badge>;
      case 'grace':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Período de Carência</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expirada</Badge>;
      case 'blocked':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueada</Badge>;
      default:
        return <Badge variant="outline">{company.subscription_status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center h-48 text-gray-400">
          <p>Empresa não encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da Assinatura */}
      <Card className={`border ${
        company.subscription_status === 'grace' ? 'border-amber-500/50 bg-amber-500/10' :
        company.subscription_status === 'trial' && daysRemaining !== null && daysRemaining <= 7 ? 'border-amber-500/50 bg-amber-500/10' :
        'border-gray-700 bg-gray-800/50'
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${
                company.subscription_status === 'active' ? 'bg-emerald-500/20' :
                company.subscription_status === 'trial' ? 'bg-purple-500/20' :
                'bg-amber-500/20'
              }`}>
                <Clock className={`h-6 w-6 ${
                  company.subscription_status === 'active' ? 'text-emerald-400' :
                  company.subscription_status === 'trial' ? 'text-purple-400' :
                  'text-amber-400'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Status da Conta</h3>
                  {getStatusBadge()}
                </div>
                <p className="text-gray-400 text-sm">
                  {daysRemaining !== null ? (
                    daysRemaining === 0 ? 'Expira hoje!' :
                    daysRemaining === 1 ? '1 dia restante' :
                    `${daysRemaining} dias restantes`
                  ) : 'Sem data de expiração'}
                </p>
              </div>
            </div>
            {company.subscription_status === 'trial' && daysRemaining !== null && daysRemaining <= 7 && (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Ative sua assinatura!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dados da Empresa */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-400" />
              <div>
                <CardTitle className="text-white">Dados da Empresa</CardTitle>
                <CardDescription>Informações básicas da sua empresa</CardDescription>
              </div>
            </div>
            {isManager && (
              <Button 
                onClick={handleSave}
                disabled={!hasChanges || updating}
                className={hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'}
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome da Empresa</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isManager}
                className="bg-gray-900/50 border-gray-600 text-white"
                placeholder="Nome da sua empresa"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isManager}
                className="bg-gray-900/50 border-gray-600 text-white"
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">CNPJ</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                disabled={!isManager}
                className="bg-gray-900/50 border-gray-600 text-white"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isManager}
                className="bg-gray-900/50 border-gray-600 text-white"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isManager}
                className="bg-gray-900/50 border-gray-600 text-white"
                placeholder="Endereço completo"
              />
            </div>
          </div>

          {/* Info do Plano (somente leitura) */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Informações do Plano</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Plano:</span>
                <p className="text-white capitalize">{company.plan}</p>
              </div>
              <div>
                <span className="text-gray-500">Máx. Usuários:</span>
                <p className="text-white">{company.max_users}</p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <p className="text-white capitalize">{company.subscription_status}</p>
              </div>
              <div>
                <span className="text-gray-500">Desde:</span>
                <p className="text-white">
                  {new Date(company.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {!isManager && (
            <p className="text-sm text-gray-500 italic">
              * Apenas administradores e gestores podem editar os dados da empresa
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CompanyDataEditor;
