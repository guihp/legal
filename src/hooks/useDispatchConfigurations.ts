import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { logAudit } from '@/lib/audit/logger';
import {
  DispatchConfiguration,
  DispatchConfigurationRow,
  CreateDispatchConfiguration,
  UpdateDispatchConfiguration,
  ConfigurationValidation
} from '@/lib/dispatch/types';
import {
  mapDispatchConfigurationFromDB,
  mapDispatchConfigurationToDB,
  createDefaultTimeWindows,
  validateTimeWindow,
  validateMessageTemplate,
  extractTemplateVariables
} from '@/lib/dispatch/utils';

export function useDispatchConfigurations() {
  const { profile } = useUserProfile();
  const [configurations, setConfigurations] = useState<DispatchConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar todas as configurações da empresa
  const loadConfigurations = useCallback(async () => {
    if (!profile?.company_id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from('dispatch_configurations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      const mappedConfigurations = data.map((row: DispatchConfigurationRow) => 
        mapDispatchConfigurationFromDB(row)
      );

      setConfigurations(mappedConfigurations);

      // Audit log
      try {
        await logAudit({
          action: 'dispatch_configurations.list',
          resource: 'dispatch_configurations',
          resourceId: undefined,
          meta: { count: mappedConfigurations.length, company_id: profile.company_id }
        });
      } catch (auditError) {
        console.warn('Falha no audit log:', auditError);
      }

    } catch (err: any) {
      console.error('Erro ao carregar configurações:', err);
      setError(err.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  // Criar nova configuração
  const createConfiguration = useCallback(async (
    configData: CreateDispatchConfiguration
  ): Promise<DispatchConfiguration | null> => {
    if (!profile?.id) {
      setError('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Validar dados antes de enviar
      const validation = validateConfiguration({
        ...configData,
        timeWindows: configData.timeWindows || createDefaultTimeWindows(),
        messageTemplate: configData.messageTemplate || 'Olá {nome}, tudo bem?'
      });

      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // Preparar dados para inserção
      const insertData = mapDispatchConfigurationToDB({
        name: configData.name,
        description: configData.description,
        userId: profile.id,
        companyId: profile.company_id,
        assignedBrokers: configData.assignedBrokers || [],
        brokerAssignmentStrategy: configData.brokerAssignmentStrategy || 'round_robin',
        timeWindows: configData.timeWindows || createDefaultTimeWindows(),
        intervalBetweenMessages: configData.intervalBetweenMessages || 150,
        maxMessagesPerHour: configData.maxMessagesPerHour || 100,
        messageTemplate: configData.messageTemplate || 'Olá {nome}, tudo bem?',
        isActive: configData.isActive !== undefined ? configData.isActive : true,
        isDefault: configData.isDefault || false,
        priority: configData.priority || 0
      });

      const { data, error: supabaseError } = await supabase
        .from('dispatch_configurations')
        .insert(insertData)
        .select()
        .single();

      if (supabaseError) throw supabaseError;

      const newConfiguration = mapDispatchConfigurationFromDB(data);
      setConfigurations(prev => [newConfiguration, ...prev]);

      // Audit log
      try {
        await logAudit({
          action: 'dispatch_configurations.create',
          resource: 'dispatch_configurations',
          resourceId: newConfiguration.id,
          meta: { 
            name: newConfiguration.name,
            assigned_brokers_count: newConfiguration.assignedBrokers.length
          }
        });
      } catch (auditError) {
        console.warn('Falha no audit log:', auditError);
      }

      return newConfiguration;

    } catch (err: any) {
      console.error('Erro ao criar configuração:', err);
      
      // Tratamento específico para nome duplicado
      if (err.code === '23505' || err.message?.includes('duplicate key')) {
        setError(`Já existe uma configuração com o nome "${configData.name}" nesta empresa. Escolha um nome diferente.`);
      } else {
        setError(err.message || 'Erro ao criar configuração');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.company_id]);

  // Atualizar configuração existente
  const updateConfiguration = useCallback(async (
    updateData: UpdateDispatchConfiguration
  ): Promise<DispatchConfiguration | null> => {
    if (!profile?.id) {
      setError('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { id, ...dataToUpdate } = updateData;

      // Validar dados se fornecidos
      if (dataToUpdate.timeWindows || dataToUpdate.messageTemplate) {
        const currentConfig = configurations.find(c => c.id === id);
        if (!currentConfig) throw new Error('Configuração não encontrada');

        const validation = validateConfiguration({
          ...currentConfig,
          ...dataToUpdate
        });

        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }
      }

      // Preparar dados para atualização
      const updateDbData = mapDispatchConfigurationToDB(dataToUpdate);

      const { data, error: supabaseError } = await supabase
        .from('dispatch_configurations')
        .update(updateDbData)
        .eq('id', id)
        .select()
        .single();

      if (supabaseError) throw supabaseError;

      const updatedConfiguration = mapDispatchConfigurationFromDB(data);
      setConfigurations(prev => 
        prev.map(config => config.id === id ? updatedConfiguration : config)
      );

      // Audit log
      try {
        await logAudit({
          action: 'dispatch_configurations.update',
          resource: 'dispatch_configurations',
          resourceId: id,
          meta: { 
            updated_fields: Object.keys(dataToUpdate),
            name: updatedConfiguration.name
          }
        });
      } catch (auditError) {
        console.warn('Falha no audit log:', auditError);
      }

      return updatedConfiguration;

    } catch (err: any) {
      console.error('Erro ao atualizar configuração:', err);
      setError(err.message || 'Erro ao atualizar configuração');
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.id, configurations]);

  // Deletar configuração
  const deleteConfiguration = useCallback(async (id: string): Promise<boolean> => {
    if (!profile?.id) {
      setError('Usuário não autenticado');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const configToDelete = configurations.find(c => c.id === id);
      
      const { error: supabaseError } = await supabase
        .from('dispatch_configurations')
        .delete()
        .eq('id', id);

      if (supabaseError) throw supabaseError;

      setConfigurations(prev => prev.filter(config => config.id !== id));

      // Audit log
      try {
        await logAudit({
          action: 'dispatch_configurations.delete',
          resource: 'dispatch_configurations',
          resourceId: id,
          meta: { 
            name: configToDelete?.name || 'Configuração deletada'
          }
        });
      } catch (auditError) {
        console.warn('Falha no audit log:', auditError);
      }

      return true;

    } catch (err: any) {
      console.error('Erro ao deletar configuração:', err);
      setError(err.message || 'Erro ao deletar configuração');
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile?.id, configurations]);

  // Duplicar configuração
  const duplicateConfiguration = useCallback(async (id: string): Promise<DispatchConfiguration | null> => {
    const originalConfig = configurations.find(c => c.id === id);
    if (!originalConfig) {
      setError('Configuração não encontrada');
      return null;
    }

    return createConfiguration({
      name: `${originalConfig.name} (Cópia)`,
      description: originalConfig.description,
      assignedBrokers: originalConfig.assignedBrokers,
      brokerAssignmentStrategy: originalConfig.brokerAssignmentStrategy,
      timeWindows: originalConfig.timeWindows,
      intervalBetweenMessages: originalConfig.intervalBetweenMessages,
      maxMessagesPerHour: originalConfig.maxMessagesPerHour,
      messageTemplate: originalConfig.messageTemplate,
      isActive: false, // Duplicata inicia inativa
      isDefault: false,
      priority: originalConfig.priority
    });
  }, [configurations, createConfiguration]);

  // Toggle status ativo/inativo
  const toggleActive = useCallback(async (id: string): Promise<boolean> => {
    const config = configurations.find(c => c.id === id);
    if (!config) {
      setError('Configuração não encontrada');
      return false;
    }

    const result = await updateConfiguration({
      id,
      isActive: !config.isActive
    });

    return result !== null;
  }, [configurations, updateConfiguration]);

  // Definir como padrão
  const setAsDefault = useCallback(async (id: string): Promise<boolean> => {
    const config = configurations.find(c => c.id === id);
    if (!config) {
      setError('Configuração não encontrada');
      return false;
    }

    setLoading(true);

    try {
      // Primeiro, remover default de todas as outras configurações
      await supabase
        .from('dispatch_configurations')
        .update({ is_default: false })
        .eq('company_id', profile?.company_id)
        .neq('id', id);

      // Depois, definir a atual como padrão
      const result = await updateConfiguration({
        id,
        isDefault: true
      });

      // Atualizar estado local
      setConfigurations(prev => 
        prev.map(c => ({
          ...c,
          isDefault: c.id === id
        }))
      );

      return result !== null;

    } catch (err: any) {
      console.error('Erro ao definir como padrão:', err);
      setError(err.message || 'Erro ao definir como padrão');
      return false;
    } finally {
      setLoading(false);
    }
  }, [configurations, updateConfiguration, profile?.company_id]);

  // Validar configuração completa
  const validateConfiguration = useCallback((config: Partial<DispatchConfiguration>): ConfigurationValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Nome obrigatório
    if (!config.name?.trim()) {
      errors.push('Nome da configuração é obrigatório');
    }

    // Validar janelas de tempo
    if (config.timeWindows) {
      Object.entries(config.timeWindows).forEach(([day, timeWindow]) => {
        if (timeWindow && timeWindow.enabled) {
          const timeErrors = validateTimeWindow(timeWindow);
          errors.push(...timeErrors.map(err => `${day}: ${err}`));
        }
      });
    }

    // Validar template de mensagem
    if (config.messageTemplate) {
      const templateErrors = validateMessageTemplate(config.messageTemplate);
      errors.push(...templateErrors);

      // Warning se não tem variáveis
      const variables = extractTemplateVariables(config.messageTemplate);
      if (variables.length === 0) {
        warnings.push('Template não contém variáveis personalizáveis');
      }
    }

    // Validar intervalos
    if (config.intervalBetweenMessages !== undefined) {
      if (config.intervalBetweenMessages < 50) {
        warnings.push('Intervalo muito baixo pode causar bloqueios');
      }
      if (config.intervalBetweenMessages > 5000) {
        warnings.push('Intervalo muito alto pode tornar o envio muito lento');
      }
    }

    // Validar limite por hora
    if (config.maxMessagesPerHour !== undefined) {
      if (config.maxMessagesPerHour > 300) {
        warnings.push('Limite muito alto pode causar bloqueios');
      }
      if (config.maxMessagesPerHour < 10) {
        warnings.push('Limite muito baixo pode tornar o envio muito lento');
      }
    }

    // Warning se não tem corretores atribuídos
    if (config.assignedBrokers && config.assignedBrokers.length === 0) {
      warnings.push('Nenhum corretor atribuído à configuração');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  // Buscar configurações por filtros
  const searchConfigurations = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return configurations;

    const term = searchTerm.toLowerCase();
    return configurations.filter(config => 
      config.name.toLowerCase().includes(term) ||
      config.description?.toLowerCase().includes(term) ||
      config.messageTemplate.toLowerCase().includes(term)
    );
  }, [configurations]);

  // Carregar configurações quando o componente monta
  useEffect(() => {
    if (profile?.company_id) {
      loadConfigurations();
    }
  }, [profile?.company_id, loadConfigurations]);

  return {
    // Estado
    configurations,
    loading,
    error,

    // Ações CRUD
    loadConfigurations,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    duplicateConfiguration,

    // Ações especiais
    toggleActive,
    setAsDefault,

    // Utilitários
    validateConfiguration,
    searchConfigurations,

    // Getters
    getActiveConfigurations: () => configurations.filter(c => c.isActive),
    getDefaultConfiguration: () => configurations.find(c => c.isDefault),
    getConfigurationById: (id: string) => configurations.find(c => c.id === id)
  };
}
