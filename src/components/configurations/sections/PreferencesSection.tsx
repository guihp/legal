import { Contrast } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIMEZONE_OPTIONS, type PreferencesState } from '../constants';

type Props = {
  prefs: PreferencesState;
  isManager: boolean;
  onChange: (patch: Partial<PreferencesState>) => void;
};

const TOGGLES: ReadonlyArray<{
  key: keyof Omit<PreferencesState, 'timezone'>;
  title: string;
  description: string;
}> = [
  {
    key: 'notifyNewLeads',
    title: 'Avisar sobre novos leads',
    description: 'Notificação no painel e por e-mail sempre que a IA qualificar um lead.',
  },
  {
    key: 'visitConfirmation',
    title: 'Confirmação de visitas',
    description: 'Lembrete automático ao cliente 24 h antes da visita agendada.',
  },
  {
    key: 'managerWhatsappAlerts',
    title: 'Alertas no WhatsApp do gestor',
    description: 'Mensagens críticas, como instância desconectada.',
  },
  {
    key: 'platformNews',
    title: 'Novidades da plataforma',
    description: 'Comunicados sobre novos recursos do IAFÉ IMOBI.',
  },
];

export function PreferencesSection({ prefs, isManager, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-1">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Contrast className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Preferências e notificações</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Valem para toda a equipe da imobiliária
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border/70">
        {TOGGLES.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {item.description}
              </p>
            </div>
            <Switch
              checked={prefs[item.key]}
              disabled={!isManager}
              onCheckedChange={(checked) => onChange({ [item.key]: checked })}
              className="shrink-0 data-[state=checked]:bg-emerald-700"
            />
          </li>
        ))}

        <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Fuso horário</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Base para agenda, plantão e relatórios
            </p>
          </div>
          <Select
            value={prefs.timezone}
            disabled={!isManager}
            onValueChange={(value) => onChange({ timezone: value })}
          >
            <SelectTrigger className="w-full sm:w-[220px] rounded-xl h-10 border-border bg-background">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
              {!TIMEZONE_OPTIONS.includes(prefs.timezone as (typeof TIMEZONE_OPTIONS)[number]) &&
              prefs.timezone ? (
                <SelectItem value={prefs.timezone}>{prefs.timezone}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </li>
      </ul>
    </div>
  );
}
