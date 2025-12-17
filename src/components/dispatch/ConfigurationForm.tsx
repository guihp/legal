import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Save, 
  X, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  MessageSquare,
  Zap,
  Target
} from 'lucide-react';
import { 
  DispatchConfiguration, 
  CreateDispatchConfiguration, 
  UpdateDispatchConfiguration,
  BrokerAssignmentStrategy
} from '@/lib/dispatch/types';
import { 
  createDefaultTimeWindows, 
  formatDuration, 
  estimateDispatchDuration 
} from '@/lib/dispatch/utils';
import { useDispatchConfigurations } from '@/hooks/useDispatchConfigurations';
import { BrokerSelectorSimple } from './BrokerSelectorSimple';
import { TimeWindowEditor } from './TimeWindowEditor';
import { MessageTemplateEditor } from './MessageTemplateEditor';

interface ConfigurationFormProps {
  isOpen: boolean;
  onClose: () => void;
  configurationToEdit?: DispatchConfiguration | null;
  onSuccess?: (config: DispatchConfiguration) => void;
}

interface FormData {
  name: string;
  description: string;
  assignedBrokers: string[];
  brokerAssignmentStrategy: BrokerAssignmentStrategy;
  timeWindows: any;
  intervalBetweenMessages: number;
  maxMessagesPerHour: number;
  messageTemplate: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
}

const strategyLabels: Record<BrokerAssignmentStrategy, string> = {
  round_robin: 'Rotação (Round Robin)',
  random: 'Aleatório',
  least_busy: 'Menos Ocupado'
};

const defaultFormData: FormData = {
  name: '',
  description: '',
  assignedBrokers: [],
  brokerAssignmentStrategy: 'round_robin',
  timeWindows: createDefaultTimeWindows(),
  intervalBetweenMessages: 150,
  maxMessagesPerHour: 100,
  messageTemplate: 'Olá {nome}, tudo bem? Vi seu interesse no imóvel e gostaria de ajudar. Quando podemos conversar?',
  isActive: true,
  isDefault: false,
  priority: 0
};

