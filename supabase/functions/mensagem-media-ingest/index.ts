/**
 * mensagem-media-ingest — INSERT em public.mensagens + upload Storage (tudo numa chamada).
 * Não precisa de nó Supabase no n8n para mídia.
 *
 * Headers: apikey + Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Modo A — JSON (1 nó HTTP no n8n; edge baixa a URL da Meta):
 *   {
 *     "company_id": "uuid",
 *     "phone": "5511999999999",
 *     "mensagem_id": "wamid...",
 *     "source_url": "https://lookaside.fbsbx.com/...",
 *     "mensage_type": "audio|image|video",
 *     "text": "legenda opcional",
 *     "type": "lead",
 *     "plataforma": "WhatsApp",
 *     "fetch_authorization": "Bearer <token_meta_opcional>"
 *   }
 *
 * Modo B — multipart (depois do nó "baixar arquivo"):
 *   Texto: company_id, phone, mensagem_id, mensage_type, text, type, plataforma
 *   Binário: Name=file, Input Data Field Name=data
 *
 * Opcional mensagem_row_id: só atualiza linha existente (legado).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_BUCKET = "company-assets";
/** Limite por arquivo (áudio/imagem/vídeo de chat). */
const MAX_BYTES = 25 * 1024 * 1024;

function env(name: string, fallback = "") {
  return Deno.env.get(name) ?? fallback;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getJwtPayload(token: string): { role?: string; ref?: string } {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    return JSON.parse(atob(parts[1]));
  } catch {
    return {};
  }
}

function getBearerToken(req: Request): string {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

function getApiKeyHeader(req: Request): string {
  const raw = req.headers.get("apikey") || req.headers.get("x-api-key") || "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function projectRefFromUrl(): string {
  const m = env("SUPABASE_URL").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? "";
}

/** Mesmo padrão google-calendar-api: JWT service_role (validado no gateway) ou key exata. */
function assertServiceRoleAuth(req: Request): Response | null {
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return json({ ok: false, error: "server_misconfigured_missing_service_role" }, 500);
  }

  const apikey = getApiKeyHeader(req);
  const bearer = getBearerToken(req);
  const token = bearer || apikey;

  const keyMatch = (t: string) => t.length > 0 && t === serviceKey;
  const apikeyOk = keyMatch(apikey);
  const bearerOk = keyMatch(bearer);

  const jwt = getJwtPayload(token);
  const ref = projectRefFromUrl();
  const jwtServiceRole =
    jwt.role === "service_role" && (!jwt.ref || !ref || jwt.ref === ref);

  const internalKey = (req.headers.get("x-n8n-secret") || "").trim();
  const internalOk =
    !!internalKey && internalKey === env("N8N_INTERNAL_API_KEY", "");

  if (apikeyOk || bearerOk || jwtServiceRole || internalOk) {
    return null;
  }

  return json(
    {
      ok: false,
      error: "unauthorized",
      hint:
        "Copie a service_role atual em Supabase → Settings → API. Headers: apikey + Authorization: Bearer <mesma chave>.",
      debug: {
        has_apikey: apikey.length > 0,
        has_authorization: bearer.length > 0,
        jwt_role: jwt.role || null,
      },
    },
    401,
  );
}

function extFromMime(ct: string, mensageType: string): string {
  const m = ct.toLowerCase();
  const t = mensageType.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("pdf")) return "pdf";
  if (t === "image") return "jpg";
  if (t === "audio") return "ogg";
  if (t === "video") return "mp4";
  return "bin";
}

function mediaFolder(mensageType: string): string {
  const t = mensageType.toLowerCase();
  if (t === "image" || t === "video" || t === "audio") return t;
  return "outros";
}

/** Infere audio | image | video a partir do MIME (útil quando n8n manda só o binário). */
function mensageTypeFromMime(ct: string): string {
  const m = ct.toLowerCase();
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  return "outros";
}

/** Campo multipart do arquivo (n8n: Name=file + Input Data Field Name=data). */
function getMultipartFile(form: FormData): File | null {
  for (const key of ["file", "data", "media", "binary"]) {
    const entry = form.get(key);
    if (entry instanceof File && entry.size > 0) return entry;
  }
  // n8n às vezes manda o binário com outro "Name" no form — aceita o primeiro File do form
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0) return value;
  }
  return null;
}

