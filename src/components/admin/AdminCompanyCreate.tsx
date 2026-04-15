import { useState, useEffect } from 'react';
import {
  ArrowLeft, Check, Loader2, Link as LinkIcon, Copy, Clock,
  Crown, Rocket, Zap, Calendar, Users, ExternalLink, Trash2, RefreshCw,
  Wifi, Building2, Mail, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminCompanyCreateProps {
  onBack: () => void;
  onSuccess: (companyId: string) => void;
}

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  icon: React.ReactNode;
  accentColor: string;
  borderClass: string;
  selectedBorderClass: string;
  badgeClass: string;
  maxUsers: number;
  badge: string;
  features: string[];
}

interface SignupLink {
  id: string;
  token: string;
  plan: string;
  billing_cycle: string;
  price_monthly: number;
  price_total: number;
  status: string;
  expires_at: string;
  company_name: string | null;
  company_email: string | null;
  company_cnpj: string | null;
  company_address: string | null;
  used_at: string | null;
  created_at: string;
  is_official_api: boolean;
}

const PLANS: PlanInfo[] = [
  {
    id: 'essential',
    name: 'Essential',
    price: 499,
    icon: <Zap className="h-5 w-5" />,
    accentColor: 'text-amber-400',
    borderClass: 'border-gray-700 hover:border-amber-500/50',
    selectedBorderClass: 'border-amber-500 ring-2 ring-amber-500/30',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    maxUsers: 1,
    badge: '🥉',
    features: [
      'CRM Imobiliário completo',
      'IA & Automação básica',
      'Captação de leads',
      'Integração com WhatsApp',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 999,
    icon: <Rocket className="h-5 w-5" />,
    accentColor: 'text-blue-400',
    borderClass: 'border-gray-700 hover:border-blue-500/50',
    selectedBorderClass: 'border-blue-500 ring-2 ring-blue-500/30',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    maxUsers: 7,
    badge: '🥈',
    features: [
      'Até 7 usuários',
      'Gestão de equipe + ranking',
      'IA para todos os usuários',
      'Relatórios de performance',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 1499,
    icon: <Crown className="h-5 w-5" />,
    accentColor: 'text-purple-400',
    borderClass: 'border-gray-700 hover:border-purple-500/50',
    selectedBorderClass: 'border-purple-500 ring-2 ring-purple-500/30',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    maxUsers: 15,
    badge: '🥇',
    features: [
      'Até 15 usuários',
      'Site imobiliário premium',
      'SEO + Marketing avançado',
      'Suporte prioritário',
    ],
  },
];

const ANNUAL_DISCOUNT = 0.10;

// Helper: URL base para links (produção ou localhost)
function getBaseUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
  // Em dev (localhost), usar origin local. Em produção, usar a variável de ambiente.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin;
  }
  return envUrl?.replace(/\/$/, '') || window.location.origin;
}

