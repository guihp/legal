import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthPoint } from './helpers';
import {
  formatCurrencyCompact,
  formatVgvAxisTick,
  niceVgvMax,
  peakVgvLabel,
} from './helpers';

type Props = {
  series: MonthPoint[];
  peakLabel: string | null;
};

const VGV_FILL = '#A8D5B5';
const VGV_ACTIVE = '#6BAF84';
const IMOVEIS_STROKE = '#F5B942';
const IMOVEIS_DOT = '#E8A317';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const vgv = Number(payload.find((p) => p.dataKey === 'vgv')?.value ?? 0);
  const qtd = Number(payload.find((p) => p.dataKey === 'qtd')?.value ?? 0);
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">
        VGV · <span className="text-foreground tabular-nums">{formatCurrencyCompact(vgv)}</span>
      </p>
      <p className="text-muted-foreground">
        Imóveis · <span className="text-foreground tabular-nums">{qtd}</span>
      </p>
    </div>
  );
}

export function DashboardVgvChart({ series, peakLabel }: Props) {
  const maxVgv = useMemo(() => niceVgvMax(Math.max(...series.map((s) => s.vgv), 0)), [series]);
  const maxQtd = useMemo(() => {
    const raw = Math.max(...series.map((s) => s.qtd), 0);
    return Math.max(2, Math.ceil(raw));
  }, [series]);

  const qtdTicks = useMemo(() => {
    const step = maxQtd <= 4 ? 1 : Math.ceil(maxQtd / 4);
    const ticks: number[] = [];
    for (let t = 0; t <= maxQtd; t += step) ticks.push(t);
    if (ticks[ticks.length - 1] !== maxQtd) ticks.push(maxQtd);
    return ticks;
  }, [maxQtd]);

  const vgvTicks = useMemo(() => {
    const step = maxVgv / 4;
    return [0, 1, 2, 3, 4].map((i) => i * step);
  }, [maxVgv]);

  // Prefer peak from charted series so subtitle always matches max VGV month.
  const resolvedPeak = peakVgvLabel(series) ?? peakLabel;

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 h-full flex flex-col min-h-[280px]">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">VGV e imóveis vendidos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Últimos 12 meses{resolvedPeak ? ` · ${resolvedPeak}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#A8D5B5]" /> VGV
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[#F5B942] rounded" />
            <span className="h-2 w-2 rounded-full bg-[#E8A317] -ml-1" />
            Imóveis
          </span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[200px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              yAxisId="vgv"
              orientation="left"
              domain={[0, maxVgv]}
              ticks={vgvTicks}
              tickFormatter={formatVgvAxisTick}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <YAxis
              yAxisId="qtd"
              orientation="right"
              domain={[0, maxQtd]}
              ticks={qtdTicks}
              allowDecimals={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.35)' }} />
            <Bar
              yAxisId="vgv"
              dataKey="vgv"
              name="VGV"
              fill={VGV_FILL}
              activeBar={{ fill: VGV_ACTIVE }}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
            <Line
              yAxisId="qtd"
              type="monotone"
              dataKey="qtd"
              name="Imóveis"
              stroke={IMOVEIS_STROKE}
              strokeWidth={2.5}
              dot={{
                r: 4,
                fill: IMOVEIS_DOT,
                stroke: '#fff',
                strokeWidth: 1.5,
              }}
              activeDot={{
                r: 5,
                fill: IMOVEIS_DOT,
                stroke: '#fff',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
