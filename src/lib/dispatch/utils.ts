import { DispatchConfiguration, DispatchConfigurationRow, TimeWindows, TimeWindow, TemplateVariables } from './types';

/**
 * Converte dados do banco (snake_case) para formato do frontend (camelCase)
 */
export function mapDispatchConfigurationFromDB(row: DispatchConfigurationRow): DispatchConfiguration {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    companyId: row.company_id,
    assignedBrokers: row.assigned_brokers,
    brokerAssignmentStrategy: row.broker_assignment_strategy,
    timeWindows: row.time_windows,
    intervalBetweenMessages: row.interval_between_messages,
    maxMessagesPerHour: row.max_messages_per_hour,
    messageTemplate: row.message_template,
    isActive: row.is_active,
    isDefault: row.is_default,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Converte dados do frontend (camelCase) para formato do banco (snake_case)
 */
export function mapDispatchConfigurationToDB(config: Partial<DispatchConfiguration>): Partial<DispatchConfigurationRow> {
  const result: Partial<DispatchConfigurationRow> = {};
  
  if (config.id !== undefined) result.id = config.id;
  if (config.name !== undefined) result.name = config.name;
  if (config.description !== undefined) result.description = config.description;
  if (config.userId !== undefined) result.user_id = config.userId;
  if (config.companyId !== undefined) result.company_id = config.companyId;
  if (config.assignedBrokers !== undefined) result.assigned_brokers = config.assignedBrokers;
  if (config.brokerAssignmentStrategy !== undefined) result.broker_assignment_strategy = config.brokerAssignmentStrategy;
  if (config.timeWindows !== undefined) result.time_windows = config.timeWindows;
  if (config.intervalBetweenMessages !== undefined) result.interval_between_messages = config.intervalBetweenMessages;
  if (config.maxMessagesPerHour !== undefined) result.max_messages_per_hour = config.maxMessagesPerHour;
  if (config.messageTemplate !== undefined) result.message_template = config.messageTemplate;
  if (config.isActive !== undefined) result.is_active = config.isActive;
  if (config.isDefault !== undefined) result.is_default = config.isDefault;
  if (config.priority !== undefined) result.priority = config.priority;
  if (config.createdAt !== undefined) result.created_at = config.createdAt;
  if (config.updatedAt !== undefined) result.updated_at = config.updatedAt;
  
  return result;
}

/**
 * Cria TimeWindows padrão (segunda a sexta 9h-18h, sábado 9h-14h)
 */
export function createDefaultTimeWindows(): TimeWindows {
  return {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '09:00', end: '14:00', enabled: true },
    sunday: { enabled: false }
  };
}

/**
 * Valida se o horário atual está dentro da janela permitida
 */
export function isValidTimeWindow(timeWindows: TimeWindows, date = new Date()): boolean {
  const dayNames: (keyof TimeWindows)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[date.getDay()];
  const currentTime = date.toTimeString().slice(0, 5); // "HH:MM"
  
  const dayConfig = timeWindows[currentDay];
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }
  
  return currentTime >= dayConfig.start && currentTime <= dayConfig.end;
}

/**
 * Valida estrutura de TimeWindow
 */
export function validateTimeWindow(timeWindow: TimeWindow): string[] {
  const errors: string[] = [];
  
  if (!timeWindow.start || !timeWindow.end) {
    errors.push('Horário de início e fim são obrigatórios');
    return errors;
  }
  
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(timeWindow.start)) {
    errors.push('Horário de início inválido (formato: HH:MM)');
  }
  
  if (!timeRegex.test(timeWindow.end)) {
    errors.push('Horário de fim inválido (formato: HH:MM)');
  }
  
  if (timeWindow.start >= timeWindow.end) {
    errors.push('Horário de início deve ser anterior ao horário de fim');
  }
  
  return errors;
}

/**
 * Resolve variáveis em template de mensagem
 */
export function resolveMessageTemplate(template: string, variables: Record<string, string>): string {
  let resolved = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  });
  
  return resolved;
}

/**
 * Extrai variáveis de um template
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g);
  if (!matches) return [];
  
  return matches.map(match => match.slice(1, -1)); // Remove { }
}

/**
 * Valida template de mensagem
 */
export function validateMessageTemplate(template: string): string[] {
  const errors: string[] = [];
  
  if (!template.trim()) {
    errors.push('Template de mensagem não pode estar vazio');
    return errors;
  }
  
  if (template.length < 10) {
    errors.push('Template de mensagem muito curto (mínimo 10 caracteres)');
  }
  
  if (template.length > 1000) {
    errors.push('Template de mensagem muito longo (máximo 1000 caracteres)');
  }
  
  // Verificar variáveis malformadas
  const malformedVars = template.match(/\{[^}]*$/g) || template.match(/^[^{]*\}/g);
  if (malformedVars && malformedVars.length > 0) {
    errors.push('Template contém variáveis malformadas (verifique { })');
  }
  
  return errors;
}

/**
 * Distribui leads entre corretores usando estratégia round-robin
 */
export function distributeLeadsRoundRobin<T>(items: T[], brokerIds: string[]): Map<string, T[]> {
  const distribution = new Map<string, T[]>();
  
  // Inicializar arrays para cada corretor
  brokerIds.forEach(id => distribution.set(id, []));
  
  // Distribuir items
  items.forEach((item, index) => {
    const brokerId = brokerIds[index % brokerIds.length];
    distribution.get(brokerId)?.push(item);
  });
  
  return distribution;
}

/**
 * Distribui leads aleatoriamente
 */
export function distributeLeadsRandom<T>(items: T[], brokerIds: string[]): Map<string, T[]> {
  const distribution = new Map<string, T[]>();
  
  // Inicializar arrays para cada corretor
  brokerIds.forEach(id => distribution.set(id, []));
  
  // Distribuir items aleatoriamente
  items.forEach(item => {
    const randomIndex = Math.floor(Math.random() * brokerIds.length);
    const brokerId = brokerIds[randomIndex];
    distribution.get(brokerId)?.push(item);
  });
  
  return distribution;
}

/**
 * Calcula estimativa de duração do envio
 */
export function estimateDispatchDuration(
  messageCount: number, 
  intervalMs: number, 
  brokerCount: number = 1
): number {
  if (brokerCount === 0) return 0;
  
  const messagesPerBroker = Math.ceil(messageCount / brokerCount);
  const totalTimeMs = messagesPerBroker * intervalMs;
  
  return Math.ceil(totalTimeMs / 60000); // Retorna em minutos
}

/**
 * Formata duração em minutos para texto legível
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'Menos de 1 minuto';
  if (minutes < 60) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  let result = `${hours} hora${hours > 1 ? 's' : ''}`;
  if (remainingMinutes > 0) {
    result += ` e ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}`;
  }
  
  return result;
}
