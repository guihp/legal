import React, { useEffect, useState } from 'react';
import { Instagram, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return `${'•'.repeat(8)}${s.slice(-4)}`;
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

  return (
    <Card className="border border-pink-500/25 bg-gradient-to-br from-pink-950/30 via-purple-950/20 to-indigo-950/25 text-foreground shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 20%,#d62976 45%,#962fbf 75%,#4f5bd5 100%)',
            }}
          >
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              Instagram (IA)
              <Badge variant="secondary" className="text-[10px] font-normal">
                Graph / Direct
              </Badge>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Conta vinculada à empresa para mensagens e fotos de perfil dos leads.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-muted-foreground shrink-0">ID Instagram (empresa)</span>
          <code className="rounded-md bg-background/80 px-2 py-1 text-xs font-mono break-all border border-border">
            {idInstagram}
          </code>
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Exibido no site vitrine (contato). O <span className="text-foreground font-medium">@</span> é adicionado automaticamente na página pública se você salvar sem ele.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              value={arrobaEmpresa}
              onChange={(e) => setArrobaEmpresa(e.target.value)}
              placeholder="minhaimobiliaria ou @minhaimobiliaria"
              className="sm:max-w-md font-mono text-sm"
            />
            <Button type="button" size="sm" onClick={() => void saveArroba()} disabled={savingArroba}>
              {savingArroba ? 'Salvando…' : 'Salvar @'}
            </Button>
          </div>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <Shield className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-foreground">Token Instagram</span>
            <p className="mt-0.5">
              {hasToken ? (
                <>
                  Configurado <span className="font-mono text-xs ml-1">{tokenPreview}</span>
                  <span className="block text-xs mt-1">
                    Usado pelo fluxo n8n para renovar <code className="text-[11px]">profile_pic_url_instagram</code> dos
                    leads.
                  </span>
                </>
              ) : (
                <>Não configurado — inclua <code className="text-xs">token_instagram</code> em empresas para o webhook de foto.</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
