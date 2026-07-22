
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, Eye, Users, MapPin } from "lucide-react";
import { PropertyWithImages } from "@/hooks/useProperties";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeImoveisChanges } from "@/lib/realtime/imoveisRealtimeBus";
import { UpcomingAppointments } from "@/components/UpcomingAppointments";
import { RecentActivitiesCard } from "@/components/RecentActivitiesCard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { useUserProfile } from "@/hooks/useUserProfile";

interface DashboardContentProps {
  properties: PropertyWithImages[];
  loading: boolean;
  onNavigateToAgenda?: () => void;
}

export function DashboardContent({ properties: _properties, loading: _loading, onNavigateToAgenda }: DashboardContentProps) {
  const { profile } = useUserProfile();
  const companyId = profile?.company_id ?? null;
  const isCorretor = profile?.role === 'corretor';

  // KPIs
  const [totalProperties, setTotalProperties] = useState(0);
  const [availableProperties, setAvailableProperties] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [vgvCurrent, setVgvCurrent] = useState(0);
  // MoM baselines = NEW items in rolling last 30d vs prior 30d (not calendar month / not stock)
  const [momCurrent, setMomCurrent] = useState({
    properties: 0,
    available: 0,
    clients: 0,
    vgv: 0,
  });
  const [momPrevious, setMomPrevious] = useState({
    properties: 0,
    available: 0,
    clients: 0,
    vgv: 0,
  });
  const [loadingKpis, setLoadingKpis] = useState(true);
  // Lista de propriedades recentes (para o card lateral)
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(true);

  const applyLeadsScope = <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
    let q = query.eq('company_id', companyId!);
    if (isCorretor && profile?.id) {
      q = q.eq('id_corretor_responsavel', profile.id);
    }
    return q;
  };

  // Buscar últimas propriedades recentes
  const fetchImoveis = async () => {
    if (!companyId) return;
    try {
      setLoadingImoveis(true);
      const { data, error } = await supabase
        .from('imoveisvivareal')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setImoveis(data || []);
    } catch (err) {
      console.error('Erro ao carregar imoveisvivareal:', err);
      setImoveis([]);
    } finally {
      setLoadingImoveis(false);
    }
  };

  // Carregar KPIs (estoque atual + MoM = novos últimos 30d vs 30d anteriores)
  const fetchKpis = async () => {
    if (!companyId) return;
    try {
      setLoadingKpis(true);
      const now = new Date();
      const last30Start = new Date(now);
      last30Start.setDate(last30Start.getDate() - 30);
      const prev30Start = new Date(now);
      prev30Start.setDate(prev30Start.getDate() - 60);

      const nowISO = now.toISOString();
      const last30StartISO = last30Start.toISOString();
      const prev30StartISO = prev30Start.toISOString();

      // Totais atuais (estoque da empresa)
      const totalResPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId) as unknown as Promise<{ count: number | null }>;
      const dispResPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('disponibilidade', 'disponivel') as unknown as Promise<{ count: number | null }>;
      const leadsResPromise = applyLeadsScope(
        supabase.from('leads').select('id', { count: 'exact', head: true })
      ) as unknown as Promise<{ count: number | null }>;

      // Novos nos últimos 30 dias [now-30d, now)
      const newPropsThisPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', last30StartISO)
        .lt('created_at', nowISO) as unknown as Promise<{ count: number | null }>;
      const newAvailThisPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('disponibilidade', 'disponivel')
        .gte('created_at', last30StartISO)
        .lt('created_at', nowISO) as unknown as Promise<{ count: number | null }>;
      const newLeadsThisPromise = applyLeadsScope(
        supabase.from('leads').select('id', { count: 'exact', head: true })
      )
        .gte('created_at', last30StartISO)
        .lt('created_at', nowISO) as unknown as Promise<{ count: number | null }>;

      // Novos nos 30 dias anteriores [now-60d, now-30d)
      const newPropsPrevPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', prev30StartISO)
        .lt('created_at', last30StartISO) as unknown as Promise<{ count: number | null }>;
      const newAvailPrevPromise = supabase
        .from('imoveisvivareal')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('disponibilidade', 'disponivel')
        .gte('created_at', prev30StartISO)
        .lt('created_at', last30StartISO) as unknown as Promise<{ count: number | null }>;
      const newLeadsPrevPromise = applyLeadsScope(
        supabase.from('leads').select('id', { count: 'exact', head: true })
      )
        .gte('created_at', prev30StartISO)
        .lt('created_at', last30StartISO) as unknown as Promise<{ count: number | null }>;

      const [
        totalRes, dispRes, leadsRes,
        newPropsThis, newAvailThis, newLeadsThis,
        newPropsPrev, newAvailPrev, newLeadsPrev,
      ] = await Promise.all([
        totalResPromise,
        dispResPromise,
        leadsResPromise,
        newPropsThisPromise,
        newAvailThisPromise,
        newLeadsThisPromise,
        newPropsPrevPromise,
        newAvailPrevPromise,
        newLeadsPrevPromise,
      ]);

      // VGV estoque atual + VGV dos novos em cada janela de 30d (soma de preco)
      const vgvNowPromise = supabase
        .from('imoveisvivareal')
        .select('preco')
        .eq('company_id', companyId)
        .not('preco', 'is', null);

      const vgvNewThisPromise = supabase
        .from('imoveisvivareal')
        .select('preco')
        .eq('company_id', companyId)
        .gte('created_at', last30StartISO)
        .lt('created_at', nowISO)
        .not('preco', 'is', null);

      const vgvNewPrevPromise = supabase
        .from('imoveisvivareal')
        .select('preco')
        .eq('company_id', companyId)
        .gte('created_at', prev30StartISO)
        .lt('created_at', last30StartISO)
        .not('preco', 'is', null);

      const [vgvNowRes, vgvNewThisRes, vgvNewPrevRes] = await Promise.all([
        vgvNowPromise,
        vgvNewThisPromise,
        vgvNewPrevPromise,
      ]);

      const sumPreco = (rows: { preco: number | null }[] | null | undefined) =>
        rows?.reduce((sum, item) => sum + (Number(item.preco) || 0), 0) || 0;

      setTotalProperties(totalRes.count || 0);
      setAvailableProperties(dispRes.count || 0);
      setTotalLeads(leadsRes.count || 0);
      setVgvCurrent(sumPreco(vgvNowRes.data));
      setMomCurrent({
        properties: newPropsThis.count || 0,
        available: newAvailThis.count || 0,
        clients: newLeadsThis.count || 0,
        vgv: sumPreco(vgvNewThisRes.data),
      });
      setMomPrevious({
        properties: newPropsPrev.count || 0,
        available: newAvailPrev.count || 0,
        clients: newLeadsPrev.count || 0,
        vgv: sumPreco(vgvNewPrevRes.data),
      });
    } catch (error) {
      console.error('💥 Erro ao carregar KPIs:', error);
    } finally {
      setLoadingKpis(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;

    fetchImoveis();
    fetchKpis();

    // Realtime — imoveisvivareal vem do bus compartilhado (1 channel pra app inteira).
    // leads + contracts continuam em channel próprio (poucos consumers).
    const unsubscribeImoveis = subscribeImoveisChanges(() => {
      fetchImoveis();
      fetchKpis();
    });
    const channel = supabase
      .channel(`dashboard_kpis_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { fetchKpis(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => { fetchKpis(); })
      .subscribe();
    return () => {
      unsubscribeImoveis();
      supabase.removeChannel(channel);
    };
  }, [companyId, profile?.role, profile?.id]);

  if (!companyId || loadingImoveis || loadingKpis) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-lg text-gray-400">Carregando dados...</div>
        </div>
      </div>
    );
  }

  // Função para calcular percentual de mudança
  const calculatePercentageChange = (current: number, previous: number): { change: string, type: "positive" | "negative" | "neutral" } => {
    if (previous === 0) {
      if (current > 0) return { change: "+100%", type: "positive" };
      return { change: "0%", type: "neutral" };
    }
    
    const percentChange = ((current - previous) / previous) * 100;
    const formattedChange = Math.abs(percentChange).toFixed(1);
    
    if (percentChange > 0) {
      return { change: `+${formattedChange}%`, type: "positive" };
    } else if (percentChange < 0) {
      return { change: `-${formattedChange}%`, type: "negative" };
    }
    return { change: "0%", type: "neutral" };
  };

  // MoM: novos últimos 30d vs 30d anteriores (rolling)
  const propertiesChange = calculatePercentageChange(momCurrent.properties, momPrevious.properties);
  const availableChange = calculatePercentageChange(momCurrent.available, momPrevious.available);
  const clientsChange = calculatePercentageChange(momCurrent.clients, momPrevious.clients);
  const vgvChange = calculatePercentageChange(momCurrent.vgv, momPrevious.vgv);

  const formatCurrencyCompact = (value: number): string => {
    if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const stats = [
    {
      title: "VGV",
      value: formatCurrencyCompact(vgvCurrent),
      icon: TrendingUp,
      change: vgvChange.change,
      changeType: vgvChange.type,
    },
    {
      title: "Total de Imóveis",
      value: totalProperties.toString(),
      icon: Building2,
      change: propertiesChange.change,
      changeType: propertiesChange.type,
    },
    {
      title: "Disponíveis",
      value: availableProperties.toString(),
      icon: Eye,
      change: availableChange.change, 
      changeType: availableChange.type,
    },
    {
      title: "Total de Leads",
      value: totalLeads.toString(),
      icon: Users,
      change: clientsChange.change,
      changeType: clientsChange.type,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral do seu portfólio imobiliário</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className={`text-xs mt-1 ${
                stat.changeType === "positive" ? "text-green-400" : 
                stat.changeType === "negative" ? "text-red-400" : "text-gray-400"
              }`}>
                {stat.change} vs. 30 dias anteriores
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NOVA SESSÃO: Conjunto de gráficos */}
      <div className="mb-6">
        <DashboardCharts />
      </div>

      {/* 2ª sessão: Propriedades Recentes + Próximos Compromissos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Propriedades Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {imoveis.slice(0, 5).map((imovel: any) => (
                <div key={imovel.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{imovel.tipo_imovel || 'Imóvel'}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {imovel.cidade || '—'}{imovel.bairro ? `, ${imovel.bairro}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      R$ {((Number(imovel.preco) || 0) / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs px-2 py-1 rounded-full text-blue-400 bg-blue-400/10">VivaReal</p>
                  </div>
                </div>
              ))}
              {imoveis.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  Nenhuma propriedade cadastrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <UpcomingAppointments onViewAll={onNavigateToAgenda} />
      </div>

      {/* 3ª sessão: Atividades Recentes */}
      <div className="grid grid-cols-1 gap-6">
        <RecentActivitiesCard />
      </div>
    </div>
  );
}
