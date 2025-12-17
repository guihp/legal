import { DispatchConfiguration } from '@/lib/dispatch/types';
import { 
  isValidTimeWindow, 
  distributeLeadsRoundRobin, 
  distributeLeadsRandom,
  resolveMessageTemplate 
} from '@/lib/dispatch/utils';
import { logAudit } from '@/lib/audit/logger';

export interface DispatchRow {
  nome: string;
  telefone: string;
  email?: string;
}

export interface DispatchResult {
  totalSent: number;
  totalErrors: number;
  errors: string[];
  duration: number;
  brokerDistribution: Record<string, number>;
}

export interface DispatchContext {
  configuration?: DispatchConfiguration;
  instances: Array<{
    id: string;
    user_id: string;
    instance_name: string;
    status: string;
  }>;
  sendMessage: (params: {
    chat_id: string;
    instance_id: string;
    contact_phone: string;
    message_type: 'text';
    content: string;
  }) => Promise<void>;
  createChat: (params: {
    instance_id: string;
    contact_phone: string;
    contact_name?: string;
  }) => Promise<{ id: string }>;
  loadChats: (instanceId: string) => Promise<Array<{
    id: string;
    contact_phone: string;
  }>>;
}

export class DispatchService {
  /**
   * Valida se o envio pode ser executado no horário atual
   */
  static validateTimeWindow(configuration?: DispatchConfiguration): {
    isValid: boolean;
    reason?: string;
  } {
    if (!configuration?.timeWindows) {
      return { isValid: true }; // Sem restrições
    }

    const isValid = isValidTimeWindow(configuration.timeWindows);
    if (!isValid) {
      return {
        isValid: false,
        reason: 'Envio fora do horário de funcionamento configurado'
      };
    }

    return { isValid: true };
  }

  /**
   * Distribui leads entre corretores baseado na estratégia configurada
   */
  static distributeLeads(
    rows: DispatchRow[],
    configuration?: DispatchConfiguration
  ): Map<string, DispatchRow[]> {
    if (!configuration?.assignedBrokers.length) {
      // Sem configuração específica, usar uma única "fila"
      return new Map([['default', rows]]);
    }

    const { assignedBrokers, brokerAssignmentStrategy } = configuration;

    switch (brokerAssignmentStrategy) {
      case 'round_robin':
        return distributeLeadsRoundRobin(rows, assignedBrokers);
      case 'random':
        return distributeLeadsRandom(rows, assignedBrokers);
      case 'least_busy':
        // TODO: Implementar lógica baseada em carga atual
        // Por enquanto, usar round robin
        return distributeLeadsRoundRobin(rows, assignedBrokers);
      default:
        return distributeLeadsRoundRobin(rows, assignedBrokers);
    }
  }

  /**
   * Seleciona instância WhatsApp baseada no corretor
   */
  static selectInstance(
    brokerId: string,
    instances: DispatchContext['instances']
  ): string | null {
    // Buscar instância ativa do corretor
    const brokerInstance = instances.find(
      i => i.user_id === brokerId && i.status === 'connected'
    );

    if (brokerInstance) {
      return brokerInstance.id;
    }

    // Fallback: qualquer instância ativa
    const activeInstance = instances.find(i => i.status === 'connected');
    return activeInstance?.id || null;
  }

