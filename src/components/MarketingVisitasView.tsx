import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useBasicNavigation } from '@/hooks/useBasicNavigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Download,
  Globe,
  Home as HomeIcon,
  Search as SearchIcon,
  Users,
  Calendar as CalendarIcon,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { REFERRER_KIND_LABELS, type ReferrerKind } from '@/lib/publicSiteVisit';
import { toast } from 'sonner';

type VisitRow = {
  created_at: string;
  referrer_kind: string;
  page_type: string;
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
};

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';
type Granularity = 'day' | 'week' | 'month';

function bucketKey(d: Date, mode: Granularity): string {
  if (mode === 'day') return format(d, 'yyyy-MM-dd');
  if (mode === 'week') return format(startOfWeek(d, { locale: ptBR }), 'yyyy-MM-dd');
  return format(startOfMonth(d), 'yyyy-MM');
}

function bucketLabel(key: string, mode: Granularity): string {
  if (mode === 'day') return format(parseISO(key), 'dd/MM', { locale: ptBR });
  if (mode === 'week') return `Sem. ${format(parseISO(key), 'dd/MM', { locale: ptBR })}`;
  return format(parseISO(`${key}-01`), 'MMM yyyy', { locale: ptBR });
}

function iconForReferrer(kind: string): React.ReactNode {
  if (kind === 'google') return <SearchIcon className="w-4 h-4" />;
  if (kind === 'social') return <Users className="w-4 h-4" />;
  if (kind === 'referral') return <ExternalLink className="w-4 h-4" />;
  if (kind === 'direct') return <HomeIcon className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

function colorForReferrer(kind: string): string {
  if (kind === 'google') return '#4285F4';
  if (kind === 'social') return '#E1306C';
  if (kind === 'referral') return '#f59e0b';
  if (kind === 'direct') return '#10b981';
  return '#94a3b8';
}

function prettyPath(p: string | null): string {
  if (!p) return '(sem path)';
  try {
    const clean = p.split('?')[0];
    if (clean === '/' || clean === '') return '/';
    return clean.length > 80 ? clean.slice(0, 77) + '…' : clean;
  } catch {
    return p;
  }
}

function toCsv(rows: VisitRow[]): string {
  const header = ['data', 'hora', 'tipo_pagina', 'path', 'origem', 'referrer', 'utm_source', 'utm_medium'];
  const lines = rows.map((r) => {
    const d = parseISO(r.created_at);
    const data = format(d, 'yyyy-MM-dd');
    const hora = format(d, 'HH:mm:ss');
    const fields = [
      data,
      hora,
      r.page_type,
      r.path ?? '',
      r.referrer_kind,
      r.referrer ?? '',
      r.utm_source ?? '',
      r.utm_medium ?? '',
    ].map((v) => {
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    });
    return fields.join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

export function MarketingVisitasView() {
  const { profile } = useUserProfile();
  const { changeView } = useBasicNavigation();
  const companyId = profile?.company_id ?? null;

  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [preset, setPreset] = useState<Preset>('30d');
  const [fromStr, setFromStr] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [toStr, setToStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [pageTypeFilter, setPageTypeFilter] = useState<'all' | 'vitrine' | 'landing'>('all');
  const [siteSlug, setSiteSlug] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const range = useMemo(() => {
    let from: Date;
    let to: Date = endOfDay(new Date());
    if (preset === 'today') {
      from = startOfDay(new Date());
    } else if (preset === '7d') {
      from = startOfDay(subDays(new Date(), 6));
    } else if (preset === '30d') {
      from = startOfDay(subDays(new Date(), 29));
    } else if (preset === '90d') {
      from = startOfDay(subDays(new Date(), 89));
    } else {
      from = startOfDay(parseISO(fromStr));
      to = endOfDay(parseISO(toStr));
    }
    return { from, to };
  }, [preset, fromStr, toStr]);

  const loadVisits = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data, error } = await supabase
        .from('public_site_visits' as never)
        .select('created_at, referrer_kind, page_type, path, referrer, utm_source, utm_medium')
        .eq('company_id', companyId)
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      setRows((data as VisitRow[]) || []);
    } catch (e: unknown) {
      const detail =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : String(e);
      if (import.meta.env.DEV) console.error('[MarketingVisitasView] loadVisits', detail, e);
      setRows([]);
      setLoadFailed(true);
      toast.error('Não foi possível carregar as visitas. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }, [companyId, range.from, range.to]);

  // Carrega o slug do site da empresa (para botão "Abrir site")
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from('company_websites')
        .select('slug, is_published')
        .eq('company_id', companyId)
        .maybeSingle();
      if (data) {
        setSiteSlug((data as any).slug || null);
        setIsPublished(Boolean((data as any).is_published));
      }
    })();
  }, [companyId]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  // Auto-ajusta granularidade baseado no período
  useEffect(() => {
    const dias = differenceInCalendarDays(range.to, range.from);
    if (dias <= 14) setGranularity('day');
    else if (dias <= 90) setGranularity('day');
    else if (dias <= 365) setGranularity('week');
    else setGranularity('month');
  }, [range.from, range.to]);

  const filteredRows = useMemo(() => {
    if (pageTypeFilter === 'all') return rows;
    return rows.filter((r) => r.page_type === pageTypeFilter);
  }, [rows, pageTypeFilter]);

  const total = filteredRows.length;

  const totalToday = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    return filteredRows.filter((r) => {
      const d = parseISO(r.created_at);
      return d >= todayStart && d <= todayEnd;
    }).length;
  }, [filteredRows]);

  const total7d = useMemo(() => {
    const from = startOfDay(subDays(new Date(), 6));
    const to = endOfDay(new Date());
    return filteredRows.filter((r) => {
      const d = parseISO(r.created_at);
      return d >= from && d <= to;
    }).length;
  }, [filteredRows]);

  const mediaDiaria = useMemo(() => {
    const dias = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
    return Math.round((total / dias) * 10) / 10;
  }, [total, range.from, range.to]);

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

    const counts = new Map<string, { vitrine: number; landing: number }>();
    for (const d of bucketDates) counts.set(bucketKey(d, granularity), { vitrine: 0, landing: 0 });

    for (const r of filteredRows) {
      const d = parseISO(r.created_at);
      if (d < from || d > to) continue;
      const k = bucketKey(d, granularity);
      const bucket = counts.get(k);
      if (!bucket) continue;
      if (r.page_type === 'landing') bucket.landing += 1;
      else bucket.vitrine += 1;
    }

    return bucketDates.map((d) => {
      const k = bucketKey(d, granularity);
      const c = counts.get(k) || { vitrine: 0, landing: 0 };
      return {
        key: k,
        label: bucketLabel(k, granularity),
        vitrine: c.vitrine,
        landing: c.landing,
        total: c.vitrine + c.landing,
      };
    });
  }, [filteredRows, range, granularity]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) {
      const k = (r.referrer_kind || 'other') as ReferrerKind;
      m.set(k, (m.get(k) || 0) + 1);
    }
    const arr = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => ({
        kind,
        n,
        label: REFERRER_KIND_LABELS[kind as ReferrerKind] || kind,
        pct: total > 0 ? Math.round((n / total) * 1000) / 10 : 0,
      }));
    return arr;
  }, [filteredRows, total]);

  const byPage = useMemo(() => {
    const m = new Map<string, { n: number; page_type: string }>();
    for (const r of filteredRows) {
      const k = r.path || '(sem path)';
      const prev = m.get(k);
      m.set(k, { n: (prev?.n || 0) + 1, page_type: r.page_type });
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 10)
      .map(([path, v]) => ({ path, n: v.n, page_type: v.page_type }));
  }, [filteredRows]);

  const byUtm = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) {
      if (!r.utm_source) continue;
      const k = `${r.utm_source}${r.utm_medium ? ` · ${r.utm_medium}` : ''}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, n]) => ({ label, n }));
  }, [filteredRows]);

  const recent = useMemo(() => filteredRows.slice(0, 20), [filteredRows]);

  const exportCsv = () => {
    const csv = toCsv(filteredRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitas_${format(range.from, 'yyyyMMdd')}_${format(range.to, 'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePresetChange = (v: Preset) => {
    setPreset(v);
    const today = new Date();
    if (v === 'today') {
      const t = format(today, 'yyyy-MM-dd');
      setFromStr(t);
      setToStr(t);
    } else if (v === '7d') {
      setFromStr(format(subDays(today, 6), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    } else if (v === '30d') {
      setFromStr(format(subDays(today, 29), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    } else if (v === '90d') {
      setFromStr(format(subDays(today, 89), 'yyyy-MM-dd'));
      setToStr(format(today, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => changeView('marketing', 'Voltar')}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-emerald-500" />
              Visitas ao site
            </h1>
            <p className="text-gray-400 mt-1">
              Análise completa de tráfego do seu vitrine e landing pages.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isPublished && siteSlug && (
            <Button
              variant="outline"
              onClick={() => window.open(`/s/${siteSlug}`, '_blank')}
              className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir site
            </Button>
          )}
          <Button
            variant="outline"
            onClick={loadVisits}
            disabled={loading}
            className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Não foi possível atualizar as informações. Use <strong className="text-foreground font-medium">Atualizar</strong> ou
          tente mais tarde. Se o problema continuar, contacte o suporte.
        </div>
      )}

      {/* FILTROS */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Período</Label>
            <Select value={preset} onValueChange={(v) => handlePresetChange(v as Preset)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Agrupar por</Label>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Tipo de página</Label>
            <Select
              value={pageTypeFilter}
              onValueChange={(v) => setPageTypeFilter(v as typeof pageTypeFilter)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="vitrine">Site vitrine</SelectItem>
                <SelectItem value="landing">Landing pages</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === 'custom' ? (
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-gray-400">Datas</Label>
              <div className="flex gap-1.5">
                <Input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-gray-100 text-xs"
                />
                <Input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-gray-100 text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 flex flex-col justify-end">
              <span className="text-xs text-gray-500">
                {format(range.from, "dd 'de' MMM", { locale: ptBR })} →{' '}
                {format(range.to, "dd 'de' MMM yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Total no período
            </span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-white">{total}</div>
          <div className="text-xs text-gray-500 mt-1">visitas registradas</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hoje</span>
            <CalendarIcon className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">{totalToday}</div>
          <div className="text-xs text-gray-500 mt-1">visitas hoje</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Últimos 7 dias
            </span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">{total7d}</div>
          <div className="text-xs text-gray-500 mt-1">visitas na semana</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Média diária
            </span>
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-white">{mediaDiaria}</div>
          <div className="text-xs text-gray-500 mt-1">visitas/dia no período</div>
        </div>
      </div>

      {/* CHART PRINCIPAL */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Evolução de visitas</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {pageTypeFilter === 'all'
                ? 'Vitrine + landing pages'
                : pageTypeFilter === 'vitrine'
                ? 'Somente site vitrine'
                : 'Somente landing pages'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-500 text-sm">
            Carregando…
          </div>
        ) : chartData.length === 0 || total === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
            <Activity className="w-8 h-8 text-gray-700" />
            <span>Sem visitas registradas neste período.</span>
            <span className="text-xs">
              Compartilhe o link do seu site para começar a receber tráfego.
            </span>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="vitrine" stackId="a" fill="#10b981" name="Vitrine" radius={[0, 0, 0, 0]} />
                <Bar dataKey="landing" stackId="a" fill="#3b82f6" name="Landing" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GRID ORIGENS + TOP PÁGINAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ORIGENS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Origens do tráfego</h3>
            <span className="text-xs text-gray-500">{bySource.length} canais</span>
          </div>
          {bySource.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Sem dados no período.</p>
          ) : (
            <div className="space-y-3">
              {bySource.map(({ label, n, kind, pct }) => (
                <div key={kind}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: colorForReferrer(kind) + 'cc' }}
                      >
                        {iconForReferrer(kind)}
                      </span>
                      <span className="text-sm font-medium text-gray-200">{label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">{n}</span>
                      <span className="text-[11px] text-gray-500">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colorForReferrer(kind),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP PÁGINAS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Páginas mais visitadas</h3>
            <span className="text-xs text-gray-500">top 10</span>
          </div>
          {byPage.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Sem dados no período.</p>
          ) : (
            <ul className="space-y-2">
              {byPage.map(({ path, n, page_type }, idx) => (
                <li
                  key={`${path}-${idx}`}
                  className="flex items-center justify-between gap-3 py-2 border-b border-gray-800/60 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] text-gray-500 font-mono w-5 text-right">
                      {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        page_type === 'landing'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-700/50'
                          : 'bg-emerald-600/20 text-emerald-300 border border-emerald-700/50'
                      }`}
                    >
                      {page_type === 'landing' ? 'LP' : 'Site'}
                    </span>
                    <code className="text-sm text-gray-300 truncate" title={path}>
                      {prettyPath(path)}
                    </code>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 shrink-0">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* UTM */}
      {byUtm.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-4">Campanhas (UTM)</h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byUtm.map((u) => ({ label: u.label, total: u.n }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Line type="monotone" dataKey="total" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RECENT VISITS */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h3 className="text-base font-semibold text-white">Últimas visitas</h3>
          <p className="text-xs text-gray-500 mt-0.5">20 mais recentes no período</p>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-500 text-sm py-10 text-center">Sem visitas para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 bg-gray-950/60">
                  <th className="px-5 py-2.5 font-medium">Quando</th>
                  <th className="px-5 py-2.5 font-medium">Página</th>
                  <th className="px-5 py-2.5 font-medium">Path</th>
                  <th className="px-5 py-2.5 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recent.map((r, idx) => {
                  const d = parseISO(r.created_at);
                  return (
                    <tr key={`${r.created_at}-${idx}`} className="hover:bg-gray-800/30">
                      <td className="px-5 py-2.5 text-gray-300 whitespace-nowrap">
                        {format(d, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            r.page_type === 'landing'
                              ? 'bg-blue-600/20 text-blue-300 border border-blue-700/50'
                              : 'bg-emerald-600/20 text-emerald-300 border border-emerald-700/50'
                          }`}
                        >
                          {r.page_type === 'landing' ? 'Landing' : 'Vitrine'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <code className="text-gray-400 text-xs">{prettyPath(r.path)}</code>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-gray-300 text-xs">
                          <span style={{ color: colorForReferrer(r.referrer_kind) }}>
                            {iconForReferrer(r.referrer_kind)}
                          </span>
                          {REFERRER_KIND_LABELS[r.referrer_kind as ReferrerKind] || r.referrer_kind}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 pt-2">
        A origem do tráfego é identificada pelo <code className="text-gray-400">referrer</code> do
        navegador. Acessos diretos (digitados, apps nativos ou com bloqueio de referrer) aparecem como{' '}
        <strong className="text-gray-400">Direto</strong>. Para relatórios avançados de sessão e
        conversão, configure um <strong className="text-gray-400">Google Analytics (G-XXX)</strong>{' '}
        no Site Vitrine.
      </p>
    </div>
  );
}

export default MarketingVisitasView;
