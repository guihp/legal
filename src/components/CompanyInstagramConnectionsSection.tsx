import React, { useEffect, useState } from 'react';
import { Instagram, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function maskToken(token: string): string {
  const s = token.trim();
  if (!s) return '—';
  if (s.length <= 6) return '••••••';
  return `${'•'.repeat(12)}${s.slice(-4)}`;
}

/**
 * Em /connections: mostra bloco Instagram só quando `companies.id_instagram` está preenchido.
 */
export function CompanyInstagramConnectionsSection() {
  const { profile } = useUserProfile();
  const [loaded, setLoaded] = useState(false);
  const [idInstagram, setIdInstagram] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [arrobaEmpresa, setArrobaEmpresa] = useState('');
  const [savingArroba, setSavingArroba] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!profile?.company_id) {
        if (!cancelled) setLoaded(true);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id_instagram, token_instagram, arroba_instagram_empresa')
          .eq('id', profile.company_id)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setIdInstagram(null);
          setHasToken(false);
          setTokenPreview(null);
          return;
        }
        const idIg = data.id_instagram != null ? String(data.id_instagram).trim() : '';
        const tok = data.token_instagram != null ? String(data.token_instagram).trim() : '';
        const arroba = data.arroba_instagram_empresa != null ? String(data.arroba_instagram_empresa).trim() : '';
        setIdInstagram(idIg || null);
        setHasToken(tok.length > 0);
        setTokenPreview(tok ? maskToken(tok) : null);
        setArrobaEmpresa(arroba);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [profile?.company_id]);

  if (!loaded || !idInstagram) return null;

  const saveArroba = async () => {
    if (!profile?.company_id) return;
    setSavingArroba(true);
    try {
      const v = arrobaEmpresa.trim() || null;
      const { error } = await supabase.from('companies').update({ arroba_instagram_empresa: v }).eq('id', profile.company_id);
      if (error) throw error;
      toast.success('Instagram da empresa atualizado.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingArroba(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(idInstagram);
      toast.success('ID copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleRenewTokenInfo = () => {
    toast.info(
      'A renovação do token Instagram é feita pelo fluxo n8n. Atualize token_instagram na empresa ou acione o integrador.',
      { duration: 6000 },
    );
  };

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)',
              }}
            >
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Instagram</h2>
                <Badge className="rounded-md bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100 text-[10px] font-bold uppercase tracking-wide dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800">
                  Graph / Direct
                </Badge>
              </div>
            </div>
          </div>
          <Badge className="rounded-md bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-wide dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-1.5 inline-block" />
            Ativo
          </Badge>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            ID Instagram (empresa)
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
            <code className="flex-1 text-sm font-mono text-foreground break-all">{idInstagram}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void copyId()}
              className="shrink-0 text-emerald-800 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            @ exibido no site vitrine
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <Input
                value={arrobaEmpresa.replace(/^@+/, '')}
                onChange={(e) => setArrobaEmpresa(e.target.value.replace(/^@+/, ''))}
                placeholder="minhaimobiliaria"
                className="pl-7 rounded-xl bg-card font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void saveArroba()}
              disabled={savingArroba}
              className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 sm:min-w-[96px]"
            >
              {savingArroba ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Token Instagram
            </span>
            {hasToken ? (
              <Badge className="rounded-md bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-md text-[10px] font-semibold">
                Não configurado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
            <code className="flex-1 text-sm font-mono text-muted-foreground truncate">
              {hasToken ? tokenPreview : '—'}
            </code>
            {hasToken ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRenewTokenInfo}
                className="shrink-0 text-emerald-800 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
              >
                Renovar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
