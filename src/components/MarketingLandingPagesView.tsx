import { useEffect, useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, Layers, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type LpRow = {
  id: string;
  slug: string;
  is_published: boolean;
  views: number | null;
  property_id: number;
  custom_color: string | null;
  imoveisvivareal: {
    listing_id: string | null;
    bairro: string | null;
    cidade: string | null;
    tipo_imovel: string | null;
  } | null;
};

export function MarketingLandingPagesView() {
  const { profile } = useUserProfile();
  const [rows, setRows] = useState<LpRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_landing_pages')
        .select(
          `
          id,
          slug,
          is_published,
          views,
          property_id,
          custom_color,
          imoveisvivareal ( listing_id, bairro, cidade, tipo_imovel )
        `
        )
        .eq('company_id', profile.company_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRows((data as unknown as LpRow[]) || []);
    } catch (e: unknown) {
      console.error(e);
      toast.error('Não foi possível carregar as landing pages.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.company_id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Layers className="h-8 w-8 text-blue-500" />
            Landing pages dos imóveis
          </h1>
          <p className="text-gray-400 mt-1 max-w-2xl">
            Todas as LPs da sua empresa. Para criar ou editar, abra o imóvel em{' '}
            <strong className="text-gray-200">Propriedades</strong> e use o bloco de Landing Page no detalhe.
          </p>
        </div>
        <Button variant="outline" className="border-gray-600 text-gray-200" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 px-6 text-center text-gray-400">
            Nenhuma landing page cadastrada ainda. Publique uma LP a partir do card do imóvel em Propriedades.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-300">Imóvel</TableHead>
                <TableHead className="text-gray-300">Slug (URL)</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300 text-right">Views</TableHead>
                <TableHead className="text-gray-300 text-right">Público</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const loc = [r.imoveisvivareal?.bairro, r.imoveisvivareal?.cidade].filter(Boolean).join(', ');
                const label =
                  r.imoveisvivareal?.tipo_imovel ||
                  r.imoveisvivareal?.listing_id ||
                  `Imóvel #${r.property_id}`;
                return (
                  <TableRow key={r.id} className="border-gray-800">
                    <TableCell className="text-gray-200">
                      <div className="font-medium">{label}</div>
                      {loc && <div className="text-xs text-gray-500">{loc}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-blue-300">/imovel/{r.slug}</TableCell>
                    <TableCell>
                      {r.is_published ? (
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30">Publicada</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-800 text-gray-400">
                          Rascunho
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">{r.views ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {r.is_published ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => window.open(`/imovel/${r.slug}`, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir
                        </Button>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
