import { useState, useEffect } from 'react';
import { 
  Building2, ArrowLeft, Users, FileText, Home, Calendar, 
  Ban, CheckCircle, Edit, Save, X, Clock, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminCompanies, AdminCompanyDetails as CompanyDetails } from '@/hooks/useAdminCompanies';

interface AdminCompanyDetailsProps {
  companyId: string;
  onBack: () => void;
}

export function AdminCompanyDetailsView({ companyId, onBack }: AdminCompanyDetailsProps) {
  const { getCompanyDetails, updateCompany, blockCompany, unblockCompany, renewSubscription } = useAdminCompanies();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<CompanyDetails>>({});

  useEffect(() => {
    loadCompany();
  }, [companyId]);

  const loadCompany = async () => {
    setLoading(true);
    const data = await getCompanyDetails(companyId);
    setCompany(data);
    if (data) {
      setFormData({
        name: data.name,
        email: data.email,
        cnpj: data.cnpj,
        phone: data.phone,
        address: data.address,
        plan: data.plan,
        max_users: data.max_users,
        billing_email: data.billing_email,
        admin_notes: data.admin_notes,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    const success = await updateCompany(company.id, formData);
    if (success) {
      await loadCompany();
      setEditing(false);
    }
    setSaving(false);
  };

  const getStatusBadge = () => {
    if (!company) return null;
    
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
      default:
        return <Badge variant="outline">{company.subscription_status}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400">Empresa nao encontrada</p>
        <Button onClick={onBack} variant="outline" className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {company.name}
              {getStatusBadge()}
            </h1>
            <p className="text-gray-400 mt-1">
              Criada em {formatDate(company.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button 
              onClick={() => setEditing(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => setEditing(false)}
                className="border-gray-600 text-gray-300"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={<Users className="h-5 w-5" />}
          label="Usuarios"
          value={`${company.active_user_count} / ${company.max_users}`}
          sublabel={`${company.user_count} total`}
        />
        <MetricCard 
          icon={<FileText className="h-5 w-5" />}
          label="Leads"
          value={company.leads_count.toString()}
        />
        <MetricCard 
          icon={<Home className="h-5 w-5" />}
          label="Imoveis"
          value={company.properties_count.toString()}
        />
        <MetricCard 
          icon={<Calendar className="h-5 w-5" />}
          label="Dias Restantes"
          value={getDaysRemaining(company)}
          highlight={isExpiringSoon(company)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Empresa */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Dados da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField 
              label="Nome"
              value={editing ? formData.name || '' : company.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              editing={editing}
            />
            <FormField 
              label="Email"
              value={editing ? formData.email || '' : company.email || ''}
              onChange={(v) => setFormData({ ...formData, email: v })}
              editing={editing}
            />
            <FormField 
              label="CNPJ"
              value={editing ? formData.cnpj || '' : company.cnpj || ''}
              onChange={(v) => setFormData({ ...formData, cnpj: v })}
              editing={editing}
            />
            <FormField 
              label="Telefone"
              value={editing ? formData.phone || '' : company.phone || ''}
              onChange={(v) => setFormData({ ...formData, phone: v })}
              editing={editing}
            />
            <FormField 
              label="Endereco"
              value={editing ? formData.address || '' : company.address || ''}
              onChange={(v) => setFormData({ ...formData, address: v })}
              editing={editing}
            />
          </CardContent>
        </Card>

        {/* Configuracoes */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Configuracoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="space-y-2">
                <Label className="text-gray-300">Plano</Label>
                <Select 
                  value={formData.plan || ''} 
                  onValueChange={(v) => setFormData({ ...formData, plan: v })}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="basic">Basico</SelectItem>
                    <SelectItem value="professional">Profissional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Plano</span>
                <span className="text-white capitalize">{company.plan}</span>
              </div>
            )}

            {editing ? (
              <div className="space-y-2">
                <Label className="text-gray-300">Max Usuarios</Label>
                <Select 
                  value={String(formData.max_users || 10)} 
                  onValueChange={(v) => setFormData({ ...formData, max_users: Number(v) })}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Max Usuarios</span>
                <span className="text-white">{company.max_users}</span>
              </div>
            )}

            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Status</span>
              <span className="text-white capitalize">{company.subscription_status}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Expiracao</span>
              <span className="text-white">
                {company.subscription_status === 'trial' 
                  ? formatDate(company.trial_ends_at)
                  : formatDate(company.subscription_expires_at)
                }
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-gray-400">Carencia</span>
              <span className="text-white">{company.grace_period_days} dias</span>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card className="bg-gray-800/50 border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Notas Administrativas</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={formData.admin_notes || ''}
                onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                placeholder="Notas internas sobre a empresa..."
                className="bg-gray-900/50 border-gray-600 text-white min-h-[100px]"
              />
            ) : (
              <p className="text-gray-300">
                {company.admin_notes || 'Nenhuma nota registrada'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  sublabel,
  highlight 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`bg-gray-800/50 border-gray-700 ${highlight ? 'border-amber-500/50' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-gray-400">{label}</p>
            <p className={`text-xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
            {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormField({ 
  label, 
  value, 
  onChange, 
  editing 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  editing: boolean;
}) {
  if (editing) {
    return (
      <div className="space-y-2">
        <Label className="text-gray-300">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-gray-900/50 border-gray-600 text-white"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-between py-2 border-b border-gray-700">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value || '-'}</span>
    </div>
  );
}

function getDaysRemaining(company: CompanyDetails): string {
  const now = new Date();
  let targetDate: Date | null = null;

  if (company.subscription_status === 'trial' && company.trial_ends_at) {
    targetDate = new Date(company.trial_ends_at);
  } else if (company.subscription_expires_at) {
    targetDate = new Date(company.subscription_expires_at);
  }

  if (!targetDate) return '-';

  const diff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diff < 0) return 'Expirado';
  if (diff === 0) return 'Hoje';
  return `${diff} dias`;
}

function isExpiringSoon(company: CompanyDetails): boolean {
  const now = new Date();
  let targetDate: Date | null = null;

  if (company.subscription_status === 'trial' && company.trial_ends_at) {
    targetDate = new Date(company.trial_ends_at);
  } else if (company.subscription_expires_at) {
    targetDate = new Date(company.subscription_expires_at);
  }

  if (!targetDate) return false;

  const diff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff <= 7;
}

export default AdminCompanyDetailsView;
