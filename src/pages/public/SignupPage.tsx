import { useState, useEffect, useRef } from 'react';
import {
  Building2, Check, Loader2, Shield, AlertTriangle,
  Clock, Crown, Rocket, Zap, Users, FileText, ChevronDown,
  CreditCard, Lock, CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/integrations/supabase/invoke';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface SignupLinkData {
  id: string;
  token: string;
  plan: string;
  billing_cycle: string;
  price_monthly: number;
  price_total: number;
  max_users: number;
  status: string;
  expires_at: string;
  is_official_api: boolean;
}

const PLAN_META: Record<string, { name: string; badge: string; color: string; icon: React.ReactNode }> = {
  essential: { name: 'Essential', badge: '🥉', color: 'text-amber-400', icon: <Zap className="h-5 w-5" /> },
  growth: { name: 'Growth', badge: '🥈', color: 'text-blue-400', icon: <Rocket className="h-5 w-5" /> },
  professional: { name: 'Professional', badge: '🥇', color: 'text-purple-400', icon: <Crown className="h-5 w-5" /> },
};

const TERMS_TEXT = `TERMOS DE USO

IAFÉ IMOBI

Os presentes Termos de Uso ("Termos") regulam o acesso e a utilização da plataforma digital IAFÉ IMOBI ("Plataforma"), disponibilizada por IAFÉ TECNOLOGIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob n° 57.129.684/0001-43, com sede na Av. São Luis Rei De Franca, Dom Center, loja 28, São Luís, MA, CEP 65.065-470 ("Fornecedor").

A Plataforma destina-se exclusivamente a imobiliárias e corretores de imóveis regularmente habilitados ("Usuários").

Ao contratar ou utilizar a Plataforma, o Usuário declara estar ciente e de acordo com as disposições abaixo.

1. OBJETO DA PLATAFORMA

1.1. A Plataforma consiste em ferramenta tecnológica de:
• gestão de imóveis anunciados;
• captação automatizada de leads oriundos de sites e portais imobiliários;
• comunicação inicial automatizada com interessados via WhatsApp;
• organização de agendas de visitação;
• distribuição de atendimentos entre corretores/imobiliárias;
• sugestão automatizada de imóveis compatíveis com o perfil do interessado.

1.2. A Plataforma não atua como corretora de imóveis, não participa da negociação, não intermedia juridicamente a transação e não recebe comissões.

1.3. O Fornecedor presta exclusivamente serviço tecnológico de automação e organização de leads.

2. CADASTRO DE IMÓVEIS PELO USUÁRIO PROFISSIONAL

2.1. O Usuário será integralmente responsável por:
• inserir dados corretos, completos e atualizados dos imóveis;
• garantir que possui autorização para anunciá-los;
• manter atualizadas as informações comerciais, disponibilidade e condições.

2.2. O Fornecedor não valida titularidade, matrícula, preço ou condições dos imóveis cadastrados.

2.3. Toda responsabilidade legal pela oferta é exclusiva do Usuário.

3. CAPTAÇÃO AUTOMATIZADA DE INTERESSADOS (LEADS)

3.1. Quando um potencial cliente demonstrar interesse em imóvel anunciado em ambiente digital integrado pelo Usuário, a Plataforma:
• registrará automaticamente o lead;
• iniciará contato automatizado via WhatsApp, identificando-se como prestadora de serviço tecnológico do Usuário.

3.2. A mensagem inicial conterá:
• identificação clara da Plataforma;
• indicação do corretor ou imobiliária vinculada;
• referência ao interesse demonstrado pelo cliente;
• solicitação de consentimento para continuidade do atendimento automatizado.

3.3. Caso o cliente não autorize a continuidade:
• nenhuma nova comunicação será enviada pela Plataforma;
• os dados permanecerão apenas para registro de auditoria e cumprimento legal.

4. CONSENTIMENTO PARA COMUNICAÇÃO (OPT-IN / OPT-OUT)

4.1. A continuidade do atendimento automatizado dependerá de manifestação positiva do cliente.

4.2. O cliente poderá, a qualquer momento:
• solicitar interrupção das mensagens;
• optar por falar exclusivamente com o corretor humano;
• revogar consentimento.

4.3. A Plataforma manterá mecanismos de descadastramento imediato, em conformidade com a LGPD e boas práticas de comunicação eletrônica.

5. SUGESTÃO AUTOMATIZADA DE IMÓVEIS

5.1. Com base nas interações do interessado, a Plataforma poderá sugerir imóveis similares.

5.2. Tais sugestões são geradas por algoritmo e não constituem recomendação personalizada ou consultoria imobiliária.

6. GESTÃO DE AGENDAS E VISITAS

6.1. O Usuário deverá manter sua agenda atualizada na Plataforma.

6.2. O cliente poderá selecionar diretamente datas disponíveis apresentadas pelo sistema.

6.3. A confirmação do agendamento será automática e vinculante ao Usuário.

7. IMÓVEIS COM MÚLTIPLOS ANUNCIANTES

7.1. Quando um mesmo imóvel estiver cadastrado por mais de um corretor ou imobiliária, a Plataforma exibirá as agendas disponíveis, e o cliente escolherá a data desejada.

7.2. Havendo mais de um profissional disponível no mesmo dia e horário, a distribuição ocorrerá por randomização.

7.3. O Usuário declara ciência e concordância de que não há preferência, priorização ou favorecimento.

8. AUSÊNCIA DE GARANTIA DE RESULTADOS

8.1. O Fornecedor não garante volume mínimo de leads, conversão em vendas, fechamento de negócios ou exclusividade territorial.

8.2. A Plataforma é ferramenta de apoio tecnológico.

9. INTEGRAÇÕES

9.1. A Plataforma é integrada com WhatsApp (META), ASAAS (pagamentos) e Google Agenda (lembretes).

10. PROTEÇÃO DE DADOS PESSOAIS (LGPD)

10.1. O tratamento de dados observará a Lei nº 13.709/2018 (LGPD).

10.2. O Usuário atua como Controlador dos dados dos clientes; o Fornecedor atua como Operador.

10.3. Os dados serão utilizados exclusivamente para viabilizar contato, organizar visitas e registrar histórico.

10.5. A Plataforma adota medidas técnicas de segurança compatíveis com padrões de mercado.

11. RESPONSABILIDADES DO USUÁRIO

São obrigações do Usuário: manter registro profissional válido (CRECI); utilizar a Plataforma de forma ética e legal; não praticar spam; respeitar a privacidade dos leads; cumprir legislação imobiliária e consumerista.

12. LIMITAÇÃO DE RESPONSABILIDADE

O Fornecedor não responde por veracidade dos imóveis, negociações fora da Plataforma, conduta de corretores ou falhas externas.

13. REMUNERAÇÃO E ASSINATURA

13.1. O acesso é disponibilizado mediante assinatura recorrente.

13.2. A inadimplência poderá acarretar suspensão.

13.3. Em caso de cancelamento, a assinatura permanecerá válida até o vencimento.

14. PLANOS

14.1 Plano Essential – R$ 499,00/mês: CRM completo, IA & Automação, Captação de Leads, Integração WhatsApp.

14.2 Plano Growth – R$ 999,00/mês: Até 7 usuários, Gestão de equipe, IA para todos, Relatórios.

14.3 Plano Professional – R$ 1.499,00/mês: Até 15 usuários, Site premium, SEO, Marketing avançado, Suporte prioritário.

15. CADASTRO E USO

15.1. O Usuário realizará o cadastro e receberá código de verificação.

15.2. Os primeiros 7 dias são gratuitos. Após este período, inicia-se a cobrança automática.

16. DISPONIBILIDADE

16.1. A Plataforma poderá passar por atualizações e manutenções.

16.2. O Fornecedor não garante funcionamento ininterrupto.

17. ALTERAÇÕES

Estes Termos poderão ser atualizados a qualquer momento.

18. PROPRIEDADE INTELECTUAL

Todos os sistemas, algoritmos e interfaces pertencem exclusivamente ao Fornecedor.

19. LEGISLAÇÃO E FORO

Regidos pelas leis do Brasil. Foro: São Luís, MA.

IAFÉ TECNOLOGIA — comercial@iafeoficial.com
Versão: abril/2026`;

