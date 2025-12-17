import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { toast } from 'sonner';

export interface CompanySettings {
  id: string;
  company_id: string;
  display_name: string;
  display_subtitle: string;
  logo_url?: string;
  theme: 'dark';
  primary_color: string;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  timezone: string;
  company_name_font_family: string;
  company_name_font_size: number;
  company_name_color: string;
  company_name_bold: boolean;
  company_subtitle_font_family: string;
  company_subtitle_font_size: number;
  company_subtitle_color: string;
  company_subtitle_bold: boolean;
  logo_size: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Partial<CompanySettings> = {
  display_name: 'ImobiPro',
  display_subtitle: 'Gestão Imobiliária',
  theme: 'dark',
  primary_color: '#3B82F6',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  company_name_font_family: 'Inter',
  company_name_font_size: 20,
  company_name_color: '#FFFFFF',
  company_name_bold: false,
  company_subtitle_font_family: 'Inter',
  company_subtitle_font_size: 12,
  company_subtitle_color: '#9CA3AF',
  company_subtitle_bold: false,
  logo_size: 40,
};

export function useCompanySettings() {
  const { profile } = useUserProfile();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carregar configurações da empresa
  const loadSettings = useCallback(async () => {
    try {
      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      setError(null);
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();

      if (error) {
        // Se não existir configurações, criar com valores padrão
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
          return;
        }
        throw error;
      }

      setSettings(data);
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      setError(error.message);
      toast.error('Erro ao carregar configurações da empresa');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  // Criar configurações padrão para nova empresa
  const createDefaultSettings = useCallback(async () => {
    try {
      if (!profile?.company_id) return;

      const newSettings = {
        company_id: profile.company_id,
        ...DEFAULT_SETTINGS,
      };

      const { data, error } = await supabase
        .from('company_settings')
        .insert(newSettings)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast.success('Configurações inicializadas com sucesso');
    } catch (error: any) {
      console.error('Erro ao criar configurações padrão:', error);
      setError(error.message);
      toast.error('Erro ao inicializar configurações');
    }
  }, [profile?.company_id]);

  // Atualizar uma configuração específica
  const updateSetting = useCallback(async (
    field: keyof CompanySettings, 
    value: any
  ): Promise<boolean> => {
    try {
      if (!settings || !profile?.company_id) {
        throw new Error('Configurações não carregadas');
      }

      setUpdating(field);
      setError(null);

      // Verificar se a sessão está válida e renovar se necessário
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // Tentar renovar a sessão
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
      }

      const { data, error } = await supabase
        .from('company_settings')
        .update({ [field]: value })
        .eq('company_id', profile.company_id)
        .select()
        .single();

      if (error) {
        // Se for erro de token expirado, tentar renovar sessão e tentar novamente
        if (error.message?.includes('exp') || error.message?.includes('JWT')) {
          console.log('Token expirado em updateSetting, tentando renovar sessão...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }
          
          // Tentar novamente com sessão renovada
          const { data: retryData, error: retryError } = await supabase
            .from('company_settings')
            .update({ [field]: value })
            .eq('company_id', profile.company_id)
            .select()
            .single();
            
          if (retryError) throw retryError;
          setSettings(retryData);
        } else {
          throw error;
        }
      } else {
        setSettings(data);
      }
      
      // Toast específico por tipo de configuração
      const messages = {
        display_name: 'Nome da empresa atualizado',
        display_subtitle: 'Subtítulo atualizado',
        logo_url: 'Logo atualizado',
        theme: `Tema alterado para ${value === 'dark' ? 'escuro' : 'claro'}`,
        primary_color: 'Cor primária atualizada',
        language: 'Idioma atualizado',
        timezone: 'Fuso horário atualizado',
      };

      toast.success(messages[field] || 'Configuração atualizada');
      return true;

    } catch (error: any) {
      console.error(`Erro ao atualizar ${field}:`, error);
      setError(error.message);
      toast.error(`Erro ao atualizar ${field}`);
      return false;
    } finally {
      setUpdating(null);
    }
  }, [settings, profile?.company_id]);

  // Upload de logo para Supabase Storage
  const uploadLogo = useCallback(async (file: File): Promise<boolean> => {
    try {
      if (!profile?.company_id) {
        throw new Error('Empresa não identificada');
      }

      // Validações do arquivo
      const maxSize = 2 * 1024 * 1024; // 2MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];

      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Máximo 2MB.');
      }

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Formato não suportado. Use PNG, JPG ou SVG.');
      }

      setUpdating('logo_url');
      setError(null);

      // Verificar se a sessão está válida e renovar se necessário
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // Tentar renovar a sessão
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
      }

      // Nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${profile.company_id}/${fileName}`;

      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // Se for erro de token expirado, tentar renovar sessão e tentar novamente
        if (uploadError.message?.includes('exp') || uploadError.message?.includes('Unauthorized')) {
          console.log('Token expirado, tentando renovar sessão...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }
          
          // Tentar upload novamente com sessão renovada
          const { error: retryError } = await supabase.storage
            .from('company-assets')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });
            
          if (retryError) throw retryError;
        } else {
          throw uploadError;
        }
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      // Remover logo anterior se existir
      if (settings?.logo_url) {
        const urlParts = settings.logo_url.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'company-assets');
        if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
          const oldPath = urlParts.slice(bucketIndex + 1).join('/');
          await supabase.storage
            .from('company-assets')
            .remove([oldPath]);
        }
      }

