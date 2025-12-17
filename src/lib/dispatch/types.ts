// Types para o sistema de configurações de disparador

export interface TimeWindow {
  start: string;     // "09:00"
  end: string;       // "18:00"  
  enabled: boolean;  // true/false
}

export interface TimeWindows {
  monday?: TimeWindow;
  tuesday?: TimeWindow;
  wednesday?: TimeWindow;
  thursday?: TimeWindow;
  friday?: TimeWindow;
  saturday?: TimeWindow;
  sunday?: TimeWindow;
}

export type BrokerAssignmentStrategy = 'round_robin' | 'random' | 'least_busy';

export interface DispatchConfiguration {
  id: string;
  name: string;
  description?: string;
  userId: string;
  companyId: string;
  
  // Configurações de Corretores
  assignedBrokers: string[];
  brokerAssignmentStrategy: BrokerAssignmentStrategy;
  
  // Configurações de Tempo
  timeWindows: TimeWindows;
  intervalBetweenMessages: number;  // millisegundos
  maxMessagesPerHour: number;
  
  // Template da Mensagem
  messageTemplate: string;
  
  // Status e Configurações Gerais
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  
  createdAt: string;
  updatedAt: string;
}

// Type para criação (campos opcionais)
export interface CreateDispatchConfiguration {
  name: string;
  description?: string;
  assignedBrokers?: string[];
  brokerAssignmentStrategy?: BrokerAssignmentStrategy;
  timeWindows?: TimeWindows;
  intervalBetweenMessages?: number;
  maxMessagesPerHour?: number;
  messageTemplate?: string;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
}

// Type para atualização (todos campos opcionais exceto id)
export interface UpdateDispatchConfiguration {
  id: string;
  name?: string;
  description?: string;
  assignedBrokers?: string[];
  brokerAssignmentStrategy?: BrokerAssignmentStrategy;
  timeWindows?: TimeWindows;
  intervalBetweenMessages?: number;
  maxMessagesPerHour?: number;
  messageTemplate?: string;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
}

// Type para dados vindos do banco (snake_case)
export interface DispatchConfigurationRow {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  company_id: string;
  assigned_brokers: string[];
  broker_assignment_strategy: BrokerAssignmentStrategy;
  time_windows: TimeWindows;
  interval_between_messages: number;
  max_messages_per_hour: number;
  message_template: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// Type para o contexto de aplicação de uma configuração
export interface DispatchConfigurationContext {
  configuration: DispatchConfiguration;
  availableBrokers: Array<{
    id: string;
    fullName: string;
    email: string;
    instances: Array<{
      id: string;
      instanceName: string;
      status: string;
    }>;
  }>;
  isValidTimeWindow: boolean;
  estimatedDuration: number; // em minutos
}

// Type para validação de configuração
export interface ConfigurationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Type para estatísticas de configuração
export interface ConfigurationStats {
  configurationId: string;
  totalUses: number;
  lastUsed?: string;
  avgMessagesPerUse: number;
  successRate: number;
}

// Enum para dias da semana
export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday', 
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

// Type para template de mensagem com variáveis
export interface MessageTemplate {
  content: string;
  variables: string[]; // ['nome', 'telefone', 'email']
  preview?: string;
}

// Type para distribuição de leads entre corretores
export interface LeadDistribution {
  brokerId: string;
  brokerName: string;
  assignedLeads: number;
  instanceId?: string;
}
