import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  AlertTriangle, 
  CheckCircle2,
  User,
  ArrowLeftRight,
  UserPlus,
  Save
} from "lucide-react";
import { KanbanLead } from '@/types/kanban';

interface BrokerInfo {
  id: string;
  full_name: string;
  role: string;
}

type ActionType = 'vincular' | 'desvincular' | 'transferir';

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: KanbanLead[];
  brokers: BrokerInfo[];
  onBulkAssign: (leadIds: string[], corretorId: string | null) => Promise<boolean>;
}

export function BulkAssignModal({ 
  isOpen, 
  onClose, 
  leads, 
  brokers,
  onBulkAssign 
}: BulkAssignModalProps) {
  const [actionType, setActionType] = useState<ActionType>('vincular');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [targetBroker, setTargetBroker] = useState<string>('');
  const [sourceBroker, setSourceBroker] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActionType('vincular');
      setSelectedLeads(new Set());
      setTargetBroker('');
      setSourceBroker('');
      setSearchTerm('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Reset selections when action type changes
  useEffect(() => {
    setSelectedLeads(new Set());
    setTargetBroker('');
    setSourceBroker('');
    setSearchTerm('');
  }, [actionType]);

  // Get available leads based on action type
  const getAvailableLeads = () => {
    let availableLeads = leads;

    switch (actionType) {
      case 'vincular':
        // Mostrar apenas leads sem corretor
        availableLeads = leads.filter(lead => !lead.id_corretor_responsavel);
        break;
      case 'desvincular':
        // Mostrar apenas leads do corretor selecionado
        if (sourceBroker) {
          availableLeads = leads.filter(lead => lead.id_corretor_responsavel === sourceBroker);
        } else {
          availableLeads = [];
        }
        break;
      case 'transferir':
        // Mostrar apenas leads do corretor remetente
        if (sourceBroker) {
          availableLeads = leads.filter(lead => lead.id_corretor_responsavel === sourceBroker);
        } else {
          availableLeads = [];
        }
        break;
    }

    // Apply search filter
    return availableLeads.filter(lead => 
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.telefone && lead.telefone.includes(searchTerm))
    );
  };

  // Get brokers with leads for desvincular action
  const getBrokersWithLeads = () => {
    const brokerIds = new Set(
      leads
        .filter(lead => lead.id_corretor_responsavel)
        .map(lead => lead.id_corretor_responsavel!)
    );
    return brokers.filter(broker => brokerIds.has(broker.id));
  };

  // Toggle lead selection
  const toggleLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  // Select all available leads
  const selectAllLeads = () => {
    const availableLeads = getAvailableLeads();
    const allLeadIds = new Set(availableLeads.map(lead => lead.id));
    setSelectedLeads(allLeadIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedLeads(new Set());
  };

  // Get broker name by id
  const getBrokerName = (brokerId: string | null) => {
    if (!brokerId) return 'Sem corretor';
    const broker = brokers.find(b => b.id === brokerId);
    return broker ? broker.full_name : 'Corretor não encontrado';
  };

  // Validate form
  const isFormValid = () => {
    if (selectedLeads.size === 0) return false;

    switch (actionType) {
      case 'vincular':
        return !!targetBroker;
      case 'desvincular':
        return !!sourceBroker;
      case 'transferir':
        return !!sourceBroker && !!targetBroker && sourceBroker !== targetBroker;
      default:
        return false;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid()) return;

    setIsProcessing(true);
    try {
      let corretorId: string | null = null;

      switch (actionType) {
        case 'vincular':
          corretorId = targetBroker;
          break;
        case 'desvincular':
          corretorId = null;
          break;
        case 'transferir':
          corretorId = targetBroker;
          break;
      }

      const success = await onBulkAssign(Array.from(selectedLeads), corretorId);
      
      if (success) {
        toast({
          title: "Operação realizada com sucesso!",
          description: getSuccessMessage(),
          variant: "default",
        });
        onClose();
      } else {
        toast({
          title: "Erro na operação",
          description: "Não foi possível completar a operação. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao processar operação:', error);
      toast({
        title: "Erro na operação",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get success message
  const getSuccessMessage = () => {
    const count = selectedLeads.size;
    const leadText = count === 1 ? 'lead' : 'leads';

    switch (actionType) {
      case 'vincular':
        return `${count} ${leadText} vinculado${count === 1 ? '' : 's'} ao corretor ${getBrokerName(targetBroker)}.`;
      case 'desvincular':
        return `${count} ${leadText} desvinculado${count === 1 ? '' : 's'} do corretor ${getBrokerName(sourceBroker)}.`;
      case 'transferir':
        return `${count} ${leadText} transferido${count === 1 ? '' : 's'} de ${getBrokerName(sourceBroker)} para ${getBrokerName(targetBroker)}.`;
      default:
        return 'Operação realizada com sucesso.';
    }
  };

  const availableLeads = getAvailableLeads();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-gray-900/95 border-gray-700/50 text-white max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            Gestão em Massa de Leads
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Ação Desejada */}
          <Card className="bg-gray-800/50 border-gray-700/60">
            <CardHeader>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-400" />
                Ação Desejada
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <RadioGroup value={actionType} onValueChange={(value) => setActionType(value as ActionType)}>
                <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
                  <RadioGroupItem value="vincular" id="vincular" />
                  <Label htmlFor="vincular" className="text-white cursor-pointer flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-green-400" />
                    Vincular Leads a um Corretor
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
                  <RadioGroupItem value="desvincular" id="desvincular" />
                  <Label htmlFor="desvincular" className="text-white cursor-pointer flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-400" />
                    Desvincular Leads de um Corretor
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-700/30 transition-colors">
                  <RadioGroupItem value="transferir" id="transferir" />
                  <Label htmlFor="transferir" className="text-white cursor-pointer flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-purple-400" />
                    Transferir Leads de um Corretor para Outro
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Separator className="bg-gray-700" />

          {/* Configurações baseadas na ação */}
          {actionType === 'vincular' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="bg-gray-800/50 border-gray-700/60">
                <CardContent className="p-6">
                  <h4 className="text-md font-medium text-white mb-4">Selecionar Corretor Destinatário</h4>
                  <Select value={targetBroker} onValueChange={setTargetBroker}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Escolha o corretor para vincular os leads" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {brokers.map(broker => (
                        <SelectItem key={broker.id} value={broker.id} className="text-white">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-amber-400" />
                            {broker.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {actionType === 'desvincular' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="bg-gray-800/50 border-gray-700/60">
                <CardContent className="p-6">
                  <h4 className="text-md font-medium text-white mb-4">Desvincular Leads do Corretor</h4>
                  <Select value={sourceBroker} onValueChange={setSourceBroker}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Escolha o corretor para desvincular leads" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {getBrokersWithLeads().map(broker => (
                        <SelectItem key={broker.id} value={broker.id} className="text-white">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-amber-400" />
                            {broker.full_name} ({leads.filter(l => l.id_corretor_responsavel === broker.id).length} leads)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {actionType === 'transferir' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gray-800/50 border-gray-700/60">
                  <CardContent className="p-6">
                    <h4 className="text-md font-medium text-white mb-4">Corretor Remetente</h4>
                    <Select value={sourceBroker} onValueChange={setSourceBroker}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Escolha o corretor remetente" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {getBrokersWithLeads().map(broker => (
                          <SelectItem key={broker.id} value={broker.id} className="text-white">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-amber-400" />
                              {broker.full_name} ({leads.filter(l => l.id_corretor_responsavel === broker.id).length} leads)
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/60">
                  <CardContent className="p-6">
                    <h4 className="text-md font-medium text-white mb-4">Corretor Destinatário</h4>
                    <Select value={targetBroker} onValueChange={setTargetBroker}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Escolha o corretor destinatário" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {brokers.filter(b => b.id !== sourceBroker).map(broker => (
                          <SelectItem key={broker.id} value={broker.id} className="text-white">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-amber-400" />
                              {broker.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Lista de Leads */}
          {(actionType === 'vincular' || (actionType === 'desvincular' && sourceBroker) || (actionType === 'transferir' && sourceBroker)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="bg-gray-800/50 border-gray-700/60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-400" />
                      Selecionar Leads ({selectedLeads.size} selecionados)
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllLeads}
                        disabled={availableLeads.length === 0}
                        className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                      >
                        Selecionar Todos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                        className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar leads por nome, email ou telefone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>

                  {/* Leads List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {availableLeads.map(lead => (
                      <div
                        key={lead.id}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          selectedLeads.has(lead.id)
                            ? 'bg-blue-900/30 border-blue-600'
                            : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                        }`}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white truncate">{lead.nome}</span>
                              {lead.stage && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {lead.stage}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              {lead.email && <div className="truncate">Email: {lead.email}</div>}
                              {lead.telefone && <div>Tel: {lead.telefone}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {availableLeads.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>
                          {actionType === 'vincular' && 'Nenhum lead sem corretor encontrado.'}
                          {actionType === 'desvincular' && 'Nenhum lead encontrado para este corretor.'}
                          {actionType === 'transferir' && 'Nenhum lead encontrado para este corretor.'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Resumo da Operação */}
          {selectedLeads.size > 0 && isFormValid() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
                <span className="font-medium text-white">Resumo da Operação</span>
              </div>
              <div className="text-sm text-gray-300">
                <div>• {selectedLeads.size} lead(s) selecionado(s)</div>
                <div>• {getSuccessMessage()}</div>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || isProcessing}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Alterações ({selectedLeads.size})
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}