async function fetchMediaBytes(
  sourceUrl: string,
  fetchAuthorization?: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const headers: Record<string, string> = {
    "User-Agent": "IAFE-MensagemMediaIngest/1.0",
  };
  if (fetchAuthorization?.trim()) {
    headers.Authorization = fetchAuthorization.trim();
  }

  const res = await fetch(sourceUrl, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`download_failed_http_${res.status}`);
  }

  const contentLength = Number(res.headers.get("content-length") || "0");
  if (contentLength > MAX_BYTES) {
    throw new Error(`file_too_large_${contentLength}_max_${MAX_BYTES}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`file_too_large_${buf.byteLength}_max_${MAX_BYTES}`);
  }

  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  return { bytes: new Uint8Array(buf), contentType };
}

function parseMeta(
  raw: Record<string, FormDataEntryValue | string | undefined>,
): {
  companyId: string;
  mensagemRowId: number | null;
  mensagemId: string;
  phone: string;
  text: string;
  msgType: string;
  plataforma: string;
  mensageType: string;
  sourceUrl: string;
  fetchAuthorization: string;
  bucket: string;
} {
  const get = (k: string) => {
    const v = raw[k];
    if (v == null) return "";
    if (v instanceof File) return "";
    return typeof v === "string" ? v : String(v);
  };

  const rowRaw = get("mensagem_row_id");
  const caption = get("text").trim() || get("caption").trim();
  return {
    companyId: get("company_id").trim(),
    mensagemRowId: rowRaw ? Number(rowRaw) : null,
    mensagemId: get("mensagem_id").trim(),
    phone: get("phone").trim(),
    text: caption,
    msgType: get("type").trim() || "lead",
    plataforma: get("plataforma").trim() || "WhatsApp",
    mensageType: get("mensage_type").trim() || "image",
    sourceUrl: get("source_url").trim(),
    fetchAuthorization: get("fetch_authorization").trim(),
    bucket: get("bucket").trim() || env("CHAT_MEDIA_BUCKET", DEFAULT_BUCKET),
  };
}

/** Grava ou atualiza a linha em mensagens (insert completo quando não há mensagem_row_id). */
async function persistMensagem(
  service: ReturnType<typeof createClient>,
  meta: ReturnType<typeof parseMeta>,
  publicUrl: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const patch = {
    conteudo_media: publicUrl,
    ...(meta.text ? { text: meta.text } : {}),
  };

  if (meta.mensagemRowId) {
    const { data, error } = await service
      .from("mensagens")
      .update(patch)
      .eq("company_id", meta.companyId)
      .eq("id", meta.mensagemRowId)
      .select("id, phone, text, conteudo_media, mensage_type, mensagem_id, type, plataforma")
      .maybeSingle();
    return { data: data as Record<string, unknown> | null, error: error?.message ?? null };
  }

  if (!meta.mensagemId) {
    return { data: null, error: "mensagem_id_required" };
  }
  if (!meta.phone) {
    return { data: null, error: "phone_required_for_insert" };
  }

  const row = {
    company_id: meta.companyId,
    phone: meta.phone,
    mensagem_id: meta.mensagemId,
    mensage_type: meta.mensageType,
    plataforma: meta.plataforma,
    type: meta.msgType,
    text: meta.text || null,
    conteudo_media: publicUrl,
  };

  const { data: inserted, error: insertErr } = await service
    .from("mensagens")
    .insert(row)
    .select("id, phone, text, conteudo_media, mensage_type, mensagem_id, type, plataforma")
    .maybeSingle();

  if (!insertErr) {
    return { data: inserted as Record<string, unknown> | null, error: null };
  }

  // wamid duplicado (retry n8n): atualiza mídia + legenda
  if (insertErr.code === "23505") {
    const { data, error } = await service
      .from("mensagens")
      .update(patch)
      .eq("company_id", meta.companyId)
      .eq("mensagem_id", meta.mensagemId)
      .select("id, phone, text, conteudo_media, mensage_type, mensagem_id, type, plataforma")
      .maybeSingle();
    return { data: data as Record<string, unknown> | null, error: error?.message ?? null };
  }

  return { data: null, error: insertErr.message };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const authErr = assertServiceRoleAuth(req);
  if (authErr) return authErr;

  try {
    const contentTypeHeader = req.headers.get("content-type") || "";
    let bytes: Uint8Array;
    let contentType = "application/octet-stream";
    let meta: ReturnType<typeof parseMeta>;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = getMultipartFile(form);
      if (!file) {
        return json(
          {
            ok: false,
            error: "multipart_requires_binary_file",
            hint:
              'n8n: Body = Form-Data, parâmetro tipo "n8n Binary File", Name = file, Input Data Field Name = data (nome da propriedade Binary do nó anterior).',
          },
          400,
        );
      }
      if (file.size > MAX_BYTES) {
        return json({ ok: false, error: "file_too_large", max_bytes: MAX_BYTES }, 413);
      }
      // mensagem_row_id tem que ser TEXTO (id do Insert). Não confundir com campo binário.
      const rowFromForm = form.get("mensagem_row_id");
      const rowIdStr =
        typeof rowFromForm === "string"
          ? rowFromForm
          : rowFromForm != null && !(rowFromForm instanceof File)
            ? String(rowFromForm)
            : "";

      meta = parseMeta({
        company_id: form.get("company_id") ?? "",
        mensagem_row_id: rowIdStr,
        mensagem_id: form.get("mensagem_id") ?? "",
        phone: form.get("phone") ?? "",
        text: form.get("text") ?? "",
        caption: form.get("caption") ?? "",
        type: form.get("type") ?? "",
        plataforma: form.get("plataforma") ?? "",
        mensage_type: form.get("mensage_type") ?? "",
        source_url: form.get("source_url") ?? "",
        fetch_authorization: form.get("fetch_authorization") ?? "",
        bucket: form.get("bucket") ?? "",
      });
      contentType = file.type || contentType;
      if (!meta.mensageType || meta.mensageType === "image") {
        const inferred = mensageTypeFromMime(contentType);
        if (inferred !== "outros") meta.mensageType = inferred;
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json().catch(() => ({}));
      meta = parseMeta(body as Record<string, string>);
      if (!meta.sourceUrl) {
        return json(
          {
            ok: false,
            error: "source_url_required",
            hint:
              "Envie source_url (URL temporária Meta/WhatsApp). Não use base64 — a edge baixa e grava no Storage.",
          },
          400,
        );
      }
      const fetched = await fetchMediaBytes(meta.sourceUrl, meta.fetchAuthorization);
      bytes = fetched.bytes;
      contentType = fetched.contentType;
    }

    if (!meta.companyId) {
      return json({ ok: false, error: "company_id_required" }, 400);
    }
    if (!meta.mensagemRowId && !meta.mensagemId) {
      return json({ ok: false, error: "mensagem_id_required" }, 400);
    }
    if (!meta.mensagemRowId && !meta.phone) {
      return json(
        {
          ok: false,
          error: "phone_required",
          hint: "Sem nó Supabase: envie phone + mensagem_id + mídia (source_url ou file).",
        },
        400,
      );
    }

    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const safeCompany = meta.companyId.replace(/[^a-zA-Z0-9_-]/g, "");
    const channel =
      meta.plataforma.toLowerCase() === "instagram" ? "instagram" : "whatsapp";
    const folder = mediaFolder(meta.mensageType);
    const ext = extFromMime(contentType, meta.mensageType);
    const path = `${safeCompany}/chat-media/${channel}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await service.storage.from(meta.bucket).upload(path, bytes, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (uploadErr) {
      return json({ ok: false, error: "storage_upload_failed", detail: uploadErr.message }, 500);
    }

    const { data: pub } = service.storage.from(meta.bucket).getPublicUrl(path);
    const publicUrl = String(pub?.publicUrl || "").trim();
    if (!publicUrl) {
      return json({ ok: false, error: "public_url_missing" }, 500);
    }

    const { data: saved, error: persistErr } = await persistMensagem(service, meta, publicUrl);
    if (persistErr) {
      return json({ ok: false, error: "mensagens_persist_failed", detail: persistErr }, 500);
    }
    if (!saved) {
      return json({ ok: false, error: "mensagens_row_not_found" }, 404);
    }

    return json({
      ok: true,
      public_url: publicUrl,
      storage_path: path,
      bucket: meta.bucket,
      bytes: bytes.byteLength,
      content_type: contentType,
      mensagem: saved,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mensagem-media-ingest]", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