export function ConfigurationForm({
  isOpen,
  onClose,
  configurationToEdit,
  onSuccess
}: ConfigurationFormProps) {
  const {
    createConfiguration,
    updateConfiguration,
    validateConfiguration,
    loading,
    error: hookError
  } = useDispatchConfigurations();

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(configurationToEdit);

  // Carregar dados para edição
  useEffect(() => {
    if (isOpen) {
      if (configurationToEdit) {
        setFormData({
          name: configurationToEdit.name,
          description: configurationToEdit.description || '',
          assignedBrokers: configurationToEdit.assignedBrokers,
          brokerAssignmentStrategy: configurationToEdit.brokerAssignmentStrategy,
          timeWindows: configurationToEdit.timeWindows,
          intervalBetweenMessages: configurationToEdit.intervalBetweenMessages,
          maxMessagesPerHour: configurationToEdit.maxMessagesPerHour,
          messageTemplate: configurationToEdit.messageTemplate,
          isActive: configurationToEdit.isActive,
          isDefault: configurationToEdit.isDefault,
          priority: configurationToEdit.priority
        });
      } else {
        setFormData(defaultFormData);
      }
      setErrors([]);
      setWarnings([]);
    }
  }, [isOpen, configurationToEdit]);

  // Mostrar erros do hook
  useEffect(() => {
    if (hookError) {
      setErrors([hookError]);
    }
  }, [hookError]);

  // Validar apenas no submit para evitar loops infinitos

  const handleInputChange = (field: keyof FormData, value: any) => {
    console.log('handleInputChange:', field, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBrokerSelectionChange = (brokerIds: string[]) => {
    console.log('handleBrokerSelectionChange:', brokerIds);
    setFormData(prev => ({ ...prev, assignedBrokers: brokerIds }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar antes de submeter
    const validation = validateConfiguration(formData);
    setErrors(validation.errors);
    setWarnings(validation.warnings);
    
    if (validation.errors.length > 0) {
      return;
    }

    setSaving(true);

    try {
      let result: DispatchConfiguration | null = null;

      if (isEditing && configurationToEdit) {
        const updateData: UpdateDispatchConfiguration = {
          id: configurationToEdit.id,
          ...formData
        };
        result = await updateConfiguration(updateData);
      } else {
        const createData: CreateDispatchConfiguration = formData;
        result = await createConfiguration(createData);
      }

      if (result) {
        onSuccess?.(result);
        onClose();
      } else {
        // Se result é null, o erro já foi definido no hook
        // Não precisamos fazer nada aqui
      }

    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setErrors([error.message || 'Erro ao salvar configuração']);
    } finally {
      setSaving(false);
    }
  };

  const estimatedTime = estimateDispatchDuration(
    100, 
    formData.intervalBetweenMessages, 
    formData.assignedBrokers.length
  );

  const activeDays = Object.values(formData.timeWindows || {}).filter((day: any) => day?.enabled).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {isEditing ? 'Editar Configuração' : 'Nova Configuração'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4" />
                Informações Básicas
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Nome da Configuração *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Modelo Corretor A - Manhã"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Prioridade</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 0)}
                    min="0"
                    max="100"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrição opcional da configuração..."
                  className="bg-gray-900/50 border-gray-700 text-white"
                  disabled={saving}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                    disabled={saving}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <Label className="text-gray-300">Configuração ativa</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => handleInputChange('isDefault', checked)}
                    disabled={saving}
                    className="data-[state=checked]:bg-yellow-600"
                  />
                  <Label className="text-gray-300">Definir como padrão</Label>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* Seleção de Corretores */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4" />
                Corretores e Distribuição
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <BrokerSelectorSimple
                    selectedBrokerIds={formData.assignedBrokers}
                    onSelectionChange={handleBrokerSelectionChange}
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Estratégia de Distribuição</Label>
                  <Select
                    value={formData.brokerAssignmentStrategy}
                    onValueChange={(value: BrokerAssignmentStrategy) => 
                      handleInputChange('brokerAssignmentStrategy', value)
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {Object.entries(strategyLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-white">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Como distribuir leads entre os corretores selecionados
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* Horários de Funcionamento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horários de Funcionamento
              </h3>
              
              <TimeWindowEditor
                value={formData.timeWindows}
                onChange={(timeWindows) => handleInputChange('timeWindows', timeWindows)}
                disabled={saving}
              />
            </div>

            <Separator className="bg-gray-700" />

            {/* Configurações de Envio */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Configurações de Envio
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Intervalo entre Mensagens (ms)</Label>
                  <Input
                    type="number"
                    value={formData.intervalBetweenMessages}
                    onChange={(e) => handleInputChange('intervalBetweenMessages', parseInt(e.target.value) || 150)}
                    min="50"
                    max="10000"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tempo de espera entre envios (recomendado: 150ms)
                  </p>
                </div>
                
                <div>
                  <Label className="text-gray-300">Máximo por Hora</Label>
                  <Input
                    type="number"
                    value={formData.maxMessagesPerHour}
                    onChange={(e) => handleInputChange('maxMessagesPerHour', parseInt(e.target.value) || 100)}
                    min="10"
                    max="500"
                    className="bg-gray-900/50 border-gray-700 text-white"
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Limite de mensagens por hora (recomendado: 100)
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* Template de Mensagem */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Template de Mensagem
              </h3>
              
              <MessageTemplateEditor
                value={formData.messageTemplate}
                onChange={(template) => handleInputChange('messageTemplate', template)}
                disabled={saving}
              />
            </div>

            {/* Resumo da Configuração */}
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h4 className="text-sm font-medium text-white mb-3">Resumo da Configuração</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Corretores:</span>
                  <span className="text-white font-medium">{formData.assignedBrokers.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Dias ativos:</span>
                  <span className="text-white font-medium">{activeDays}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Tempo est.:</span>
                  <span className="text-white font-medium">{formatDuration(estimatedTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Limite/h:</span>
                  <span className="text-white font-medium">{formData.maxMessagesPerHour}</span>
                </div>
              </div>
            </div>

            {/* Validação */}
            {(errors.length > 0 || warnings.length > 0) && (
              <div className="space-y-2">
                {errors.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Erros encontrados:
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-400 font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Avisos:
                    </div>
                    <ul className="text-sm text-yellow-300 space-y-1">
                      {warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving || errors.length > 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Atualizar Configuração' : 'Criar Configuração'}
                  </div>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                Cancelar
              </Button>

              {errors.length === 0 && warnings.length === 0 && (
                <div className="flex items-center gap-1 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Configuração válida
                </div>
              )}
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
