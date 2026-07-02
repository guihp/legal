export type WhatsappInstanceOption = {
  name: string;
  status?: "connected" | "connecting" | "disconnected" | string;
};

function normalizeInstancia(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Resolve a instância Evolution para o webhook `enviar_mensagem`.
 * Nunca usa "default" quando a empresa não está na API Oficial — exige instância real.
 */
export function resolveWhatsappSendInstancia(params: {
  selectedInstance: string | null;
  conversationInstancia?: string | null;
  scopedInstance: string | null;
  instances: WhatsappInstanceOption[];
  registryInstanceNames?: string[];
  isOfficialApi: boolean;
}): string {
  const candidates: string[] = [];

  const push = (value: unknown) => {
    const v = normalizeInstancia(value);
    if (v && v !== "default") candidates.push(v);
  };

  push(params.selectedInstance);
  push(params.conversationInstancia);
  push(params.scopedInstance);

  const connected = params.instances.find((i) => i.status === "connected");
  if (connected) push(connected.name);

  for (const inst of params.instances) push(inst.name);
  for (const name of params.registryInstanceNames ?? []) push(name);

  const resolved = candidates.find(Boolean);
  if (resolved) return resolved;

  if (params.isOfficialApi) return "default";

  throw new Error("INSTANCE_REQUIRED");
}
