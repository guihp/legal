import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { ChatMediaItemType } from "@/lib/chatMediaFiles";

export interface ChatTemplate {
  id: string;
  company_id: string;
  shortcut: string;
  message: string;
  is_official_api?: boolean;
  media_url?: string | null;
  media_type?: ChatMediaItemType | string | null;
  media_mime_type?: string | null;
  media_name?: string | null;
  created_at: string;
}

export type ChatTemplateCreateInput = {
  shortcut: string;
  message: string;
  isOfficialApi?: boolean;
  media?: {
    url: string;
    type: ChatMediaItemType;
    mimeType?: string;
    name?: string;
  } | null;
};

function formatShortcut(shortcut: string): string {
  return shortcut.startsWith("/") ? shortcut : `/${shortcut}`;
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
        .eq("company_id", profile.company_id)
        .order("shortcut", { ascending: true });

      if (error) throw error;
      setTemplates((data as ChatTemplate[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar templates";
      console.error("Erro ao buscar templates:", err);
      toast({ title: "Erro ao carregar templates", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, toast]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const addTemplate = async (input: ChatTemplateCreateInput) => {
    if (!profile?.company_id) return { success: false };

    const formattedShortcut = formatShortcut(input.shortcut);
    const message = input.message.trim();
    const hasMedia = Boolean(input.media?.url && input.media?.type);

    if (!message && !hasMedia) {
      toast({
        title: "Template incompleto",
        description: "Informe uma mensagem ou anexe uma mídia.",
        variant: "destructive",
      });
      return { success: false };
    }

    try {
      setLoading(true);
      const row = {
        company_id: profile.company_id,
        shortcut: formattedShortcut,
        message: message || "",
        is_official_api: Boolean(input.isOfficialApi),
        media_url: input.media?.url ?? null,
        media_type: input.media?.type ?? null,
        media_mime_type: input.media?.mimeType ?? null,
        media_name: input.media?.name ?? null,
      };

      const { data, error } = await supabase
        .from("chat_templates")
        .insert([row])
        .select();

      if (error) throw error;

      setTemplates((prev) =>
        [...prev, ...(data as ChatTemplate[])].sort((a, b) =>
          a.shortcut.localeCompare(b.shortcut),
        ),
      );
      toast({ title: "Template criado com sucesso" });
      return { success: true, data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar template";
      toast({ title: "Erro ao criar template", description: msg, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (id: string, input: ChatTemplateCreateInput) => {
    const formattedShortcut = formatShortcut(input.shortcut);

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_templates")
        .update({
          shortcut: formattedShortcut,
          message: input.message.trim(),
          is_official_api: Boolean(input.isOfficialApi),
          media_url: input.media?.url ?? null,
          media_type: input.media?.type ?? null,
          media_mime_type: input.media?.mimeType ?? null,
          media_name: input.media?.name ?? null,
        })
        .eq("id", id)
        .select();

      if (error) throw error;

      const updated = (data as ChatTemplate[])[0];
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      );
      toast({ title: "Template atualizado com sucesso" });
      return { success: true, data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar template";
      toast({ title: "Erro ao atualizar template", description: msg, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.from("chat_templates").delete().eq("id", id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Template removido" });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover template";
      toast({ title: "Erro ao remover template", description: msg, variant: "destructive" });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate, fetchTemplates };
}
