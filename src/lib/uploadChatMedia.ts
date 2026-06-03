import { supabase } from "@/integrations/supabase/client";
import type { ChatMediaItemType } from "@/lib/chatMediaFiles";
import { chatMediaStorageSubdir } from "@/lib/chatMediaStorage";

export async function uploadChatMediaAndGetPublicUrl(
  file: File,
  channel: "whatsapp" | "instagram",
  mediaType: ChatMediaItemType,
  companyId?: string | null,
): Promise<string> {
  const bucket = (import.meta as any).env?.VITE_CHAT_MEDIA_BUCKET || "company-assets";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeCompany = (companyId || "sem_empresa").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!companyId) throw new Error("company_id ausente para upload da mídia");
  const subdir = chatMediaStorageSubdir(mediaType);
  const path = `${safeCompany}/chat-media/${channel}/${subdir}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Falha ao subir mídia: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = String(data?.publicUrl || "").trim();
  if (!url) throw new Error("URL pública da mídia não foi gerada");
  return url;
}
