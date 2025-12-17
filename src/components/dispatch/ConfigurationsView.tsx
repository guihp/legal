import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Settings, 
  Copy, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Star,
  StarOff,
  Clock,
  Users,
  MessageSquare,
  Calendar,
  Zap
} from 'lucide-react';
import { useDispatchConfigurations } from '@/hooks/useDispatchConfigurations';
import { DispatchConfiguration } from '@/lib/dispatch/types';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { ConfigurationCard } from './ConfigurationCard';

interface ConfigurationsViewProps {
  onCreateNew: () => void;
  onEdit: (config: DispatchConfiguration) => void;
  onSelect?: (config: DispatchConfiguration) => void;
  selectedConfigId?: string;
}

export function ConfigurationsView({ 
  onCreateNew, 
  onEdit, 
  onSelect,
  selectedConfigId 
}: ConfigurationsViewProps) {
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const isManager = profile?.role === 'admin' || profile?.role === 'gestor';
  
  const {
    configurations,
    loading,
    error,
    deleteConfiguration,
    duplicateConfiguration,
    toggleActive,
    setAsDefault,
    searchConfigurations
  } = useDispatchConfigurations();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Filtrar configurações
  const filteredConfigurations = React.useMemo(() => {
    let filtered = searchTerm ? searchConfigurations(searchTerm) : configurations;
    
    if (filterStatus === 'active') {
      filtered = filtered.filter(c => c.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(c => !c.isActive);
    }
    
    return filtered;
  }, [configurations, searchTerm, filterStatus, searchConfigurations]);

  const handleDelete = async (config: DispatchConfiguration) => {
    const success = await deleteConfiguration(config.id);
    if (success) {
      toast({
        title: 'Configuração deletada',
        description: `A configuração "${config.name}" foi removida com sucesso.`,
      });
    }
  };

  const handleDuplicate = async (config: DispatchConfiguration) => {
    const newConfig = await duplicateConfiguration(config.id);
    if (newConfig) {
      toast({
        title: 'Configuração duplicada',
        description: `Nova configuração "${newConfig.name}" criada com base em "${config.name}".`,
      });
    }
  };

  const handleToggleActive = async (config: DispatchConfiguration) => {
    const success = await toggleActive(config.id);
    if (success) {
      toast({
        title: config.isActive ? 'Configuração desativada' : 'Configuração ativada',
        description: `A configuração "${config.name}" foi ${config.isActive ? 'desativada' : 'ativada'}.`,
      });
    }
  };

  const handleSetDefault = async (config: DispatchConfiguration) => {
    const success = await setAsDefault(config.id);
    if (success) {
      toast({
        title: 'Configuração padrão definida',
        description: `"${config.name}" agora é a configuração padrão.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="h-4 bg-gray-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-700 rounded animate-pulse" />
                <div className="h-3 bg-gray-700 rounded animate-pulse w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="p-6">
          <div className="text-red-400 text-center">
            <p className="font-semibold">Erro ao carregar configurações</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Configurações de Disparo</h2>
          <p className="text-gray-400 mt-1">
            Gerencie setups pré-definidos para seus disparos WhatsApp
          </p>
        </div>
        
        {isManager && (
          <Button onClick={onCreateNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Configuração
          </Button>
        )}
      </div>

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar configurações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-700 text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            size="sm"
          >
            Todas
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('active')}
            size="sm"
          >
            Ativas
          </Button>
          <Button
            variant={filterStatus === 'inactive' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('inactive')}
            size="sm"
          >
            Inativas
          </Button>
        </div>
      </div>

      {/* Lista de configurações */}
      {filteredConfigurations.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-12 text-center">
            <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              {searchTerm ? 'Nenhuma configuração encontrada' : 'Nenhuma configuração criada'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? 'Tente ajustar os filtros ou o termo de busca.'
                : 'Crie sua primeira configuração de disparo para começar.'
              }
            </p>
            {isManager && !searchTerm && (
              <Button onClick={onCreateNew} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Configuração
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredConfigurations.map((config, index) => (
              <ConfigurationCard
                key={config.id}
                config={config}
                isSelected={selectedConfigId === config.id}
                isManager={isManager}
                onEdit={() => onEdit(config)}
                onDelete={() => handleDelete(config)}
                onDuplicate={() => handleDuplicate(config)}
                onToggleActive={() => handleToggleActive(config)}
                onSetDefault={() => handleSetDefault(config)}
                onSelect={onSelect ? () => onSelect(config) : undefined}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}


