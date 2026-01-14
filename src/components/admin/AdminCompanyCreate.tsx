import { useState } from 'react';
import { Building2, ArrowLeft, Check, Loader2, Phone, MessageSquare, Bot, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminCompanies } from '@/hooks/useAdminCompanies';
import { toast } from 'sonner';

interface AdminCompanyCreateProps {
  onBack: () => void;
  onSuccess: (companyId: string) => void;
}

interface CompanyFormData {
  name: string;
  whatsapp_ai_phone: string;
  login_email: string; // Email obrigatório para login do gestor
  email: string; // Email opcional da empresa
  cnpj: string;
  phone: string;
  address: string;
  plan: string;
  trial_days: number;
  max_users: number;
}

const initialFormData: CompanyFormData = {
  name: '',
  whatsapp_ai_phone: '',
  login_email: '',
  email: '',
  cnpj: '',
  phone: '',
  address: '',
  plan: 'basic',
  trial_days: 14,
  max_users: 10,
};

// Formatar telefone para exibição
const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
};

// Validar telefone
const isValidPhone = (phone: string): boolean => {
  const numbers = phone.replace(/\D/g, '');
  return numbers.length >= 10 && numbers.length <= 11;
};

// Validar email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function AdminCompanyCreate({ onBack, onSuccess }: AdminCompanyCreateProps) {
  const { createCompany } = useAdminCompanies();
  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: keyof CompanyFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    updateField('whatsapp_ai_phone', formatted);
  };

  const isFormValid = (): boolean => {
    return isValidPhone(formData.whatsapp_ai_phone) && isValidEmail(formData.login_email);
  };

  const handleSubmit = async () => {
    if (!isValidPhone(formData.whatsapp_ai_phone)) {
      setError('Informe um número de telefone válido para o WhatsApp da IA');
      return;
    }

    if (!isValidEmail(formData.login_email)) {
      setError('Informe um email válido para login do gestor');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extrair apenas números do telefone
      const phoneNumbers = formData.whatsapp_ai_phone.replace(/\D/g, '');
      
      console.log('📤 Enviando dados para criar empresa:', {
        name: formData.name || `Empresa ${phoneNumbers}`,
        whatsapp_ai_phone: phoneNumbers,
        login_email: formData.login_email.trim().toLowerCase(),
      });
      
      const result = await createCompany({
        name: formData.name || `Empresa ${phoneNumbers}`,
        whatsapp_ai_phone: phoneNumbers,
        login_email: formData.login_email.trim().toLowerCase(),
        email: formData.email || undefined,
        cnpj: formData.cnpj || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        plan: formData.plan,
        trial_days: formData.trial_days,
        max_users: formData.max_users,
      });

      console.log('📥 Resultado da criação:', result);

      if (result) {
        setCreatedCredentials({
          email: result.email,
          password: result.password
        });
        toast.success('Empresa criada com sucesso!');
      } else {
        setError('Erro ao criar empresa. Verifique os logs do console para mais detalhes.');
      }
    } catch (err: any) {
      console.error('❌ Erro ao criar empresa:', err);
      setError(err.message || 'Erro ao criar empresa. Verifique os logs do console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Building2 className="h-8 w-8 text-blue-400" />
            Nova Empresa
          </h1>
          <p className="text-gray-400 mt-1">
            Cadastre uma nova empresa no sistema
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/30 max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Bot className="h-6 w-6 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-200 font-medium">Telefone do WhatsApp para a IA</p>
              <p className="text-blue-200/70 text-sm mt-1">
                Informe o número do WhatsApp onde a IA ficará conectada para atender os clientes desta empresa.
                Este é o único campo obrigatório.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card className="bg-gray-800/50 border-gray-700 max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-400" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>
            Telefone do WhatsApp e email para login são obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campo Obrigatório - WhatsApp */}
          <div className="space-y-2">
            <Label className="text-white font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-400" />
              Telefone WhatsApp da IA *
            </Label>
            <Input
              value={formData.whatsapp_ai_phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(00) 00000-0000"
              className={`bg-gray-900/50 border-2 text-white text-lg py-6 ${
                formData.whatsapp_ai_phone && !isValidPhone(formData.whatsapp_ai_phone)
                  ? 'border-red-500/50 focus:border-red-500'
                  : formData.whatsapp_ai_phone && isValidPhone(formData.whatsapp_ai_phone)
                  ? 'border-green-500/50 focus:border-green-500'
                  : 'border-gray-600'
              }`}
              autoFocus
            />
            <p className="text-gray-400 text-sm">
              Este número será usado para conectar a IA que irá atender os clientes
            </p>
          </div>

          {/* Campo Obrigatório - Email para Login */}
          <div className="space-y-2">
            <Label className="text-white font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              Email para Login do Gestor *
            </Label>
            <Input
              type="email"
              value={formData.login_email}
              onChange={(e) => updateField('login_email', e.target.value)}
              placeholder="gestor@empresa.com"
              className={`bg-gray-900/50 border-2 text-white text-lg py-6 ${
                formData.login_email && !isValidEmail(formData.login_email)
                  ? 'border-red-500/50 focus:border-red-500'
                  : formData.login_email && isValidEmail(formData.login_email)
                  ? 'border-green-500/50 focus:border-green-500'
                  : 'border-gray-600'
              }`}
            />
            <p className="text-gray-400 text-sm">
              Email que será usado para fazer login no sistema. A senha será gerada automaticamente.
            </p>
          </div>

          {/* Campos Opcionais - Colapsável */}
          <div className="border-t border-gray-700 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowOptional(!showOptional)}
              className="w-full text-gray-400 hover:text-white justify-between"
            >
              <span>Campos opcionais</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                {showOptional ? 'Ocultar' : 'Mostrar'}
              </span>
            </Button>
            
            {showOptional && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label className="text-gray-300">Nome da Empresa</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Nome da empresa (opcional)"
                    className="bg-gray-900/50 border-gray-600 text-white"
                  />
                  <p className="text-gray-500 text-xs">Se não informado, será gerado automaticamente</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contato@empresa.com"
                      className="bg-gray-900/50 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">CNPJ</Label>
                    <Input
                      value={formData.cnpj}
                      onChange={(e) => updateField('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="bg-gray-900/50 border-gray-600 text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Telefone Comercial</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="bg-gray-900/50 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Cidade/Estado</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="São Paulo, SP"
                      className="bg-gray-900/50 border-gray-600 text-white"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h4 className="text-gray-300 font-medium mb-3">Configurações do Plano</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-sm">Plano</Label>
                      <Select value={formData.plan} onValueChange={(v) => updateField('plan', v)}>
                        <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-sm">Dias de Trial</Label>
                      <Select 
                        value={String(formData.trial_days)} 
                        onValueChange={(v) => updateField('trial_days', Number(v))}
                      >
                        <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="14">14 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-sm">Máx. Usuários</Label>
                      <Select 
                        value={String(formData.max_users)} 
                        onValueChange={(v) => updateField('max_users', Number(v))}
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
                          <SelectItem value="999">Ilimitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Criando empresa...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Criar Empresa
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Modal de Credenciais Criadas */}
      <Dialog open={!!createdCredentials} onOpenChange={(open) => {
        if (!open) {
          setCreatedCredentials(null);
          if (createdCredentials) {
            onSuccess(createdCredentials.email); // Passar email como ID temporário
          }
        }
      }}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Check className="h-5 w-5 text-green-400" />
              Empresa Criada com Sucesso!
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Credenciais de acesso para o gestor da empresa
            </DialogDescription>
          </DialogHeader>
          
          {createdCredentials && (
            <div className="space-y-4 mt-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-200 text-sm font-medium mb-2">
                  ⚠️ Anote estas credenciais! Elas não serão mostradas novamente.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Email</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdCredentials.email}
                      readOnly
                      className="bg-gray-900/50 border-gray-600 text-white font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.email);
                        toast.success('Email copiado!');
                      }}
                      className="border-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Senha</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={createdCredentials.password}
                      readOnly
                      className="bg-gray-900/50 border-gray-600 text-white font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="border-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.password);
                        toast.success('Senha copiada!');
                      }}
                      className="border-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Email: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`
                    );
                    toast.success('Credenciais copiadas!');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Tudo
                </Button>
                <Button
                  onClick={() => {
                    setCreatedCredentials(null);
                    onSuccess(createdCredentials.email);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminCompanyCreate;
