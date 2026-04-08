import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { invokeEdge } from "@/integrations/supabase/invoke";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ApiKeyRow = {
  id: string;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function N8nLeadsApiView() {
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [keyName, setKeyName] = useState("n8n");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const endpoint = useMemo(
    () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-leads-api`,
    []
  );

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(endpoint, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        toast.error(json?.error || "Erro ao carregar chaves.");
        return;
      }
      setKeys(json?.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro de rede ao carregar chaves.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const createKey = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: keyName || "n8n" }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        toast.error(json?.error || "Erro ao criar chave");
        return;
      }
      const raw = json?.data?.raw_key as string | undefined;
      if (raw) setNewRawKey(raw);
      toast.success("Chave criada. Copie agora (ela aparece só uma vez).");
      await loadKeys();
    } catch (e: any) {
      toast.error(e?.message || "Erro de rede ao criar chave.");
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        toast.error(json?.error || "Erro ao revogar chave");
        return;
      }
      toast.success("Chave revogada.");
      await loadKeys();
    } catch (e: any) {
      toast.error(e?.message || "Erro de rede ao revogar chave.");
    } finally {
      setLoading(false);
    }
  };

  const curlExample = useMemo(() => {
    const key = newRawKey || "imobi_xxxxx_xxxxxxxxx";
    return `curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: ${key}' \\
  -d '{
    "name": "Maria Silva",
    "email": "maria@email.com",
    "phone": "5591999999999",
    "source": "n8n",
    "message": "Lead capturado no formulário",
    "imovel_interesse": "Apartamento 3 quartos"
  }'`;
  }, [endpoint, newRawKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Leads (n8n)</h1>
        <p className="text-gray-400 text-sm mt-1">
          Cada empresa possui suas próprias API keys. A API só cria/lista leads da empresa dona da chave.
        </p>
      </div>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-400" />
            Gerar nova API key
          </CardTitle>
          <CardDescription className="text-gray-400">
            Guarde a chave gerada. Ela é exibida apenas uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="Nome da chave (ex: n8n-produção)"
            />
            <Button onClick={createKey} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Criar chave
            </Button>
          </div>

          {newRawKey && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-900/20 p-3">
              <p className="text-xs text-emerald-300 mb-2">Nova chave (copie agora):</p>
              <div className="flex gap-2 items-center">
                <code className="text-xs break-all text-emerald-100">{newRawKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-200"
                  onClick={() => {
                    navigator.clipboard.writeText(newRawKey);
                    toast.success("Chave copiada.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Chaves da empresa</CardTitle>
          <CardDescription className="text-gray-400">
            Revogue chaves antigas para segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" className="border-gray-700 text-gray-300" onClick={loadKeys}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prefixo</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.key_name}</TableCell>
                  <TableCell><code className="text-xs">{k.key_prefix}...</code></TableCell>
                  <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "-"}</TableCell>
                  <TableCell>{k.is_active ? "Ativa" : "Revogada"}</TableCell>
                  <TableCell className="text-right">
                    {k.is_active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-700 text-red-300 hover:bg-red-900/30"
                        onClick={() => revokeKey(k.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revogar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-6">Nenhuma chave criada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Endpoint e cURL (n8n)</CardTitle>
          <CardDescription className="text-gray-400">
            Use a chave da sua empresa no header <code>x-api-key</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-300">
            Endpoint: <code className="text-emerald-300">{endpoint}</code>
          </p>
          <pre className="overflow-auto rounded-md border border-gray-800 bg-gray-950 p-4 text-xs text-gray-200">
{curlExample}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

