import { useEffect, useState } from 'react';
import { Building2, Users, AlertTriangle, CheckCircle, Clock, Ban, TrendingUp, Activity, Home, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminCompanies, AdminMetrics } from '@/hooks/useAdminCompanies';

interface MetricCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

function MetricCard({ title, value, description, icon, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    yellow: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    gray: 'from-gray-500/20 to-gray-600/10 border-gray-500/30',
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    yellow: 'text-amber-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    gray: 'text-gray-400',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
        <div className={iconColorClasses[color]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const { metrics, loading, loadMetrics } = useAdminCompanies();

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-400" />
            Painel Administrativo
          </h1>
          <p className="text-gray-400 mt-1">
            Visao geral do sistema e gestao de empresas
          </p>
        </div>
      </div>

      {/* Metricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Empresas"
          value={metrics?.total_companies || 0}
          icon={<Building2 className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Empresas Ativas"
          value={metrics?.active_companies || 0}
          description={`${metrics ? Math.round((metrics.active_companies / metrics.total_companies) * 100) || 0 : 0}% do total`}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
        <MetricCard
          title="Em Trial"
          value={metrics?.trial_companies || 0}
          icon={<Clock className="h-5 w-5" />}
          color="purple"
        />
        <MetricCard
          title="Bloqueadas"
          value={(metrics?.blocked_companies || 0) + (metrics?.expired_companies || 0)}
          description={`${metrics?.blocked_companies || 0} bloqueadas, ${metrics?.expired_companies || 0} expiradas`}
          icon={<Ban className="h-5 w-5" />}
          color="red"
        />
      </div>

      {/* Métricas de Conteúdo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Imóveis"
          value={metrics?.total_properties || 0}
          description="Cadastrados no sistema"
          icon={<Home className="h-5 w-5" />}
          color="purple"
        />
        <MetricCard
          title="Total de Leads"
          value={metrics?.total_leads || 0}
          description="Em todas as empresas"
          icon={<UserCheck className="h-5 w-5" />}
          color="yellow"
        />
        <MetricCard
          title="Total de Usuários"
          value={metrics?.total_users || 0}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Usuários Ativos"
          value={metrics?.active_users || 0}
          description={`${metrics ? Math.round((metrics.active_users / metrics.total_users) * 100) || 0 : 0}% ativos`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Alertas */}
      {(metrics?.grace_companies || 0) > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Atencao Necessaria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              <strong>{metrics?.grace_companies}</strong> empresa(s) em periodo de carencia. 
              Verifique a situacao de pagamento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status Overview */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Distribuicao por Status</CardTitle>
          <CardDescription>Visao geral dos status das empresas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <StatusBar 
              label="Ativas" 
              value={metrics?.active_companies || 0} 
              total={metrics?.total_companies || 1} 
              color="emerald" 
            />
            <StatusBar 
              label="Trial" 
              value={metrics?.trial_companies || 0} 
              total={metrics?.total_companies || 1} 
              color="purple" 
            />
            <StatusBar 
              label="Carencia" 
              value={metrics?.grace_companies || 0} 
              total={metrics?.total_companies || 1} 
              color="amber" 
            />
            <StatusBar 
              label="Bloqueadas" 
              value={metrics?.blocked_companies || 0} 
              total={metrics?.total_companies || 1} 
              color="red" 
            />
            <StatusBar 
              label="Expiradas" 
              value={metrics?.expired_companies || 0} 
              total={metrics?.total_companies || 1} 
              color="gray" 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBar({ 
  label, 
  value, 
  total, 
  color 
}: { 
  label: string; 
  value: number; 
  total: number; 
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default AdminDashboard;
