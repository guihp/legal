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

    console.log(`📡 Invocando Edge Function: ${functionName}`, {
      body: params.body,
      hasHeaders: Object.keys(headers).length > 0
    });

    let { data, error } = await supabase.functions.invoke<TRes>(functionName, {
      body: params.body as any,
      headers,
    });

    console.log(`📥 Resposta da Edge Function ${functionName}:`, {
      hasData: !!data,
      data: data,
      hasError: !!error,
      error: error ? {
        message: error.message,
        name: error.name,
        status: (error as any)?.status,
        statusCode: (error as any)?.statusCode,
        context: (error as any)?.context,
        details: (error as any)?.details,
        fullError: error
      } : null
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

    // Tentar extrair mensagem de erro do body da resposta (quando status 400)
    if ((error as any)?.context) {
      try {
        // Pode estar em context.body ou context.message
        const errorContext = (error as any).context;
        
        // Se context é uma Response, tentar ler o body
        if (errorContext instanceof Response && !errorContext.bodyUsed) {
          try {
            const errorText = await errorContext.clone().text();
            console.log('📄 Body da resposta de erro:', errorText);
            try {
              const errorBody = JSON.parse(errorText);
              if (errorBody.error || errorBody.message) {
                return { 
                  data: null, 
                  error: { 
                    message: errorBody.error || errorBody.message, 
                    ...error 
                  } 
                };
              }
            } catch (parseErr) {
              // Se não for JSON, usar o texto como mensagem
              if (errorText) {
                return { 
                  data: null, 
                  error: { 
                    message: errorText, 
                    ...error 
                  } 
                };
              }
            }
          } catch (readErr) {
            console.warn('⚠️ Erro ao ler body da resposta:', readErr);
          }
        }
        
        if (errorContext.body) {
          const errorBody = typeof errorContext.body === 'string' 
            ? JSON.parse(errorContext.body) 
            : errorContext.body;
          if (errorBody.error || errorBody.message) {
            return { 
              data: null, 
              error: { 
                message: errorBody.error || errorBody.message, 
                ...error 
              } 
            };
          }
        }
        if (errorContext.message) {
          return { 
            data: null, 
            error: { 
              message: errorContext.message, 
              ...error 
            } 
          };
        }
      } catch (parseErr) {
        console.warn('⚠️ Erro ao fazer parse do contexto de erro:', parseErr);
      }
    }

    // Se o erro tem uma mensagem, usar ela
    if (error.message) {
      return { data: null, error };
    }

    // Fallback: criar mensagem genérica
    return { 
      data: null, 
      error: { 
        message: `Erro ao chamar ${functionName}: ${(error as any)?.status || (error as any)?.statusCode || 'Erro desconhecido'}`,
        ...error
      } 
    };
  } catch (e: any) {
    console.error(`❌ Erro ao invocar Edge Function ${functionName}:`, e);
    return { data: null, error: e };
  }
}


