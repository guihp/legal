import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Globe,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Hostname principal do app onde o site vitrine é servido.
 * Idealmente vem de env, mas fallback seguro pro produto.
 */
const DEFAULT_TARGET_CNAME =
  (import.meta as any)?.env?.VITE_CUSTOM_DOMAIN_TARGET ||
  (import.meta as any)?.env?.VITE_PUBLIC_SITE_DOMAIN ||
  'imobi.iafeoficial.com';

type DomainStatus = 'pending' | 'verifying' | 'verified' | 'active' | 'failed' | 'disabled';

type CustomDomain = {
  id: string;
  company_id: string;
  hostname: string;
  status: DomainStatus;
  verification_token: string;
  target_cname: string | null;
  verified_at: string | null;
  ssl_issued_at: string | null;
  last_check_at: string | null;
  last_error: string | null;
  created_at: string;
};

function statusBadge(status: DomainStatus) {
  switch (status) {
    case 'verified':
    case 'active':
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: 'Ativo',
        className: 'bg-emerald-600/20 text-emerald-300 border-emerald-700/50',
      };
    case 'pending':
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        label: 'Aguardando DNS',
        className: 'bg-amber-600/20 text-amber-300 border-amber-700/50',
      };
    case 'verifying':
      return {
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        label: 'Verificando',
        className: 'bg-blue-600/20 text-blue-300 border-blue-700/50',
      };
    case 'failed':
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: 'Falhou',
        className: 'bg-red-600/20 text-red-300 border-red-700/50',
      };
    case 'disabled':
    default:
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: 'Desabilitado',
        className: 'bg-gray-700/40 text-gray-400 border-gray-700',
      };
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 transition"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export function CustomDomainsSection({ companyId }: { companyId: string | null }) {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newHostname, setNewHostname] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_custom_domains' as never)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDomains((data as unknown as CustomDomain[]) || []);
    } catch (e: any) {
      toast.error('Não foi possível carregar os domínios.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const handleAdd = async () => {
    if (!companyId) return;
    const cleaned = newHostname
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');

    // Validação básica
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) {
      toast.error('Domínio inválido. Use algo como "site.jastelo.com.br".');
      return;
    }
    if (cleaned.length < 4 || cleaned.length > 253) {
      toast.error('Domínio fora do tamanho permitido.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('company_custom_domains' as never).insert({
        company_id: companyId,
        hostname: cleaned,
        target_cname: DEFAULT_TARGET_CNAME,
        status: 'pending',
      });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('unique')) {
          toast.error('Esse domínio já está cadastrado (aqui ou em outra empresa).');
        } else {
          toast.error(error.message || 'Não foi possível cadastrar o domínio.');
        }
        return;
      }
      toast.success('Domínio cadastrado. Siga as instruções de DNS abaixo.');
      setNewHostname('');
      setAddOpen(false);
      await loadDomains();
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (domain: CustomDomain) => {
    setVerifyingId(domain.id);
    try {
      // Marca como "verifying" para feedback visual
      await supabase
        .from('company_custom_domains' as never)
        .update({ status: 'verifying' })
        .eq('id', domain.id);

      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      if (!accessToken) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const supaUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL || '';
      const endpoint = `${String(supaUrl).replace(/\/$/, '')}/functions/v1/verify-custom-domain`;

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ domain_id: domain.id }),
      });

      const result = await r.json().catch(() => ({}));
      if (r.ok && result?.ok) {
        toast.success('DNS verificado com sucesso! O site já pode ser acessado pelo novo domínio.');
      } else {
        const err = Array.isArray(result?.errors) ? result.errors.join(' | ') : result?.error;
        toast.error(err || 'Verificação falhou. Confira se o DNS foi publicado.');
      }
      await loadDomains();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao verificar DNS.');
      await loadDomains();
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRemove = async (domain: CustomDomain) => {
    if (!confirm(`Remover o domínio ${domain.hostname}? O site deixará de responder por esse endereço.`)) {
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      if (!accessToken) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const supaUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL || '';
      const endpoint = `${String(supaUrl).replace(/\/$/, '')}/functions/v1/remove-custom-domain`;

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ domain_id: domain.id }),
      });

      const result = await r.json().catch(() => ({}));
      if (r.ok && result?.ok) {
        toast.success('Domínio removido com sucesso.');
      } else {
        toast.error(result?.error || 'Erro ao remover domínio.');
        return;
      }
      await loadDomains();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover domínio.');
      await loadDomains();
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 lg:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Domínio próprio (white-label)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Aponte o domínio da imobiliária (ex: <code className="text-gray-400">site.jastelo.com.br</code>)
            pro site vitrine. Assim o site abre direto no domínio dela, sem aparecer imobi.iafeoficial.com.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Adicionar domínio
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Carregando…</p>
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 px-4 border border-dashed border-gray-800 rounded-lg">
          <Globe className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 max-w-md">
            Nenhum domínio próprio cadastrado. O site vitrine continua acessível por{' '}
            <code className="text-gray-300">imobi.iafeoficial.com/s/seu-slug</code>.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Clique em <strong>Adicionar domínio</strong> pra cadastrar um CNAME/subdomínio da sua imobiliária.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => {
            const badge = statusBadge(d.status);
            const txtRecordName = `_iafe-verify.${d.hostname}`;
            const target = d.target_cname || DEFAULT_TARGET_CNAME;
            const isApex = d.hostname.split('.').length === 2; // ex: jastelo.com.br → 3 partes; abc.com → 2
            return (
              <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-950/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-sm font-semibold text-white truncate">{d.hostname}</code>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(d.status === 'verified' || d.status === 'active') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://${d.hostname}`, '_blank', 'noopener')}
                        className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700 h-8"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Abrir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(d)}
                      disabled={verifyingId === d.id}
                      className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700 h-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${verifyingId === d.id ? 'animate-spin' : ''}`} />
                      Verificar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemove(d)}
                      className="border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40 h-8"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Instruções de DNS */}
                {(d.status === 'pending' || d.status === 'verifying' || d.status === 'failed') && (
                  <div className="px-4 py-3 bg-gray-900/40 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-blue-300">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        No painel DNS (<strong>Hostinger</strong>, Cloudflare, Registro.br, etc.) adicione os
                        2 registros abaixo. Após publicar, clique em <strong>Verificar</strong>. A propagação
                        DNS pode levar de 5 minutos a algumas horas.
                      </span>
                    </div>

                    {/* Registro 1: CNAME / A */}
                    <div className="rounded-md border border-gray-800 bg-gray-950 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Registro 1 · {isApex ? 'A / ALIAS' : 'CNAME'} (aponta o site)
                        </div>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-xs">
                        <span className="text-gray-500">Tipo</span>
                        <code className="text-gray-100 font-mono">
                          {isApex ? 'A (ou ALIAS/ANAME se suportado)' : 'CNAME'}
                        </code>
                        <span />
                        <span className="text-gray-500">Nome</span>
                        <code className="text-gray-100 font-mono break-all">{d.hostname}</code>
                        <CopyButton value={d.hostname} />
                        <span className="text-gray-500">Valor</span>
                        <code className="text-emerald-300 font-mono break-all">{target}</code>
                        <CopyButton value={target} />
                      </div>
                      {isApex && (
                        <p className="text-[11px] text-amber-300 mt-2 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          Domínios raiz (sem subdomínio) não aceitam CNAME direto. Use ALIAS/ANAME se seu
                          provedor suportar, ou peça pro suporte da imobiliária usar um subdomínio como
                          <code className="text-amber-200 px-1">www.{d.hostname}</code> ou
                          <code className="text-amber-200 px-1">site.{d.hostname}</code>.
                        </p>
                      )}
                    </div>

                    {/* Registro 2: TXT de verificação */}
                    <div className="rounded-md border border-gray-800 bg-gray-950 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Registro 2 · TXT (verificação de posse)
                        </div>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-xs">
                        <span className="text-gray-500">Tipo</span>
                        <code className="text-gray-100 font-mono">TXT</code>
                        <span />
                        <span className="text-gray-500">Nome</span>
                        <code className="text-gray-100 font-mono break-all">{txtRecordName}</code>
                        <CopyButton value={txtRecordName} />
                        <span className="text-gray-500">Valor</span>
                        <code className="text-emerald-300 font-mono break-all">
                          {d.verification_token}
                        </code>
                        <CopyButton value={d.verification_token} />
                      </div>
                    </div>

                    {d.last_error && d.status === 'failed' && (
                      <div className="flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <strong>Última verificação falhou.</strong> {d.last_error}
                        </div>
                      </div>
                    )}

                    {d.last_check_at && (
                      <p className="text-[11px] text-gray-500">
                        Última verificação:{' '}
                        {new Date(d.last_check_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                )}

                {(d.status === 'verified' || d.status === 'active') && (
                  <div className="px-4 py-3 bg-emerald-950/20 flex items-start gap-2 text-xs text-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      Domínio verificado. O site vitrine está sendo servido em{' '}
                      <code className="text-emerald-100">https://{d.hostname}</code>.
                      {!d.ssl_issued_at && (
                        <span className="block text-emerald-300/80 mt-1">
                          Se o HTTPS ainda não estiver ativo, aguarde alguns minutos pra o proxy emitir o
                          certificado (Let's Encrypt).
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de adicionar */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar domínio próprio</DialogTitle>
            <DialogDescription className="text-gray-400">
              Cadastre o domínio que a imobiliária já comprou (Hostinger, Registro.br, GoDaddy, etc.).
              Nós vamos gerar as instruções de DNS pra você configurar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Domínio completo</label>
              <Input
                value={newHostname}
                onChange={(e) => setNewHostname(e.target.value)}
                placeholder="site.jastelo.com.br"
                className="bg-gray-900 border-gray-700 text-white"
                autoFocus
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Sem <code>http://</code>. Pode ser subdomínio (<code>site.exemplo.com</code>) ou domínio
                raiz (<code>exemplo.com</code>). Recomendamos subdomínio — é mais simples de configurar.
              </p>
            </div>

            <div className="rounded-md border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                Após cadastrar, você receberá as instruções de DNS (CNAME + TXT) pra colar no painel da
                Hostinger. A verificação é feita quando você clicar em <strong>Verificar</strong>.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !newHostname.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? 'Cadastrando…' : 'Cadastrar e ver DNS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomDomainsSection;
