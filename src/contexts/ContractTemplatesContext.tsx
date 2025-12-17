import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { 
  FileUploadProgress, 
  UploadResult, 
  ALLOWED_FILE_TYPES, 
  MAX_FILE_SIZE 
} from '@/types/contract-templates';

type ContractTemplate = Tables<'contract_templates'>;
type ContractTemplateInsert = TablesInsert<'contract_templates'>;
type ContractTemplateUpdate = TablesUpdate<'contract_templates'>;

interface ContractTemplatesContextType {
  templates: ContractTemplate[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  uploadProgress: FileUploadProgress | null;
  createTemplate: (name: string, description: string | null, templateType: 'Locação' | 'Venda', file: File) => Promise<{ success: boolean; error?: string; template?: ContractTemplate }>;
  updateTemplate: (id: string, updates: ContractTemplateUpdate) => Promise<{ success: boolean; error?: string }>;
  deleteTemplate: (id: string) => Promise<void>;
  getFileUrl: (filePath: string) => Promise<string>;
  downloadFile: (template: ContractTemplate) => Promise<void>;
  refetch: () => Promise<void>;
}

const ContractTemplatesContext = createContext<ContractTemplatesContextType | undefined>(undefined);

export const useContractTemplates = () => {
  const context = useContext(ContractTemplatesContext);
  if (context === undefined) {
    throw new Error('useContractTemplates must be used within a ContractTemplatesProvider');
  }
  return context;
};

interface ContractTemplatesProviderProps {
  children: ReactNode;
}

export const ContractTemplatesProvider: React.FC<ContractTemplatesProviderProps> = ({ children }) => {
  console.log('🎭 ContractTemplatesProvider MONTADO/RENDERIZADO');
  
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null);