  /**
   * Executa envio em lote com configuração aplicada
   */
  static async executeBulkDispatch(
    rows: DispatchRow[],
    context: DispatchContext,
    onProgress?: (sent: number, total: number) => void,
    onError?: (error: string) => void
  ): Promise<DispatchResult> {
    const startTime = Date.now();
    const { configuration } = context;
    
    // Validar horário se configurado
    const timeValidation = this.validateTimeWindow(configuration);
    if (!timeValidation.isValid) {
      throw new Error(timeValidation.reason);
    }

    // Configurações de envio
    const intervalMs = configuration?.intervalBetweenMessages || 150;
    const messageTemplate = configuration?.messageTemplate || 'Olá {nome}, tudo bem?';

    // Distribuir leads entre corretores
    const distribution = this.distributeLeads(rows, configuration);
    
    // Resultados
    let totalSent = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const brokerDistribution: Record<string, number> = {};

    // Log início
    try {
      await logAudit({
        action: 'bulk_whatsapp.started',
        resource: 'dispatch_service',
        resourceId: configuration?.id,
        meta: {
          total_rows: rows.length,
          configuration_id: configuration?.id,
          broker_count: distribution.size,
          interval_ms: intervalMs
        }
      });
    } catch {}

    // Processar cada grupo de corretor
    for (const [brokerId, brokerRows] of distribution) {
      let brokerSent = 0;
      
      // Selecionar instância para este corretor
      const instanceId = brokerId === 'default' 
        ? context.instances.find(i => i.status === 'connected')?.id
        : this.selectInstance(brokerId, context.instances);

      if (!instanceId) {
        const errorMsg = `Nenhuma instância ativa encontrada para corretor ${brokerId}`;
        errors.push(errorMsg);
        onError?.(errorMsg);
        totalErrors += brokerRows.length;
        continue;
      }

      // Carregar chats existentes
      try {
        const existingChats = await context.loadChats(instanceId);
        const phoneToChat = new Map(
          existingChats.map(chat => [chat.contact_phone, chat.id])
        );

        // Processar cada lead do corretor
        for (const row of brokerRows) {
          try {
            const phone = (row.telefone || '').replace(/\D/g, '');
            if (!phone) {
              const errorMsg = `Telefone ausente para ${row.nome || row.email || 'sem nome'}`;
              errors.push(errorMsg);
              onError?.(errorMsg);
              totalErrors++;
              continue;
            }

            // Criar ou obter chat
            let chatId = phoneToChat.get(phone);
            if (!chatId) {
              const newChat = await context.createChat({
                instance_id: instanceId,
                contact_phone: phone,
                contact_name: row.nome || undefined
              });
              chatId = newChat.id;
              phoneToChat.set(phone, chatId);
            }

            // Resolver template da mensagem
            const messageContent = resolveMessageTemplate(messageTemplate, {
              nome: row.nome || '',
              telefone: row.telefone || '',
              email: row.email || ''
            });

            // Enviar mensagem
            await context.sendMessage({
              chat_id: chatId,
              instance_id: instanceId,
              contact_phone: phone,
              message_type: 'text',
              content: messageContent
            });

            totalSent++;
            brokerSent++;
            onProgress?.(totalSent, rows.length);

            // Aguardar intervalo configurado
            if (intervalMs > 0) {
              await new Promise(resolve => setTimeout(resolve, intervalMs));
            }

          } catch (error: any) {
            const errorMsg = `Erro ao enviar para ${row.telefone}: ${error?.message || error}`;
            errors.push(errorMsg);
            onError?.(errorMsg);
            totalErrors++;
          }
        }

        brokerDistribution[brokerId] = brokerSent;

      } catch (error: any) {
        const errorMsg = `Erro ao processar corretor ${brokerId}: ${error?.message || error}`;
        errors.push(errorMsg);
        onError?.(errorMsg);
        totalErrors += brokerRows.length;
      }
    }

    const duration = Date.now() - startTime;

    // Log conclusão
    try {
      await logAudit({
        action: 'bulk_whatsapp.finished',
        resource: 'dispatch_service',
        resourceId: configuration?.id,
        meta: {
          total_sent: totalSent,
          total_errors: totalErrors,
          total_rows: rows.length,
          duration_ms: duration,
          configuration_id: configuration?.id,
          broker_distribution: brokerDistribution
        }
      });
    } catch {}

    return {
      totalSent,
      totalErrors,
      errors,
      duration,
      brokerDistribution
    };
  }

  /**
   * Estima tempo de execução baseado na configuração
   */
  static estimateExecutionTime(
    rowCount: number,
    configuration?: DispatchConfiguration
  ): number {
    const intervalMs = configuration?.intervalBetweenMessages || 150;
    const brokerCount = configuration?.assignedBrokers.length || 1;
    
    const messagesPerBroker = Math.ceil(rowCount / brokerCount);
    const totalTimeMs = messagesPerBroker * intervalMs;
    
    return Math.ceil(totalTimeMs / 60000); // Retorna em minutos
  }

  /**
   * Valida se uma configuração pode ser aplicada
   */
  static validateConfiguration(
    configuration: DispatchConfiguration,
    instances: DispatchContext['instances']
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verificar se há corretores configurados
    if (configuration.assignedBrokers.length === 0) {
      errors.push('Nenhum corretor atribuído à configuração');
    }

    // Verificar se há instâncias ativas para os corretores
    const availableInstances = configuration.assignedBrokers.filter(brokerId =>
      instances.some(i => i.user_id === brokerId && i.status === 'connected')
    );

    if (availableInstances.length === 0) {
      errors.push('Nenhuma instância WhatsApp ativa para os corretores configurados');
    }

    // Verificar horário se configurado
    const timeValidation = this.validateTimeWindow(configuration);
    if (!timeValidation.isValid) {
      errors.push(timeValidation.reason || 'Horário inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
