// =============================================================================
// property-images-api (v4) — usado pela tool Buscar_fotos_imovel do agent n8n.
//
// Mudanças vs v3:
//  - Aceita company_id (obrigatório quando passado pelo n8n agent — isolamento
//    multi-tenant; listing_ids podem se repetir entre empresas).
//  - Sort prioriza fotos COM legenda dentro do limit (é_capa, depois com_legenda,
//    depois ordem) — garante que descrições não desaparecem quando há mais fotos
//    que limit.
//
// Lê de imoveisvivareal:
//   - imagens text[]            (URLs)
//   - imagens_legendas text[]   (legenda por foto, mesmo índice)
//
// POST body:
//   {
//     listing_id: string   (obrigatório)
//     company_id: string   (recomendado — UUID da empresa; sem isso, primeira row
//                           que casar listing_id é retornada — risco multi-tenant)
//     limit?:     number   (default 30, max 30)
//   }
//
// Response:
//   {
//     ok: true,
//     imovel: { id, listing_id, tipo_imovel, bairro, cidade },
//     imagens: [
//       { url, descricao, ordem, is_capa }
//     ],
//     total: number,                 // total de fotos cadastradas no imóvel
//     retornadas: number,             // quantas vieram após sort+limit
//     tem_descricoes: boolean,
//     fotos_com_descricao: number,    // total no imóvel (não só no retornado)
//     fotos_sem_descricao: number,
//     descricoes_no_retorno: number   // quantas das retornadas têm descricao !== null
//   }
//
// SORT do array `imagens`:
//   1. is_capa DESC  (capa sempre primeiro)
//   2. (descricao IS NOT NULL) DESC  (fotos com legenda antes das sem)
//   3. ordem ASC  (estabilidade dentro de cada grupo)
//
// IA decide client-side conforme bloco <EnvioDeImagens> do prompt.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return ok({ ok: false, error: message, ...extra }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("method_not_allowed", 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json_body");
  }

  const listingId = String(body.listing_id ?? "").trim();
  if (!listingId) {
    return fail("listing_id_required");
  }

  const companyId = String(body.company_id ?? "").trim();
  // company_id não é hard-required pra retrocompat, mas é altamente recomendado.
  // Sem ele, retorna primeira row que casar listing_id (perigo cross-tenant).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
  const useCompanyFilter = !!companyId && isUuid;

  let limit = Number.parseInt(String(body.limit ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return fail("server_misconfigured_missing_env", 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Lookup com isolamento multi-tenant quando company_id presente
  let query = supabase
    .from("imoveisvivareal")
    .select(
      "id, listing_id, tipo_imovel, bairro, cidade, company_id, imagens, imagens_legendas",
    )
    .eq("listing_id", listingId);

  if (useCompanyFilter) {
    query = query.eq("company_id", companyId);
  }

  // .maybeSingle() falha se houver duplicatas; usar .limit(1) é mais seguro
  // pra retrocompat caso ainda existam listing_ids duplicados sem company_id.
  const { data: imoveis, error: imovelErr } = await query.limit(1);

  if (imovelErr) {
    return fail("db_error_imovel_lookup", 500, { detail: imovelErr.message });
  }
  if (!imoveis || imoveis.length === 0) {
    return fail("imovel_not_found", 404, {
      listing_id: listingId,
      company_id: useCompanyFilter ? companyId : null,
    });
  }
  const imovel = imoveis[0];

  const urls: string[] = Array.isArray(imovel.imagens) ? imovel.imagens : [];
  const legendas: string[] = Array.isArray(imovel.imagens_legendas) ? imovel.imagens_legendas : [];

  type ImgRow = { url: string; descricao: string | null; ordem: number; is_capa: boolean };
  const combined: ImgRow[] = urls.map((url, idx) => ({
    url,
    descricao: (legendas[idx] && String(legendas[idx]).trim()) || null,
    ordem: idx,
    is_capa: idx === 0,
  }));

  // Sort: is_capa DESC, (descricao !== null) DESC, ordem ASC
  // Garante que fotos com legenda apareçam mesmo quando total > limit.
  const sorted = [...combined].sort((a, b) => {
    if (a.is_capa !== b.is_capa) return a.is_capa ? -1 : 1;
    const aHas = a.descricao !== null;
    const bHas = b.descricao !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.ordem - b.ordem;
  });

  const imagens = sorted.slice(0, limit);

  const fotosComDescricao = combined.filter((i) => i.descricao !== null).length;
  const fotosSemDescricao = combined.length - fotosComDescricao;
  const descricoesNoRetorno = imagens.filter((i) => i.descricao !== null).length;

  return ok({
    ok: true,
    imovel: {
      id: imovel.id,
      listing_id: imovel.listing_id,
      tipo_imovel: imovel.tipo_imovel,
      bairro: imovel.bairro,
      cidade: imovel.cidade,
    },
    imagens,
    total: combined.length,
    retornadas: imagens.length,
    tem_descricoes: fotosComDescricao > 0,
    fotos_com_descricao: fotosComDescricao,
    fotos_sem_descricao: fotosSemDescricao,
    descricoes_no_retorno: descricoesNoRetorno,
  });
});