  // Buscar templates do banco
  const fetchTemplates = async () => {
    try {
      console.log('🔍 Iniciando busca de templates...');
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('📊 Resultado da busca:', { data, error });

      if (error) {
        console.error('❌ Erro ao buscar templates:', error);
        
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          setError('Tabela de templates não encontrada. Execute a migração do banco de dados.');
        } else {
          setError(`Erro ao carregar templates: ${error.message}`);
        }
        return;
      }

      console.log('✅ Templates carregados com sucesso:', data?.length || 0);
      setTemplates(data || []);
    } catch (err) {
      console.error('💥 Erro inesperado ao buscar templates:', err);
      setError('Erro inesperado ao carregar templates. Verifique a conexão com o banco.');
    } finally {
      setLoading(false);
    }
  };

  // Validar arquivo
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido. Tipos aceitos: ${ALLOWED_FILE_TYPES.join(', ')}`
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    return { valid: true };
  };

  // Upload de arquivo
  const uploadFile = async (file: File): Promise<UploadResult> => {
    try {
      setUploading(true);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id || 'anonymous';

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop();
      const fileName = `${timestamp}-${randomString}.${fileExtension}`;
      const filePath = `contract-templates/${userId}/${fileName}`;

      setUploadProgress({ loaded: file.size * 0.1, total: file.size, percentage: 10 });

      const { data, error } = await supabase.storage
        .from('contract-templates')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Erro no upload:', error);
        throw error;
      }

      if (!data?.path) {
        throw new Error('Erro ao fazer upload do arquivo');
      }

      setUploadProgress({ loaded: file.size, total: file.size, percentage: 100 });

      return { success: true, filePath: data.path };

    } catch (error) {
      console.error('Erro no upload:', error);
      setError(error instanceof Error ? error.message : 'Erro no upload do arquivo');
      return { success: false, error: error instanceof Error ? error.message : 'Erro no upload' };
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
      }, 1000);
    }
  };

  // Criar template
  const createTemplate = async (
    name: string,
    description: string | null,
    templateType: 'Locação' | 'Venda',
    file: File
  ): Promise<{ success: boolean; error?: string; template?: ContractTemplate }> => {
    try {
      const uploadResult = await uploadFile(file);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      const { data: { user } } = await supabase.auth.getUser();

      const templateData: ContractTemplateInsert = {
        name,
        description,
        template_type: templateType,
        file_name: file.name,
        file_path: uploadResult.filePath!,
        file_size: file.size,
        file_type: file.type,
        is_active: true
        // user_id, company_id e created_by são preenchidos automaticamente pelo trigger
      };

      const { data, error } = await supabase
        .from('contract_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar template:', error);
        if (uploadResult.filePath) {
          await supabase.storage
            .from('contract-templates')
            .remove([uploadResult.filePath]);
        }
        return { success: false, error: 'Erro ao salvar template no banco de dados' };
      }

      setTemplates(prev => [data, ...prev]);

      return { success: true, template: data };
    } catch (err) {
      console.error('Erro inesperado ao criar template:', err);
      return { success: false, error: 'Erro inesperado ao criar template' };
    }
  };

  // Atualizar template
  const updateTemplate = async (
    id: string,
    updates: ContractTemplateUpdate
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar template:', error);
        return { success: false, error: 'Erro ao atualizar template' };
      }

      setTemplates(prev => 
        prev.map(template => 
          template.id === id ? data : template
        )
      );

      return { success: true };
    } catch (err) {
      console.error('Erro inesperado ao atualizar template:', err);
      return { success: false, error: 'Erro inesperado ao atualizar template' };
    }
  };

  // Deletar template
  const deleteTemplate = async (id: string): Promise<void> => {
    try {
      const template = templates.find(t => t.id === id);
      if (!template) {
        throw new Error('Template não encontrado');
      }

      const { error: dbError } = await supabase
        .from('contract_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (dbError) {
        console.error('Erro ao deletar template do banco:', dbError);
        throw new Error('Erro ao deletar template do banco de dados');
      }

      try {
        const { error: storageError } = await supabase.storage
          .from('contract-templates')
          .remove([template.file_path]);

        if (storageError) {
          console.warn('Aviso: Erro ao deletar arquivo do storage:', storageError);
        }
      } catch (storageErr) {
        console.warn('Aviso: Erro ao deletar arquivo do storage:', storageErr);
      }

      setTemplates(prev => prev.filter(t => t.id !== id));

    } catch (error) {
      console.error('Erro ao deletar template:', error);
      setError(error instanceof Error ? error.message : 'Erro ao deletar template');
      throw error;
    }
  };

  // Obter URL do arquivo
  const getFileUrl = async (filePath: string): Promise<string> => {
    try {
      const { data } = await supabase.storage
        .from('contract-templates')
        .createSignedUrl(filePath, 3600);

      if (!data?.signedUrl) {
        throw new Error('Erro ao gerar URL do arquivo');
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Erro ao obter URL do arquivo:', error);
      throw error;
    }
  };

  // Download de arquivo
  const downloadFile = async (template: ContractTemplate): Promise<void> => {
    try {
      console.log('📥 Iniciando download:', template.file_name);
      
      const fileUrl = await getFileUrl(template.file_path);
      
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = template.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Download direto concluído');
      
    } catch (error) {
      console.error('❌ Erro ao baixar arquivo:', error);
      setError(error instanceof Error ? error.message : 'Erro ao baixar arquivo');
      throw error;
    }
  };

  // Buscar templates ao montar o componente (apenas uma vez)
  useEffect(() => {
    console.log('🚀 Inicializando ContractTemplatesProvider...');
    fetchTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Configurar atualizações em tempo real (apenas uma vez)
  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    const setupRealTimeUpdates = () => {
      if (!mounted) return;
      
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(`contract_templates_realtime-${uniqueSuffix}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contract_templates'
          },
          (payload) => {
            if (!mounted) return;
            console.log('📡 Mudança em contract_templates:', payload);
            
            if (payload.eventType === 'INSERT') {
              const newTemplate = payload.new as ContractTemplate;
              if (newTemplate.is_active) {
                setTemplates(prev => [newTemplate, ...prev]);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedTemplate = payload.new as ContractTemplate;
              setTemplates(prev => 
                prev.map(template => 
                  template.id === updatedTemplate.id ? updatedTemplate : template
                ).filter(template => template.is_active)
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedTemplate = payload.old as ContractTemplate;
              setTemplates(prev => prev.filter(t => t.id !== deletedTemplate.id));
            }
          }
        )
        .subscribe((status) => {
          if (mounted) {
            console.log('📡 Status do canal real-time:', status);
          }
        });
    };

    if (!error && mounted) {
      setupRealTimeUpdates();
    }

    return () => {
      mounted = false;
      if (channel) {
        console.log('🧹 Removendo canal real-time...');
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: ContractTemplatesContextType = {
    templates,
    loading,
    error,
    uploading,
    uploadProgress,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getFileUrl,
    downloadFile,
    refetch: fetchTemplates
  };

  return (
    <ContractTemplatesContext.Provider value={contextValue}>
      {children}
    </ContractTemplatesContext.Provider>
  );
}; 