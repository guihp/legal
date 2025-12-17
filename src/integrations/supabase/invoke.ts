import { supabase } from "@/integrations/supabase/client";

type InvokeParams<TBody> = {
  body?: TBody;
  headers?: Record<string, string>;
};

type InvokeResult<TData> = {
  data: TData | null;
  error: any | null;
};

function isJwtExpiredError(err: any): boolean {
  const msg = (err?.message || "").toString().toLowerCase();
  const name = (err?.name || "").toString().toLowerCase();
  const status = err?.status || err?.statusCode;
  return (
    msg.includes("jwt") ||
    msg.includes("token") ||
    name.includes("jwt") ||
    status === 401
  ) && (msg.includes("expired") || msg.includes("invalid"));
}

export async function invokeEdge<TReq = any, TRes = any>(
  functionName: string,
  params: InvokeParams<TReq> = {}
): Promise<InvokeResult<TRes>> {
  try {
    // Nunca forçar Authorization manualmente; o SDK injeta o token válido
    const headers = Object.fromEntries(
      Object.entries(params.headers || {}).filter(([k]) =>
        k.toLowerCase() !== "authorization"
      )
    );

    let { data, error } = await supabase.functions.invoke<TRes>(functionName, {
      body: params.body as any,
      headers,
    });

    if (!error) {
      return { data: data ?? null, error: null };
    }

    // Se indicativo de JWT expirado/ inválido, tentar refresh e re-tentar 1x
    if (isJwtExpiredError(error)) {
      try {
        await supabase.auth.refreshSession();
      } catch {}

      const retry = await supabase.functions.invoke<TRes>(functionName, {
        body: params.body as any,
        headers,
      });

      return { data: (retry.data ?? null) as TRes | null, error: retry.error ?? null };
    }

    return { data: null, error };
  } catch (e: any) {
    return { data: null, error: e };
  }
}