// Formatar telefone
const formatPhone = (value: string): string => {
  const n = value.replace(/\D/g, '');
  if (n.length <= 2) return n;
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
};

// Formatar CNPJ
const formatCnpj = (value: string): string => {
  const n = value.replace(/\D/g, '');
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
};

export default function SignupPage() {
  const { token } = useParams<{ token: string }>();
  const [linkData, setLinkData] = useState<SignupLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  // Form
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  // Payment card (mock — preparado para ASAAS)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  useEffect(() => {
    loadLink();
  }, [token]);

  const loadLink = async () => {
    try {
      setLoading(true);
      if (!token) { setError('Token inválido'); return; }

      const { data, error: fetchErr } = await supabase
        .from('signup_links' as any)
        .select('*')
        .eq('token', token)
        .single();

      if (fetchErr || !data) {
        setError('Link de cadastro não encontrado ou inválido.');
        return;
      }

      const link = data as any as SignupLinkData;

      if (link.status === 'used') {
        setError('Este link de cadastro já foi utilizado.');
        return;
      }

      if (new Date(link.expires_at) < new Date()) {
        setError('Este link de cadastro expirou. Solicite um novo link ao administrador.');
        return;
      }

      setLinkData(link);
    } catch (err: any) {
      setError('Erro ao carregar dados do link.');
    } finally {
      setLoading(false);
    }
  };

  // Detectar bandeira do cartão
  const getCardBrand = (number: string): string => {
    const n = number.replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^636|^438935|^504175|^451416|^509/.test(n)) return 'elo';
    return '';
  };

  const formatCardNumber = (value: string): string => {
    const n = value.replace(/\D/g, '').slice(0, 16);
    return n.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string): string => {
    const n = value.replace(/\D/g, '').slice(0, 4);
    if (n.length <= 2) return n;
    return `${n.slice(0, 2)}/${n.slice(2)}`;
  };

  const isCardValid = () => {
    const num = cardNumber.replace(/\D/g, '');
    return num.length >= 13 &&
      cardName.trim().length > 3 &&
      /^\d{2}\/\d{2}$/.test(cardExpiry) &&
      cardCvv.replace(/\D/g, '').length >= 3;
  };

  const isFormValid = () => {
    return companyName.trim().length > 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      isCardValid() &&
      acceptedTerms;
  };

  const handleSubmit = async () => {
    if (!linkData || !isFormValid()) return;

    setSubmitting(true);
    try {
      // 1. Criar empresa via Edge Function
      const { data: result, error: fnError } = await invokeEdge<any, any>('create-company-with-user', {
        body: {
          name: companyName.trim(),
          whatsapp_ai_phone: phone.replace(/\D/g, '') || '0',
          login_email: email.trim().toLowerCase(),
          cnpj: cnpj.trim() || null,
          address: address.trim() || null,
          plan: linkData.plan,
          trial_days: 7,
          max_users: linkData.max_users,
          is_official_api: linkData.is_official_api || false,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao criar empresa');
      if (!result?.success) throw new Error(result?.error || 'Erro desconhecido');

      // 2. Marcar link como usado
      await supabase
        .from('signup_links' as any)
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          company_name: companyName.trim(),
          company_email: email.trim().toLowerCase(),
          company_cnpj: cnpj.trim() || null,
          company_address: address.trim() || null,
          accepted_terms_at: new Date().toISOString(),
          company_id: result.company_id,
        } as any)
        .eq('id', linkData.id);

      setCredentials({
        email: result.email,
        password: result.password,
      });
      setSuccess(true);
      toast.success('Cadastro realizado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao finalizar cadastro');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Loading
  if (loading) {
    return (
      <div className="dark min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="dark min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Link Indisponível</h2>
            <p className="text-gray-400">{error}</p>
            <p className="text-gray-500 text-sm mt-4">
              Entre em contato: comercial@iafeoficial.com
            </p>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  // Success
  if (success && credentials) {
    return (
      <div className="dark min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Cadastro Realizado!</h2>
              <p className="text-gray-400">Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar.</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 text-left space-y-3">
              <div>
                <Label className="text-gray-400 text-xs">Email de acesso</Label>
                <p className="text-white font-mono text-sm">{credentials.email}</p>
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Senha temporária</Label>
                <p className="text-white font-mono text-sm">{credentials.password}</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-200 text-sm">
                ⚠️ Anote estas credenciais! Recomendamos alterar a senha após o primeiro acesso.
              </p>
            </div>

            <Button
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${credentials.email}\nSenha: ${credentials.password}`);
                toast.success('Credenciais copiadas!');
              }}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Copiar Credenciais
            </Button>

            <Button
              onClick={() => window.location.href = '/'}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              Acessar o Sistema
            </Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  // Form
  if (!linkData) return null;
  const planMeta = PLAN_META[linkData.plan] || PLAN_META.essential;

  return (
    <div
      className="dark min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 py-8 px-4"
      style={{
        // Forçar variáveis CSS do tema escuro para componentes shadcn
        '--card': '222.2 84% 4.9%',
        '--card-foreground': '210 40% 98%',
        '--background': '222.2 84% 4.9%',
        '--foreground': '210 40% 98%',
        '--popover': '222.2 84% 4.9%',
        '--popover-foreground': '210 40% 98%',
        '--primary': '217.2 91.2% 59.8%',
        '--primary-foreground': '222.2 47.4% 11.2%',
        '--muted': '217.2 32.6% 17.5%',
        '--muted-foreground': '215 20.2% 65.1%',
        '--border': '217.2 32.6% 17.5%',
        '--input': '217.2 32.6% 17.5%',
        '--ring': '224.3 76.3% 48%',
      } as React.CSSProperties}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-white">IAFÉ IMOBI</h1>
          </div>
          <p className="text-gray-400">Complete seu cadastro para acessar a plataforma</p>
        </div>

        {/* Plano Selecionado */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{planMeta.badge}</span>
                <div>
                  <h3 className={`text-lg font-bold ${planMeta.color}`}>Plano {planMeta.name}</h3>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Users className="h-3.5 w-3.5" />
                    <span>Até {linkData.max_users} {linkData.max_users === 1 ? 'usuário' : 'usuários'}</span>
                    <span>•</span>
                    <span>{linkData.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{formatCurrency(linkData.price_monthly)}</p>
                <p className="text-gray-400 text-xs">/mês</p>
              </div>
            </div>
            {linkData.billing_cycle === 'annual' && (
              <div className="mt-2 flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">10% desconto</Badge>
                <span className="text-green-400 text-sm">Total anual: {formatCurrency(linkData.price_total)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Nome da Empresa *</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Imobiliária São Paulo"
                className="bg-gray-900 border-gray-600 text-white placeholder-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Email para Login *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gestor@suaempresa.com"
                className="bg-gray-900 border-gray-600 text-white placeholder-gray-500"
              />
              <p className="text-gray-500 text-xs">Este email será usado para acessar o sistema</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">CNPJ</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Telefone comercial</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Endereço</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Cidade, Estado"
                className="bg-gray-900 border-gray-600 text-white placeholder-gray-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pagamento */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-400" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo de cobrança */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Plano</span>
                <span className="text-white font-medium text-sm">{planMeta.badge} {planMeta.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Cobrança</span>
                <span className="text-white text-sm">{linkData.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
              </div>
              {linkData.billing_cycle === 'annual' && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Desconto anual</span>
                  <span className="text-green-400 text-sm font-medium">-10%</span>
                </div>
              )}
              <div className="border-t border-green-500/20 pt-2 mt-1 flex justify-between items-center">
                <span className="text-white font-semibold">
                  {linkData.billing_cycle === 'monthly' ? 'Valor mensal' : 'Total anual'}
                </span>
                <span className="text-2xl font-bold text-white">
                  {formatCurrency(linkData.billing_cycle === 'monthly' ? linkData.price_monthly : linkData.price_total)}
                </span>
              </div>
              {linkData.billing_cycle === 'annual' && (
                <p className="text-green-400/70 text-xs text-right">
                  equivale a {formatCurrency(linkData.price_monthly)}/mês
                </p>
              )}
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] pt-1">
                <CalendarDays className="h-3 w-3" />
                <span>Primeira cobrança após 7 dias de teste gratuito</span>
              </div>
            </div>

            {/* Cartão de crédito */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-white flex items-center justify-between">
                  <span>Número do cartão *</span>
                  <div className="flex items-center gap-1.5">
                    {['visa', 'mastercard', 'elo', 'amex'].map(brand => (
                      <span
                        key={brand}
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          getCardBrand(cardNumber) === brand
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            : 'bg-gray-700/50 text-gray-500'
                        } transition-colors`}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-500 font-mono text-lg tracking-wider"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Nome no cartão *</Label>
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  placeholder="NOME COMO ESTÁ NO CARTÃO"
                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-500 uppercase tracking-wide"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Validade *</Label>
                  <Input
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/AA"
                    maxLength={5}
                    className="bg-gray-900 border-gray-600 text-white placeholder-gray-500 font-mono text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">CVV *</Label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="000"
                    maxLength={4}
                    type="password"
                    className="bg-gray-900 border-gray-600 text-white placeholder-gray-500 font-mono text-center"
                  />
                </div>
              </div>
            </div>

            {/* Segurança */}
            <div className="flex items-center gap-2 bg-gray-900/50 rounded-lg p-2.5">
              <Lock className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-gray-400 text-[11px]">
                Seus dados de pagamento são criptografados e processados de forma segura.
                Nenhuma cobrança será feita durante o período de teste.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Termos de Uso */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-amber-400" />
              Termos de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={termsRef}
              className={`bg-gray-900 rounded-lg p-4 overflow-y-auto transition-all duration-300 ${
                termsExpanded ? 'max-h-[400px]' : 'max-h-[150px]'
              }`}
            >
              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                {TERMS_TEXT}
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTermsExpanded(!termsExpanded)}
              className="w-full text-gray-400 hover:text-white"
            >
              <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${termsExpanded ? 'rotate-180' : ''}`} />
              {termsExpanded ? 'Recolher' : 'Expandir termos completos'}
            </Button>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                Li e aceito os <strong>Termos de Uso</strong> da plataforma IAFÉ IMOBI e declaro estar ciente das condições de uso, pagamento e responsabilidades descritas acima.
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Expiração */}
        <div className="flex items-center justify-center gap-2 text-amber-400/60 text-sm">
          <Clock className="h-4 w-4" />
          <span>
            Este link expira em {new Date(linkData.expires_at).toLocaleString('pt-BR')}
          </span>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !isFormValid()}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-6 text-lg disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Finalizando cadastro...
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Finalizar Cadastro
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs pb-4">
          IAFÉ TECNOLOGIA LTDA — CNPJ 57.129.684/0001-43 — comercial@iafeoficial.com
        </p>
      </div>
      <Toaster />
    </div>
  );
}
