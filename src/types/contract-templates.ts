import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// Tipos do banco de dados
export type ContractTemplate = Tables<'contract_templates'>;
export type ContractTemplateInsert = TablesInsert<'contract_templates'>;
export type ContractTemplateUpdate = TablesUpdate<'contract_templates'>;

// Tipos para upload de arquivos
export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// Configurações de upload
export const ALLOWED_FILE_TYPES: string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.oasis.opendocument.text': 'OpenDocument (.odt)'
}; 