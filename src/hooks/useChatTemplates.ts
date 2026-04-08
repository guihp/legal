import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";

export interface ChatTemplate {
  id: string;
  company_id: string;
  shortcut: string;
  message: string;
  is_official_api?: boolean;
  created_at: string;
}

export function useChatTemplates() {
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    if (!profile?.company_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_templates")
        .select("*")
        .order("shortcut", { ascending: true });

      if (error) throw error;
      setTemplates((data as ChatTemplate[]) || []);
    } catch (err: any) {
      console.error("Erro ao buscar templates:", err);
      // Omitir alerta caso a tabela não exista ainda (erros de migracao pendente)
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const addTemplate = async (shortcut: string, message: string, isOfficialApi: boolean = false) => {
    if (!profile?.company_id) return { success: false };
    
    // Garantir que a shortcut comece com /
    const formattedShortcut = shortcut.startsWith("/") ? shortcut : `/${shortcut}`;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_templates")
        .insert([{ company_id: profile.company_id, shortcut: formattedShortcut, message, is_official_api: isOfficialApi }])
        .select();

      if (error) throw error;
      
      setTemplates(prev => [...prev, ...(data as ChatTemplate[])].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
      toast({ title: "Template criado com sucesso" });
      return { success: true, data };
    } catch (err: any) {
      toast({ title: "Erro ao criar template", description: err.message, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (id: string, shortcut: string, message: string, isOfficialApi: boolean = false) => {
    const formattedShortcut = shortcut.startsWith("/") ? shortcut : `/${shortcut}`;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_templates")
        .update({ shortcut: formattedShortcut, message, is_official_api: isOfficialApi })
        .eq("id", id)
        .select();

      if (error) throw error;
      
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, shortcut: formattedShortcut, message, is_official_api: isOfficialApi } : t));
      toast({ title: "Template atualizado com sucesso" });
      return { success: true, data };
    } catch (err: any) {
      toast({ title: "Erro ao atualizar template", description: err.message, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("chat_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: "Template removido" });
      return { success: true };
    } catch (err: any) {
      toast({ title: "Erro ao remover template", description: err.message, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate, fetchTemplates };
}