export function AdminCompanyCreate({ onBack, onSuccess }: AdminCompanyCreateProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isOfficialApi, setIsOfficialApi] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [existingLinks, setExistingLinks] = useState<SignupLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);

  useEffect(() => { loadLinks(); }, []);

  const loadLinks = async () => {
    try {
      setLoadingLinks(true);
      const { data, error } = await supabase
        .from('signup_links' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        const now = new Date();
        const links = (data as any[]).map((link: any) => ({
          ...link,
          status: link.status === 'pending' && new Date(link.expires_at) < now ? 'expired' : link.status,
        }));
        setExistingLinks(links);
      }
    } catch (err) {
      console.error('Erro ao carregar links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const plan = PLANS.find(p => p.id === selectedPlan);

  const getPrice = () => {
    if (!plan) return { monthly: 0, total: 0 };
    if (billingCycle === 'annual') {
      const monthly = Math.round(plan.price * (1 - ANNUAL_DISCOUNT) * 100) / 100;
      return { monthly, total: Math.round(monthly * 12 * 100) / 100 };
    }
    return { monthly: plan.price, total: plan.price };
  };

  const prices = getPrice();

  const handleGenerateLink = async () => {
    if (!plan) return;

    setGenerating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('signup_links' as any)
        .insert({
          plan: plan.id,
          billing_cycle: billingCycle,
          price_monthly: prices.monthly,
          price_total: prices.total,
          max_users: plan.maxUsers,
          is_official_api: isOfficialApi,
          expires_at: expiresAt.toISOString(),
          created_by: userData?.user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const baseUrl = getBaseUrl();
      const link = `${baseUrl}/cadastro/${(data as any).token}`;
      setGeneratedLink(link);
      toast.success('Link gerado com sucesso!');
      loadLinks();
    } catch (err: any) {
      console.error('Erro ao gerar link:', err);
      toast.error('Erro ao gerar link: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleDeleteLink = async (id: string) => {
    try {
      await supabase.from('signup_links' as any).delete().eq('id', id);
      toast.success('Link removido');
      loadLinks();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Aguardando</Badge>;
      case 'used': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Cadastrado</Badge>;
      case 'expired': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Expirado</Badge>;
      default: return null;
    }
  };

  const getPlanInfo = (planId: string) => PLANS.find(pl => pl.id === planId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <LinkIcon className="h-8 w-8 text-blue-400" />
            Gerar Link de Cadastro
          </h1>
          <p className="text-gray-400 mt-1">
            Selecione o plano e gere um link exclusivo para o novo cliente (expira em 24h)
          </p>
        </div>
      </div>

      {/* Step 1: Escolher Plano */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-bold">1</span>
          Escolha o Plano
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isSelected = selectedPlan === p.id;
            return (
              <Card
                key={p.id}
                onClick={() => { setSelectedPlan(p.id); setGeneratedLink(null); }}
                className={`cursor-pointer transition-all duration-200 bg-gray-900 border-2 ${
                  isSelected ? p.selectedBorderClass : p.borderClass
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.badge}</span>
                      <CardTitle className={`text-base ${p.accentColor}`}>{p.name}</CardTitle>
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <span className="text-2xl font-bold text-white">{formatCurrency(p.price)}</span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Users className="h-3 w-3" />
                    <span>{p.maxUsers === 1 ? '1 usuário' : `Até ${p.maxUsers} usuários`}</span>
                  </div>
                  <ul className="space-y-1.5 border-t border-gray-800 pt-3">
                    {p.features.map((f, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Step 2: Ciclo de Cobrança */}
      {selectedPlan && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-bold">2</span>
            Ciclo de Cobrança
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <Card
              onClick={() => { setBillingCycle('monthly'); setGeneratedLink(null); }}
              className={`cursor-pointer transition-all duration-200 bg-gray-900 border-2 ${
                billingCycle === 'monthly' ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <CardContent className="p-4 text-center">
                <Calendar className={`h-5 w-5 mx-auto mb-2 ${billingCycle === 'monthly' ? 'text-blue-400' : 'text-gray-500'}`} />
                <p className="text-white font-semibold text-sm">Mensal</p>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(plan!.price)}</p>
                <p className="text-gray-500 text-xs">/mês</p>
              </CardContent>
            </Card>

            <Card
              onClick={() => { setBillingCycle('annual'); setGeneratedLink(null); }}
              className={`cursor-pointer transition-all duration-200 bg-gray-900 border-2 relative ${
                billingCycle === 'annual' ? 'border-green-500 ring-1 ring-green-500/30' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="absolute -top-2.5 right-3">
                <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 border-0">-10%</Badge>
              </div>
              <CardContent className="p-4 text-center">
                <Calendar className={`h-5 w-5 mx-auto mb-2 ${billingCycle === 'annual' ? 'text-green-400' : 'text-gray-500'}`} />
                <p className="text-white font-semibold text-sm">Anual</p>
                <p className="text-xl font-bold text-white mt-1">
                  {formatCurrency(Math.round(plan!.price * (1 - ANNUAL_DISCOUNT) * 100) / 100)}
                </p>
                <p className="text-gray-500 text-xs">/mês</p>
                <p className="text-green-400 text-[10px] mt-1">
                  Total: {formatCurrency(Math.round(plan!.price * (1 - ANNUAL_DISCOUNT) * 12 * 100) / 100)}/ano
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 3: Opções + Gerar Link */}
      {selectedPlan && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-bold">3</span>
            Opções e Geração
          </h2>

          <Card className="bg-gray-900 border-gray-700 max-w-lg">
            <CardContent className="p-6 space-y-5">
              {/* Toggle API Oficial */}
              <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-400" />
                  <div>
                    <Label className="text-white text-sm font-medium">API Oficial do WhatsApp</Label>
                    <p className="text-gray-500 text-xs">Ativar integração com Meta Business API</p>
                  </div>
                </div>
                <Switch
                  checked={isOfficialApi}
                  onCheckedChange={setIsOfficialApi}
                  className="group data-[state=unchecked]:border data-[state=unchecked]:border-gray-400/60 data-[state=unchecked]:bg-white data-[state=checked]:border-green-600 data-[state=checked]:bg-green-500 [&>span]:bg-gray-500 [&>span]:shadow-sm group-data-[state=checked]:[&>span]:bg-white group-data-[state=checked]:[&>span]:shadow-md"
                />
              </div>

              {/* Resumo */}
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plano</span>
                  <span className="text-white font-medium">{plan!.badge} {plan!.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Ciclo</span>
                  <span className="text-white font-medium">{billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Valor mensal</span>
                  <span className="text-white font-bold">{formatCurrency(prices.monthly)}</span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                    <span className="text-gray-400">Total anual</span>
                    <span className="text-green-400 font-bold">{formatCurrency(prices.total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Usuários</span>
                  <span className="text-white">{plan!.maxUsers}</span>
                </div>
                {isOfficialApi && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">WhatsApp</span>
                    <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">API Oficial</Badge>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                  <span className="text-gray-400">Expiração do link</span>
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 24 horas
                  </span>
                </div>
              </div>

              {/* Botão Gerar */}
              {!generatedLink ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={generating}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-5 text-base"
                >
                  {generating ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Gerando...</>
                  ) : (
                    <><LinkIcon className="h-5 w-5 mr-2" /> Gerar Link de Cadastro</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                    <Check className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <p className="text-green-300 text-sm font-medium">Link gerado com sucesso!</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={generatedLink}
                      readOnly
                      className="flex-1 bg-gray-800 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 font-mono truncate"
                    />
                    <Button onClick={() => handleCopyLink(generatedLink)} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                      <Copy className="h-4 w-4 mr-1" /> Copiar
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => { setGeneratedLink(null); setSelectedPlan(null); }}
                    className="w-full border-gray-600 text-gray-300 hover:text-white"
                  >
                    Gerar Outro Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Links Existentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Links Gerados
          </h2>
          <Button variant="ghost" size="sm" onClick={loadLinks} className="text-gray-400 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>

        {loadingLinks ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 text-gray-400 animate-spin mx-auto" />
          </div>
        ) : existingLinks.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-8 text-center">
              <LinkIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">Nenhum link gerado ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {existingLinks.map((link) => {
              const baseUrl = getBaseUrl();
              const linkUrl = `${baseUrl}/cadastro/${link.token}`;
              const expiresAt = new Date(link.expires_at);
              const isActive = link.status === 'pending' && expiresAt > new Date();
              const pInfo = getPlanInfo(link.plan);

              return (
                <Card key={link.id} className={`border bg-gray-900 ${
                  link.status === 'used' ? 'border-green-500/30' :
                  isActive ? 'border-gray-700' :
                  'border-gray-800 opacity-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Linha 1: Plano + ciclo + preço + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {pInfo && <Badge className={`${pInfo.badgeClass} text-[10px]`}>{pInfo.badge} {pInfo.name}</Badge>}
                          <span className="text-gray-500 text-xs">{link.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                          <span className="text-gray-500 text-xs">•</span>
                          <span className="text-white text-xs font-medium">{formatCurrency(link.price_monthly)}/mês</span>
                          {link.is_official_api && (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">API Oficial</Badge>
                          )}
                          {getStatusBadge(isActive ? 'pending' : link.status)}
                        </div>

                        {/* Dados do cliente (quando usado) */}
                        {link.status === 'used' && link.company_name && (
                          <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-2.5 space-y-1">
                            <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                              <Check className="h-3 w-3" /> Cliente cadastrado
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              <p className="text-gray-300 text-xs flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-gray-500" /> {link.company_name}
                              </p>
                              {link.company_email && (
                                <p className="text-gray-300 text-xs flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-gray-500" /> {link.company_email}
                                </p>
                              )}
                              {link.company_cnpj && (
                                <p className="text-gray-300 text-xs flex items-center gap-1">
                                  <Building2 className="h-3 w-3 text-gray-500" /> {link.company_cnpj}
                                </p>
                              )}
                              {link.company_address && (
                                <p className="text-gray-300 text-xs flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-gray-500" /> {link.company_address}
                                </p>
                              )}
                            </div>
                            {link.used_at && (
                              <p className="text-gray-500 text-[10px]">
                                Cadastrado em {new Date(link.used_at).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Expiração */}
                        {isActive && (
                          <p className="text-amber-400/60 text-[10px]">
                            Expira em {expiresAt.toLocaleString('pt-BR')}
                          </p>
                        )}
                        {link.status === 'expired' && (
                          <p className="text-red-400/60 text-[10px]">Expirou em {expiresAt.toLocaleString('pt-BR')}</p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isActive && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyLink(linkUrl)}
                              className="text-gray-400 hover:text-white h-8 w-8 p-0" title="Copiar link">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => window.open(linkUrl, '_blank')}
                              className="text-gray-400 hover:text-white h-8 w-8 p-0" title="Abrir link">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteLink(link.id)}
                          className="text-gray-500 hover:text-red-400 h-8 w-8 p-0" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCompanyCreate;
