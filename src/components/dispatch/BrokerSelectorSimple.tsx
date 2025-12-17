import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Search } from 'lucide-react';

interface BrokerSelectorSimpleProps {
  selectedBrokerIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

// Mock data para teste - remover depois
const mockBrokers = [
  { id: '1', fullName: 'João Silva', email: 'joao@exemplo.com' },
  { id: '2', fullName: 'Maria Santos', email: 'maria@exemplo.com' },
  { id: '3', fullName: 'Pedro Costa', email: 'pedro@exemplo.com' },
];

export function BrokerSelectorSimple({ 
  selectedBrokerIds, 
  onSelectionChange, 
  disabled = false 
}: BrokerSelectorSimpleProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBrokers = mockBrokers.filter(broker =>
    broker.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (brokerId: string) => {
    if (disabled) return;
    
    console.log('Toggle broker:', brokerId, 'Current selected:', selectedBrokerIds);
    
    const newSelection = selectedBrokerIds.includes(brokerId)
      ? selectedBrokerIds.filter(id => id !== brokerId)
      : [...selectedBrokerIds, brokerId];
    
    console.log('New selection:', newSelection);
    onSelectionChange(newSelection);
  };

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Corretores ({selectedBrokerIds.length} selecionados)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar corretores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-700 text-white"
            disabled={disabled}
          />
        </div>

        <ScrollArea className="h-48">
          <div className="space-y-2">
            {filteredBrokers.map((broker) => (
              <div
                key={broker.id}
                className="flex items-center gap-3 p-2 rounded border border-gray-700 hover:border-gray-600"
              >
                <Checkbox
                  checked={selectedBrokerIds.includes(broker.id)}
                  disabled={disabled}
                  onCheckedChange={() => handleToggle(broker.id)}
                />
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                    {broker.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => handleToggle(broker.id)}
                >
                  <p className="text-white text-sm">{broker.fullName}</p>
                  <p className="text-gray-400 text-xs">{broker.email}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
