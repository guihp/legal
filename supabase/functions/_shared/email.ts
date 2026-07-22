/**
 * Envio de email via Resend (welcome, alertas de visita, etc.).
 * Best-effort: disabled / sem destinatário / falha de API → log + { sent: false }, não quebra o fluxo.
 */

const TZ = "America/Sao_Paulo";

export type SendEmailResult = {
  sent: boolean;
  id?: string | null;
  reason?: string;
};

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const to = String(params.to || "").trim().toLowerCase();
  if (!to) {
    console.log("email_skip", { reason: "missing_to" });
    return { sent: false, reason: "missing_to" };
  }

  const enabled = String(Deno.env.get("RESEND_ENABLED") || "false").toLowerCase() === "true";
  if (!enabled) {
    console.log("email_skip", { reason: "RESEND_ENABLED=false", to });
    return { sent: false, reason: "RESEND_ENABLED=false" };
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@iafeimobi.com.br";
  const apiBase = (Deno.env.get("RESEND_API_BASE_URL") || "https://api.resend.com").replace(/\/$/, "");

  if (!apiKey) {
    console.log("email_skip", { reason: "RESEND_API_KEY missing", to });
    return { sent: false, reason: "RESEND_API_KEY_missing" };
  }

  try {
    const res = await fetch(`${apiBase}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || json?.error || `Erro ao enviar email (${res.status})`;
      console.error("email_send_failed", { to, status: res.status, msg });
      return { sent: false, reason: String(msg) };
    }

    return { sent: true, id: json?.id || null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("email_send_failed", { to, msg });
    return { sent: false, reason: msg };
  }
}

/** Email de boas-vindas com credenciais (cadastro de empresa). */
export async function sendWelcomeEmailWithResend(params: {
  to: string;
  companyName: string;
  loginEmail: string;
  temporaryPassword: string;
}): Promise<SendEmailResult> {
  const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://app.iafeimobi.com.br";
  const subject = "Bem-vindo(a) ao IAFÉ IMOBI - Credenciais de acesso";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 8px;">Cadastro concluído com sucesso</h2>
      <p>Olá, <strong>${escapeHtml(params.companyName)}</strong>!</p>
      <p>Sua conta foi criada e já está pronta para uso.</p>
      <p><strong>Email de acesso:</strong> ${escapeHtml(params.loginEmail)}</p>
      <p><strong>Senha temporária:</strong> ${escapeHtml(params.temporaryPassword)}</p>
      <p>Acesse a plataforma em: <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>
      <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
        Por segurança, altere sua senha no primeiro acesso.
      </p>
    </div>
  `;

  return sendEmail({ to: params.to, subject, html });
}

export type VisitBookedAlertParams = {
  brokerEmail: string;
  brokerName?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  visitAt: Date | string;
  propertyLabel?: string | null;
  propertyAddress?: string | null;
  appLink?: string | null;
};

function formatVisitAtSP(visitAt: Date | string): { dataPt: string; horaPt: string; iso: string } | null {
  const dt = visitAt instanceof Date ? visitAt : new Date(visitAt);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  const dataPt = dt.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const horaPt = dt.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dataPt, horaPt, iso: dt.toISOString() };
}

/** Alerta imediato ao corretor quando uma visita é agendada ou atribuída. */
export async function sendVisitBookedAlertToBroker(
  params: VisitBookedAlertParams,
): Promise<SendEmailResult> {
  const brokerEmail = String(params.brokerEmail || "").trim();
  if (!brokerEmail) {
    console.log("visit_booked_email_skip", { reason: "missing_broker_email" });
    return { sent: false, reason: "missing_broker_email" };
  }

  const when = formatVisitAtSP(params.visitAt);
  if (!when) {
    console.log("visit_booked_email_skip", { reason: "invalid_visit_at", to: brokerEmail });
    return { sent: false, reason: "invalid_visit_at" };
  }

  const appUrl = String(params.appLink || Deno.env.get("PUBLIC_APP_URL") || "https://app.iafeimobi.com.br").trim();
  const brokerName = String(params.brokerName || "").trim() || "Corretor";
  const clientName = String(params.clientName || "").trim() || "Cliente";
  const clientPhone = String(params.clientPhone || "").trim();
  const propertyLabel = String(params.propertyLabel || "").trim();
  const propertyAddress = String(params.propertyAddress || "").trim();

  const subject = `Nova visita agendada — ${when.dataPt} às ${when.horaPt}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 8px;">Nova visita agendada</h2>
      <p>Olá, <strong>${escapeHtml(brokerName)}</strong>!</p>
      <p>Uma visita foi atribuída a você:</p>
      <ul style="padding-left: 18px;">
        <li><strong>Cliente:</strong> ${escapeHtml(clientName)}</li>
        ${clientPhone ? `<li><strong>Telefone:</strong> ${escapeHtml(clientPhone)}</li>` : ""}
        <li><strong>Data/hora:</strong> ${escapeHtml(when.dataPt)} às ${escapeHtml(when.horaPt)} (horário de Brasília)</li>
        ${propertyLabel ? `<li><strong>Imóvel:</strong> ${escapeHtml(propertyLabel)}</li>` : ""}
        ${propertyAddress ? `<li><strong>Endereço:</strong> ${escapeHtml(propertyAddress)}</li>` : ""}
      </ul>
      ${
    appUrl
      ? `<p>Acesse o app: <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>`
      : ""
  }
      <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
        Este é um alerta automático do IAFÉ IMOBI.
      </p>
    </div>
  `;

  const result = await sendEmail({ to: brokerEmail, subject, html });
  if (result.sent) {
    console.log("visit_booked_email_sent", { to: brokerEmail, id: result.id });
  } else {
    console.log("visit_booked_email_skip", { to: brokerEmail, reason: result.reason });
  }
  return result;
}
