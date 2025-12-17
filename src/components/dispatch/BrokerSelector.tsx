import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  Users, 
  X,
  User,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';

interface BrokerSelectorProps {
  selectedBrokerIds: string[];
  onSelectionChange: (brokerIds: string[]) => void;
  disabled?: boolean;
  showSelectAll?: boolean;
  maxSelection?: number;
  placeholder?: string;
}

export function BrokerSelector({
  selectedBrokerIds,
  onSelectionChange,
  disabled = false,
  showSelectAll = true,
  maxSelection,
  placeholder = "Buscar corretores..."
}: BrokerSelectorProps) {
  const { brokers, loading, error, loadBrokers } = useCompanyUsers();
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar corretores baseado na busca
  const filteredBrokers = useMemo(() => {
    if (!searchTerm.trim()) return brokers;
    
    const term = searchTerm.toLowerCase();
    return brokers.filter(broker => 
      broker.fullName.toLowerCase().includes(term) ||
      broker.email.toLowerCase().includes(term)
    );
  }, [brokers, searchTerm]);

  // Corretores selecionados
  const selectedBrokers = useMemo(() => {
    return brokers.filter(broker => selectedBrokerIds.includes(broker.id));
  }, [brokers, selectedBrokerIds]);

  // Handlers
  const handleBrokerToggle = (brokerId: string) => {
    if (disabled) return;

    const isSelected = selectedBrokerIds.includes(brokerId);
    
    if (isSelected) {
      // Remover seleção
      onSelectionChange(selectedBrokerIds.filter(id => id !== brokerId));
    } else {
      // Adicionar seleção (verificar limite)
      if (maxSelection && selectedBrokerIds.length >= maxSelection) {
        return; // Não adicionar se exceder limite
      }
      onSelectionChange([...selectedBrokerIds, brokerId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;

    if (selectedBrokerIds.length === filteredBrokers.length) {
      // Desselecionar todos
      onSelectionChange([]);
    } else {
      // Selecionar todos (respeitando limite)
      const newSelection = filteredBrokers.map(b => b.id);
      if (maxSelection) {
        onSelectionChange(newSelection.slice(0, maxSelection));
      } else {
        onSelectionChange(newSelection);
      }
    }
  };

  const handleRemoveSelected = (brokerId: string) => {
    if (disabled) return;
    onSelectionChange(selectedBrokerIds.filter(id => id !== brokerId));
  };

  const isAllSelected = filteredBrokers.length > 0 && 
    filteredBrokers.every(broker => selectedBrokerIds.includes(broker.id));

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Corretores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded animate-pulse mb-1" />
                  <div className="h-3 bg-gray-700 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Corretores
          {selectedBrokerIds.length > 0 && (
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/50">
              {selectedBrokerIds.length} selecionado{selectedBrokerIds.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {maxSelection && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/50">
              Max: {maxSelection}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Corretores Selecionados */}
        {selectedBrokers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-medium">Selecionados:</div>
            <div className="flex flex-wrap gap-2">
              {selectedBrokers.map(broker => (
                <Badge
                  key={broker.id}
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-300 border-emerald-400/50 pr-1"
                >
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    {broker.fullName}
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-red-500/20"
                        onClick={() => handleRemoveSelected(broker.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-700 text-white"
            disabled={disabled}
          />
        </div>

        {/* Select All */}
        {showSelectAll && filteredBrokers.length > 0 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={disabled || (maxSelection && filteredBrokers.length > maxSelection)}
              className="text-gray-300 border-gray-600 hover:bg-gray-800"
            >
              {isAllSelected ? 'Desselecionar Todos' : 'Selecionar Todos'}
            </Button>
            {maxSelection && filteredBrokers.length > maxSelection && (
              <span className="text-xs text-yellow-400">
                Limite: {maxSelection} corretores
              </span>
            )}
          </div>
        )}

        {/* Lista de Corretores */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredBrokers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'Nenhum corretor encontrado' : 'Nenhum corretor disponível'}
              </p>
            </div>
          ) : (
            filteredBrokers.map(broker => {
              const isSelected = selectedBrokerIds.includes(broker.id);
              const canSelect = !maxSelection || selectedBrokerIds.length < maxSelection || isSelected;

              return (
                <div
                  key={broker.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  } ${!canSelect && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => canSelect && handleBrokerToggle(broker.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled || (!canSelect && !isSelected)}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                      {broker.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {broker.fullName}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      {broker.email}
                    </p>
                  </div>

                  {isSelected && (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer com contadores */}
        <div className="text-xs text-gray-500 flex justify-between">
          <span>{filteredBrokers.length} corretor{filteredBrokers.length !== 1 ? 'es' : ''} disponível{filteredBrokers.length !== 1 ? 'is' : ''}</span>
          {maxSelection && (
            <span>{selectedBrokerIds.length}/{maxSelection} selecionados</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
