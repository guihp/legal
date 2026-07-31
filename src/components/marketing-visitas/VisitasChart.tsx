import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';

type ChartPoint = {
  key: string;
  label: string;
  vitrine: number;
  landing: number;
  total: number;
};

type Props = {
  data: ChartPoint[];
  subtitle: string;
  loading?: boolean;
  empty?: boolean;
};

export function VisitasChart({ data, subtitle, loading, empty }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Evolução de visitas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
            Vitrine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
            Landing pages
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
          Carregando…
        </div>
      ) : empty ? (
        <div className="h-72 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
          <Activity className="w-8 h-8 opacity-40" />
          <span>Sem visitas registradas neste período.</span>
          <span className="text-xs">Compartilhe o link do seu site para começar a receber tráfego.</span>
        </div>
      ) : (
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              />
              <Bar dataKey="vitrine" stackId="a" fill="#059669" name="Vitrine" radius={[0, 0, 0, 0]} />
              <Bar dataKey="landing" stackId="a" fill="#0ea5e9" name="Landing pages" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
