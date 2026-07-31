import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CrmFilterTab } from './helpers';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTab: CrmFilterTab;
  onTabChange: (tab: CrmFilterTab) => void;
  counts: Record<CrmFilterTab, number>;
};

const TABS: { value: CrmFilterTab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'negociacao', label: 'Em negociação' },
  { value: 'fechados', label: 'Fechados' },
  { value: 'perdidos', label: 'Perdidos' },
];

export function ClientsCrmFilters({
  searchTerm,
  onSearchChange,
  selectedTab,
  onTabChange,
  counts,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filtrar por nome, email, telefone ou interesse..."
          className="pl-9 h-10 rounded-xl bg-background border-border shadow-sm"
        />
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(v) => onTabChange(v as CrmFilterTab)}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm',
                'data-[state=active]:border-emerald-800 data-[state=active]:bg-emerald-800 data-[state=active]:text-white',
                'data-[state=active]:btn-on-emerald',
                'dark:data-[state=active]:bg-emerald-700 dark:data-[state=active]:border-emerald-700',
              )}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-80">{counts[tab.value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
