import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MousePointerClick, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  endOfDay,
  startOfDay,
  subDays,
  format,
  startOfWeek,
  startOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { REFERRER_KIND_LABELS, type ReferrerKind } from '@/lib/publicSiteVisit';

type VisitRow = {
  created_at: string;
  referrer_kind: string;
  page_type: string;
};

function bucketKey(d: Date, mode: 'day' | 'week' | 'month'): string {
  if (mode === 'day') return format(d, 'yyyy-MM-dd');
  if (mode === 'week') return format(startOfWeek(d, { locale: ptBR }), 'yyyy-MM-dd');
  return format(startOfMonth(d), 'yyyy-MM');
}

function bucketLabel(key: string, mode: 'day' | 'week' | 'month'): string {
  if (mode === 'day') {
    const d = parseISO(key);
    return format(d, 'dd/MM', { locale: ptBR });
  }
  if (mode === 'week') {
    const d = parseISO(key);
    return `Sem. ${format(d, 'dd/MM', { locale: ptBR })}`;
  }
  const d = parseISO(`${key}-01`);
  return format(d, 'MMM yyyy', { locale: ptBR });
}

export function MarketingTrafficSection({ companyId }: { companyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [summary7d, setSummary7d] = useState<number | null>(null);

  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [fromStr, setFromStr] = useState(() => format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [toStr, setToStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  const range = useMemo(() => {
    let from: Date;
    let to: Date = endOfDay(new Date());
    if (preset === 'today') {
      from = startOfDay(new Date());
    } else if (preset === '7d') {
      from = startOfDay(subDays(new Date(), 6));
    } else if (preset === '30d') {
      from = startOfDay(subDays(new Date(), 29));
    } else {
      from = startOfDay(parseISO(fromStr));
      to = endOfDay(parseISO(toStr));
    }
    return { from, to };
  }, [preset, fromStr, toStr]);

  const loadVisits = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_site_visits' as never)
        .select('created_at, referrer_kind, page_type')
        .eq('company_id', companyId)
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRows((data as VisitRow[]) || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, range.from, range.to]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const from = startOfDay(subDays(new Date(), 6));
      const to = endOfDay(new Date());
      const { count } = await supabase
        .from('public_site_visits' as never)
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      setSummary7d(count ?? 0);
    })();
  }, [companyId]);

  useEffect(() => {
    if (open && companyId) loadVisits();
  }, [open, companyId, loadVisits]);

  const chartData = useMemo(() => {
    const { from, to } = range;
    let bucketDates: Date[] = [];
    if (granularity === 'day') {
      bucketDates = eachDayOfInterval({ start: from, end: to });
    } else if (granularity === 'week') {
      bucketDates = eachWeekOfInterval({ start: from, end: to }, { locale: ptBR });
    } else {
      bucketDates = eachMonthOfInterval({ start: from, end: to });
    }

    const counts = new Map<string, number>();
    for (const d of bucketDates) {
      counts.set(bucketKey(d, granularity), 0);
    }

    for (const r of rows) {
      const d = parseISO(r.created_at);
      if (d < from || d > to) continue;
      const k = bucketKey(d, granularity);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    return bucketDates.map((d) => {
      const k = bucketKey(d, granularity);
      return {
        label: bucketLabel(k, granularity),
        visitas: counts.get(k) || 0,
        key: k,
      };
    });
  }, [rows, range, granularity]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = (r.referrer_kind || 'other') as ReferrerKind;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => ({
        kind,
        n,
        label: REFERRER_KIND_LABELS[kind as ReferrerKind] || kind,
      }));
  }, [rows]);

  const total = rows.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-left w-full transition hover:border-emerald-700/50 hover:bg-gray-900/90 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
      >
        <TrendingUp className="h-8 w-8 text-emerald-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Visitas ao site</h3>
        <p className="text-gray-400 text-sm mb-4">
          Veja quantas pessoas acessaram o vitrine e as landing pages, de onde vieram (Google, redes,
          direto ou outro site) e o volume por dia, semana ou mês com filtro de datas.
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-emerald-400 text-sm font-medium">
            {summary7d === null ? '…' : `${summary7d} visitas nos últimos 7 dias`}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MousePointerClick className="h-4 w-4" />
            Clique para analisar
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-950 text-white">
          <DialogHeader>
            <DialogTitle>Tráfego e visitas</DialogTitle>
            <DialogDescription className="text-gray-400">
              Contagem de carregamentos das páginas públicas (site vitrine e LPs). A origem usa o
              navegador (referrer); tráfego direto ou apps podem aparecer como &quot;direto&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select
                value={preset}
                onValueChange={(v) => {
                  setPreset(v as typeof preset);
                  if (v === 'today') {
                    const t = format(new Date(), 'yyyy-MM-dd');
                    setFromStr(t);
                    setToStr(t);
                  } else if (v === '7d') {
                    setFromStr(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
                    setToStr(format(new Date(), 'yyyy-MM-dd'));
                  } else if (v === '30d') {
                    setFromStr(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
                    setToStr(format(new Date(), 'yyyy-MM-dd'));
                  }
                }}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={granularity} onValueChange={(v) => setGranularity(v as typeof granularity)}>
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>De</Label>
                <Input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
              <Button variant="secondary" className="bg-emerald-700 hover:bg-emerald-600" onClick={loadVisits}>
                Aplicar
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <p className="text-sm text-gray-400 mb-2">Total no período: <strong className="text-white">{total}</strong></p>
            {loading ? (
              <p className="text-gray-500 text-sm">Carregando…</p>
            ) : chartData.length === 0 ? (
              <p className="text-gray-500 text-sm">Sem visitas registradas neste período.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                      labelStyle={{ color: '#e5e7eb' }}
                    />
                    <Bar dataKey="visitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Visitas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2">Origem do tráfego (período)</h4>
            {bySource.length === 0 ? (
              <p className="text-gray-500 text-sm">Sem dados.</p>
            ) : (
              <ul className="space-y-2">
                {bySource.map(({ label, n, kind }) => (
                  <li
                    key={kind}
                    className="flex justify-between text-sm border-b border-gray-800/80 pb-2"
                  >
                    <span className="text-gray-300">{label}</span>
                    <span className="text-emerald-400 font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Páginas: vitrine (<code className="text-gray-400">/s/…</code>) e landing (
            <code className="text-gray-400">/imovel/…</code>). Para relatórios mais ricos (sessões,
            conversões), use o Google Analytics configurado no Site Vitrine.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
