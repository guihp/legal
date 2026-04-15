import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { invokeEdge } from "@/integrations/supabase/invoke";

export function GoogleCalendarCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando Google Calendar...");
  const hasExchangedCodeRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (hasExchangedCodeRef.current) return;

      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Google OAuth retornou erro: ${error}`);
        return;
      }
      if (!code) {
        setStatus("error");
        setMessage("Código de autorização ausente");
        return;
      }

      hasExchangedCodeRef.current = true;

      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const { data, error: exchangeError } = await invokeEdge<any, any>("google-calendar-auth", {
        body: { action: "exchange_code", code, redirect_uri: redirectUri },
      });

      if (exchangeError || !data?.success) {
        setStatus("error");
        setMessage(exchangeError?.message || data?.error || "Falha ao finalizar conexão com Google");
        return;
      }

      setStatus("success");
      setMessage("Google Calendar conectado com sucesso!");
      setTimeout(() => navigate("/agenda"), 1200);
    };
    run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <div className="max-w-md w-full rounded-xl border border-gray-800 bg-gray-900/70 p-6 text-center space-y-4">
        {status === "loading" && <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />}
        {status === "success" && <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />}
        {status === "error" && <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />}
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        <p className="text-gray-300 text-sm">{message}</p>
      </div>
    </div>
  );
}