      // Atualizar URL no banco
      const success = await updateSetting('logo_url', publicUrl);
      return success;

    } catch (error: any) {
      console.error('Erro ao fazer upload do logo:', error);
      setError(error.message);
      toast.error(error.message);
      return false;
    } finally {
      setUpdating(null);
    }
  }, [profile?.company_id, settings, updateSetting]);

  // Remover logo
  const removeLogo = useCallback(async (): Promise<boolean> => {
    try {
      if (!settings?.logo_url) return true;

      setUpdating('logo_url');

      // Remover arquivo do Storage
      const urlParts = settings.logo_url.split('/');
      const bucketIndex = urlParts.findIndex(part => part === 'company-assets');
      if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
        const logoPath = urlParts.slice(bucketIndex + 1).join('/');
        await supabase.storage
          .from('company-assets')
          .remove([logoPath]);
      }

      // Atualizar banco
      const success = await updateSetting('logo_url', null);
      return success;

    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo');
      return false;
    } finally {
      setUpdating(null);
    }
  }, [settings, updateSetting]);

  // Restaurar configurações padrão
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    try {
      if (!profile?.company_id) return false;

      setUpdating('reset');
      setError(null);

      // Remover logo se existir
      if (settings?.logo_url) {
        await removeLogo();
      }

      // Resetar todas as configurações
      const { data, error } = await supabase
        .from('company_settings')
        .update(DEFAULT_SETTINGS)
        .eq('company_id', profile.company_id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast.success('Configurações restauradas para o padrão');
      return true;

    } catch (error: any) {
      console.error('Erro ao restaurar configurações:', error);
      setError(error.message);
      toast.error('Erro ao restaurar configurações');
      return false;
    } finally {
      setUpdating(null);
    }
  }, [profile?.company_id, settings, removeLogo]);

  // Carregar configurações quando o perfil for carregado
  useEffect(() => {
    if (profile?.company_id) {
      loadSettings();
    }
  }, [profile?.company_id, loadSettings]);

  // Subscription para mudanças em tempo real
  useEffect(() => {
    if (!profile?.company_id) return;

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const subscription = supabase
      .channel(`company_settings_changes-${profile.company_id}-${uniqueSuffix}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'company_settings',
          filter: `company_id=eq.${profile.company_id}`
        },
        () => {
          loadSettings(); // Recarregar quando houver mudanças
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.company_id, loadSettings]);

  // Valores computados
  const isUpdating = useMemo(() => updating !== null, [updating]);
  const hasLogo = useMemo(() => Boolean(settings?.logo_url), [settings?.logo_url]);

  return {
    settings,
    loading,
    error,
    updating,
    isUpdating,
    hasLogo,
    updateSetting,
    uploadLogo,
    removeLogo,
    resetToDefaults,
    refreshSettings: loadSettings,
  };
}