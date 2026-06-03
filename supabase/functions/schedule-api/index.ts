import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadCompanyVisitScheduling,
  persistQueueIndex,
  pickFreeBrokerForSlot,
} from "../_shared/visitScheduling.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TZ = "America/Sao_Paulo";
const SLOT_MIN = 60;
const FERIADOS = ["2026-05-01","2026-12-25","2026-01-01"];

function env(n: string, f = "") { return Deno.env.get(n) ?? f; }
function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function getSPParts(d: any) {
  const dt = new Date(d);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(dt);
  const p: any = {}; for (const x of parts) p[x.type] = x.value;
  return p;
}
function parseDT(s: any): Date | null {
  if (!s) return null;
  if (typeof s !== "string") return new Date(s);
  if (/([+-]\d{2}:\d{2}|Z)$/.test(s)) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T12:00:00-03:00");
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s.replace(" ", "T") + "-03:00");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s + "-03:00");
  return new Date(s);
}
function toISO(d: any) {
  const p = getSPParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-03:00`;
}
function fmtBR(d: any) {
  const p = getSPParts(d);
  return `${p.day}/${p.month}/${p.year}`;
}
function fmtHM(d: any) { return getSPParts(d).hour; }
function wkey(day: number) { return ["sun","mon","tue","wed","thu","fri","sat"][day]; }
function wnamePt(day: number) { return ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"][day]; }
function minsHHMM(s: string | null): number | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}
function minsOfDay(d: any) { const p = getSPParts(d); return Number(p.hour) * 60 + Number(p.minute); }
function addDays(d: any, n: number) { return new Date(new Date(d).getTime() + n * 86400000); }
function addMins(d: Date, m: number) { return new Date(d.getTime() + m * 60000); }
function sameDay(a: any, b: any) {
  const pa = getSPParts(a), pb = getSPParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}
function isBizDay(d: number) { return d >= 1 && d <= 5; }
function isWknd(d: number) { return d === 0 || d === 6; }
function dateKeyISO(d: any) {
  const p = getSPParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}
function nextBizDays(base: Date, count: number): Date[] {
  const days: Date[] = []; let d = new Date(base.getTime()); let guard = 0;
  while (days.length < count && guard < 20) {
    d = addDays(d, 1); 
    const dow = new Date(`${dateKeyISO(d)}T12:00:00-03:00`).getDay(); 
    const dk = dateKeyISO(d);
    if (!isWknd(dow) && !FERIADOS.includes(dk)) days.push(d);
    guard++;
  }
  return days;
}
function combineDT(dateObj: Date, timeStr: string): Date | null {
  if (!timeStr) return null;
  const [H, Mi = "00", S = "00"] = String(timeStr).split(":");
  const p = getSPParts(dateObj), pn = (n: number) => String(n).padStart(2, "0");
  return new Date(`${p.year}-${p.month}-${p.day}T${pn(+H)}:${pn(+Mi)}:${pn(+S)}-03:00`);
}
function ceilSlot(d: Date, slot: number) { 
  const p = getSPParts(d);
  let min = Number(p.minute);
  let add = min % slot === 0 ? 0 : slot - (min % slot);
  return addMins(d, add);
}
function floorSlot(d: Date, slot: number) {
  const p = getSPParts(d);
  let min = Number(p.minute);
  let sub = min % slot;
  return addMins(d, -sub);
}

async function refreshToken(rt: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: rt, grant_type: "refresh_token" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.access_token) throw new Error(j?.error_description || "Token refresh failed");
  return { accessToken: j.access_token as string, expiresIn: Number(j.expires_in || 3600) };
}

async function setupGoogle(service: any, companyId: string) {
  const { data: integ, error } = await service.from("company_google_calendar_integrations").select("*").eq("company_id", companyId).single();
  if (error || !integ) throw new Error("Google Calendar não conectado");
  let at = integ.access_token as string;
  const rt = integ.refresh_token as string;
  const exp = integ.expires_at ? new Date(integ.expires_at).getTime() : 0;
  if (!exp || Date.now() > exp - 60000) {
    try {
      const r = await refreshToken(rt);
      at = r.accessToken;
      await service.from("company_google_calendar_integrations").update({ access_token: at, expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString() }).eq("company_id", companyId);
    } catch { /* use current */ }
  }
  const gFetch = async (url: string, init?: RequestInit) => {
    const run = async (token: string) => {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
      const txt = await res.text().catch(() => "");
      let json: any = {}; if (txt) try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
      return { res, json };
    };
    let { res, json } = await run(at);
    if (res.status === 401 && rt) {
      try { const r = await refreshToken(rt); at = r.accessToken; await service.from("company_google_calendar_integrations").update({ access_token: at, expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString() }).eq("company_id", companyId); ({ res, json } = await run(at)); } catch {}
    }
    if (!res.ok) throw new Error(json?.error?.message || `Google API error (${res.status})`);
    return json;
  };
  return gFetch;
}

async function checkBusy(gFetch: any, calId: string, tMin: string, tMax: string): Promise<any[]> {
  const fb = await gFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST", body: JSON.stringify({ timeMin: tMin, timeMax: tMax, items: [{ id: calId }] }),
  });
  return Array.isArray(fb?.calendars?.[calId]?.busy) ? fb.calendars[calId].busy : [];
}

function calcFreeSlots(busyRaw: any[], minStart: Date, maxEnd: Date) {
  const busy = busyRaw.map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter(b => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime())).sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: { start: Date; end: Date }[] = [];
  for (const seg of busy) {
    if (!merged.length) merged.push({ ...seg });
    else { const last = merged[merged.length - 1]; if (seg.start <= last.end) { if (seg.end > last.end) last.end = seg.end; } else merged.push({ ...seg }); }
  }
  const free: { start: Date; end: Date }[] = []; let cursor = minStart;
  for (const b of merged) { if (cursor < b.start) free.push({ start: cursor, end: b.start }); if (b.end > cursor) cursor = b.end; }
  if (cursor < maxEnd) free.push({ start: cursor, end: maxEnd });
  const lines: string[] = [];
  for (const f of free) {
    let s = ceilSlot(f.start, SLOT_MIN); const cap = floorSlot(f.end, SLOT_MIN);
    while (s < cap) { const e = addMins(s, SLOT_MIN); if (e <= f.end) lines.push(`🕒 ${fmtHM(s)} - ${fmtHM(e)}`); s = e; }
  }
  return lines;
}

function buildDayText(lines: string[], dateObj: Date) {
  const p = getSPParts(dateObj);
  const dow = new Date(`${p.year}-${p.month}-${p.day}T12:00:00-03:00`).getDay();
  const dia = wnamePt(dow), data = fmtBR(dateObj);
  return [`📅 Para *${dia}, ${data}* temos disponível:`, ...(lines.length ? lines : ["❌ Nenhum horário disponível"])].join("\n");
}

/** Gestor/admin da empresa (quando o request traz JWT de usuário). Service role do n8n segue sem checagem. */
async function assertCompanyManager(
  req: Request,
  service: ReturnType<typeof createClient>,
  companyId: string,
): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload?.role === "service_role") return null;
  } catch {
    /* segue validação de usuário */
  }

  const anon = env("SUPABASE_ANON_KEY");
  const url = env("SUPABASE_URL");
  if (!anon || !url) return "Configuração de autenticação indisponível";

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return "Não autenticado";

  const { data: profile } = await service
    .from("user_profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.company_id !== companyId) {
    return "Sem permissão para esta empresa";
  }
  if (!["admin", "gestor"].includes(String(profile.role || ""))) {
    return "Apenas gestor ou admin pode atribuir corretor à visita";
  }
  return null;
}

/** Headers para chamadas server-to-server entre edge functions (verify_jwt exige JWT válido). */
function nestedEdgeFnHeaders(req: Request): Record<string, string> {
  const srkKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const incomingAuth = req.headers.get("Authorization") || "";
  const incomingApikey = req.headers.get("apikey") || "";
  // env SRK pode ser sb_secret_* (não-JWT); o gateway rejeita com 401 Invalid JWT.
  const authorization = incomingAuth.startsWith("Bearer ")
    ? incomingAuth
    : srkKey.startsWith("eyJ")
      ? `Bearer ${srkKey}`
      : `Bearer ${srkKey}`;
  return {
    "Content-Type": "application/json",
    apikey: incomingApikey || srkKey,
    Authorization: authorization,
  };
}

// ========= MAIN =========
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const companyId = String(body?.company_id || "").trim();
    if (!companyId) return ok({ success: false, error: "company_id obrigatório" }, 400);

    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const calFnHeaders = nestedEdgeFnHeaders(req);
    const gFetch = await setupGoogle(service, companyId);

    // Load oncall schedules
    const { data: schedules } = await service.from("oncall_schedules").select("*").eq("company_id", companyId);
    const rows = Array.isArray(schedules) ? schedules : [];

    // ==================== CHECK AVAILABILITY ====================
    if (action === "check_availability") {
      const rawDT = String(body?.data_e_hora || "");
      if (!rawDT) return ok({ success: false, error: "data_e_hora obrigatório" }, 400);
      const hasTime = /\d{2}:\d{2}/.test(rawDT);
      const tipoBusca = hasTime ? "direta" : "aberta";
      const dt = parseDT(rawDT);
      if (!dt || isNaN(dt.getTime())) return ok({ success: false, error: "data_e_hora inválida" }, 400);

      // Determine controle agenda
      const nowSP = new Date();
      const pReq = getSPParts(dt);
      const dowReq = new Date(`${pReq.year}-${pReq.month}-${pReq.day}T12:00:00-03:00`).getDay();
      let ctrl = "dia_util";
      if (sameDay(dt, nowSP)) {
        if (!hasTime && Number(getSPParts(nowSP).hour) >= 16) { 
           const tom = addDays(nowSP, 1);
           const pTom = getSPParts(tom);
           const dowTom = new Date(`${pTom.year}-${pTom.month}-${pTom.day}T12:00:00-03:00`).getDay(); 
           ctrl = isWknd(dowTom) ? "segunda-feira" : "dia_util"; 
        }
        else ctrl = "hoje";
      } else if (sameDay(dt, addDays(nowSP, 1))) {
        const tom = addDays(nowSP, 1);
        const pTom = getSPParts(tom);
        const dowTom = new Date(`${pTom.year}-${pTom.month}-${pTom.day}T12:00:00-03:00`).getDay(); 
        ctrl = isWknd(dowTom) ? "segunda-feira" : "dia_util";
      } else if (isWknd(dowReq)) ctrl = "segunda-feira";

      // ---- BUSCA ABERTA ----
      if (tipoBusca === "aberta") {
        const targetDates: Date[] = ctrl === "segunda-feira"
          ? nextBizDays(dt, 3)
          : [ctrl === "hoje" ? dt : (nextBizDays(addDays(dt, -1), 1)[0] || dt)];

        const blocos: string[] = [];
        const allSlotsText: string[] = [];

        for (const tDate of targetDates) {
          const pt = getSPParts(tDate);
          const dow = new Date(`${pt.year}-${pt.month}-${pt.day}T12:00:00-03:00`).getDay();
          const wk = wkey(dow);
          // Filter brokers who work this day
          const brokers = rows.filter((r: any) => !!r[`${wk}_works`] && r[`${wk}_start`] && r[`${wk}_end`]);
          if (!brokers.length) { blocos.push(buildDayText([], tDate)); continue; }

          // Build time window (earliest start to latest end across all brokers)
          let minStart: Date | null = null, maxEnd: Date | null = null;
          for (const b of brokers) {
            const s = combineDT(tDate, b[`${wk}_start`]), e = combineDT(tDate, b[`${wk}_end`]);
            if (s && (!minStart || s < minStart)) minStart = s;
            if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
          }
          if (!minStart || !maxEnd) { blocos.push(buildDayText([], tDate)); continue; }

          if (sameDay(tDate, new Date())) {
            const minAllowed = addMins(new Date(), 180);
            if (minStart < minAllowed) minStart = minAllowed;
          }
          if (minStart >= maxEnd) { blocos.push(buildDayText([], tDate)); continue; }

          // Generate all possible 1-hour slots from minStart to maxEnd
          const possibleSlots: { start: Date; end: Date }[] = [];
          let currentSlot = ceilSlot(minStart, SLOT_MIN);
          const cap = floorSlot(maxEnd, SLOT_MIN);
          while (currentSlot < cap) {
            const nextSlot = addMins(currentSlot, SLOT_MIN);
            if (nextSlot <= maxEnd) possibleSlots.push({ start: currentSlot, end: nextSlot });
            currentSlot = nextSlot;
          }

          // Fetch busy blocks for each broker
          const brokersAvailability = await Promise.all(brokers.map(async (b: any) => {
            const bStart = combineDT(tDate, b[`${wk}_start`]);
            const bEnd = combineDT(tDate, b[`${wk}_end`]);
            if (!bStart || !bEnd || !b.calendar_id) return null;
            const busy = await checkBusy(gFetch, b.calendar_id, toISO(bStart), toISO(bEnd));
            return { bStart, bEnd, busy };
          }));

          const validBrokers = brokersAvailability.filter(b => b !== null);

          const lines: string[] = [];
          for (const slot of possibleSlots) {
            let isSlotFree = false;
            for (const b of validBrokers) {
              if (slot.start >= b!.bStart && slot.end <= b!.bEnd) {
                const isBusy = b!.busy.some((bb: any) => {
                  const bbStart = new Date(bb.start);
                  const bbEnd = new Date(bb.end);
                  return slot.start < bbEnd && slot.end > bbStart;
                });
                if (!isBusy) {
                  isSlotFree = true;
                  break;
                }
              }
            }
            if (isSlotFree) {
              lines.push(`🕒 ${fmtHM(slot.start)} - ${fmtHM(slot.end)}`);
            }
          }
          blocos.push(buildDayText(lines, tDate));
          allSlotsText.push(...lines);
        }

        const texto = blocos.join("\n\n");
        return ok({
          success: true, tipo_busca: "aberta",
          texto_disponibilidade: ctrl === "segunda-feira" ? texto : blocos[0] || texto,
          horarios_livres_text: allSlotsText.join(", "),
          data_solicitada: rawDT,
        });
      }

      // ---- BUSCA DIRETA ----
      if (sameDay(dt, new Date()) && dt < addMins(new Date(), 180)) {
         return ok({ success: true, tipo_busca: "direta", mensagem: "Para agendamentos hoje, precisamos de pelo menos 3 horas de antecedência. Você teria outro horário em mente?" });
      }

      const pReqDir = getSPParts(dt);
      const dowDir = new Date(`${pReqDir.year}-${pReqDir.month}-${pReqDir.day}T12:00:00-03:00`).getDay();
      const wkDir = wkey(dowDir);
      const reqMin = minsOfDay(dt);
      const available = rows.filter((r: any) => {
        if (!r[`${wkDir}_works`]) return false;
        const s = minsHHMM(r[`${wkDir}_start`]), e = minsHHMM(r[`${wkDir}_end`]);
        return s !== null && e !== null && reqMin >= s && (reqMin + SLOT_MIN) <= e;
      });

      if (available.length > 0) {
        // Check freeBusy for 1h slot
        const slotStart = toISO(dt), slotEnd = toISO(addMins(dt, SLOT_MIN));
        for (const broker of available) {
          if (!broker.calendar_id) continue;
          const busy = await checkBusy(gFetch, broker.calendar_id, slotStart, slotEnd);
          if (busy.length === 0) return ok({ success: true, tipo_busca: "direta", response: "data e hora disponível para agendamento de visita" });
        }
      }

      // All busy or 0 available → check next 3 business days at same time
      const dias = nextBizDays(dt, 3);
      const reqStartMin = minsOfDay(dt), reqEndMin = reqStartMin + SLOT_MIN;
      const diasDisp: string[] = [], diasIndisp: string[] = [];

      for (const dia of dias) {
        const pdia = getSPParts(dia);
        const ddow = new Date(`${pdia.year}-${pdia.month}-${pdia.day}T12:00:00-03:00`).getDay(); 
        const dwk = wkey(ddow);
        const brokersDay = rows.filter((r: any) => {
          if (!r[`${dwk}_works`] || !r.calendar_id) return false;
          const s = minsHHMM(r[`${dwk}_start`]), e = minsHHMM(r[`${dwk}_end`]);
          return s != null && e != null && reqStartMin >= s && reqEndMin <= e;
        });
        let found = false;
        for (const b of brokersDay) {
          const sDateStr = `${pdia.year}-${pdia.month}-${pdia.day}T${pReqDir.hour}:${pReqDir.minute}:00-03:00`;
          const sDate = new Date(sDateStr);
          const busy = await checkBusy(gFetch, b.calendar_id, toISO(sDate), toISO(addMins(sDate, SLOT_MIN)));
          if (busy.length === 0) { found = true; break; }
        }
        (found ? diasDisp : diasIndisp).push(fmtBR(dia));
      }

      const joinPt = (d: string[]) => {
        if (!d.length) return ""; if (d.length === 1) return `no dia ${d[0]}`;
        if (d.length === 2) return `nos dias ${d[0]} e ${d[1]}`;
        const last = d[d.length - 1]; return `nos dias ${d.slice(0, -1).join(", ")} e ${last}`;
      };
      const msg = diasDisp.length ? `Temos nesse mesmo horário ${joinPt(diasDisp)}.` : "Não encontramos disponibilidade nesse mesmo horário nos próximos dias.";
      return ok({ success: true, tipo_busca: "direta", dias_disponiveis: diasDisp, dias_indisponiveis: diasIndisp, mensagem: msg });
    }

    // ==================== BOOK VISIT ====================
    if (action === "book_visit") {
      const rawDT = String(body?.data_e_hora || "");
      const idImovel = String(body?.id_do_imovel || "");
      const sessionId = String(body?.session_id || "");
      const nomeCliente = String(body?.nome_cliente || "");
      const emailCliente = String(body?.email_cliente || "");

      if (!rawDT) return ok({ success: false, error: "data_e_hora obrigatório" }, 400);
      const dt = parseDT(rawDT);
      if (!dt || isNaN(dt.getTime())) return ok({ success: false, error: "data_e_hora inválida" }, 400);

      // Filter brokers
      const pReq = getSPParts(dt);
      const dow = new Date(`${pReq.year}-${pReq.month}-${pReq.day}T12:00:00-03:00`).getDay(); 
      const wk = wkey(dow);
      const reqMin = minsOfDay(dt);
      const available = rows.filter((r: any) => {
        if (!r[`${wk}_works`]) return false;
        const s = minsHHMM(r[`${wk}_start`]), e = minsHHMM(r[`${wk}_end`]);
        return s != null && e != null && reqMin >= s && (reqMin + SLOT_MIN) <= e;
      });

      if (available.length === 0) {
        return ok({
          success: false,
          error_code: "outside_schedule",
          response: "Informe ao cliente que está ocupado esse horario",
        });
      }

      // Calculate slot
      const slotStart = toISO(dt), slotEnd = toISO(addMins(dt, SLOT_MIN));
      const visitDayKey = dateKeyISO(dt);

      const visitScheduling = await loadCompanyVisitScheduling(service, companyId);
      const assignBrokerLater = visitScheduling.mode === "manual";

      const { broker: freeBroker, queueIndexToPersist } = await pickFreeBrokerForSlot(
        service,
        companyId,
        rows,
        available,
        visitScheduling,
        visitDayKey,
        async (b: any) => {
          if (!b.calendar_id) return false;
          const busy = await checkBusy(gFetch, b.calendar_id, slotStart, slotEnd);
          return busy.length === 0;
        },
      );

      if (!freeBroker) {
        return ok({
          success: false,
          error_code: "slot_busy",
          response: "Eita acabaram de agendar pra esse horário, teria alguma outra opção?",
        });
      }

      // Get property data
      let propertyData: any = {};
      if (idImovel) {
        const cleanId = idImovel.match(/\d+/)?.[0] || idImovel;
        const { data: props } = await service.from("imoveisvivareal").select("*").eq("listing_id", cleanId).eq("company_id", companyId).limit(1);
        if (props?.length) propertyData = props[0];
      }

      // Cria evento no corretor já validado (evita fila global ignorar plantão do dia).
      const calApiUrl = `${env("SUPABASE_URL")}/functions/v1/google-calendar-api`;
      const createBody: any = {
        action: "create_event_from_n8n",
        company_id: companyId,
        lead_id: sessionId,
        calendar_id: freeBroker.calendar_id,
        broker_id: freeBroker.assigned_user_id || "",
        use_broker_queue: false,
        auto_reassign_on_conflict: false,
        nome_cliente: nomeCliente,
        start: slotStart,
        end: slotEnd,
        summary: `Visita Imóvel ${idImovel}`,
        description: propertyData.tamanho_m2 ? `Tamanho: ${propertyData.tamanho_m2}m²\nQuantidade de Quartos: ${propertyData.quartos}\nQuantidade de Banheiros: ${propertyData.banheiros}\nVaga de Garagem: ${propertyData.garagem}` : "",
        location: propertyData.endereco ? `${propertyData.endereco} ${propertyData.numero || ""}, ${propertyData.bairro || ""}, ${propertyData.cidade || ""}` : "",
        attendees: emailCliente || "",
        use_default_reminders: false,
        reminders: [{ method: "email", minutes: 60 }],
      };

      const createRes = await fetch(calApiUrl, {
        method: "POST",
        headers: calFnHeaders,
        body: JSON.stringify(createBody),
      });
      const createJson = await createRes.json().catch(() => ({}));

      if (!createRes.ok || createJson?.conflict) {
        const isConflict = createRes.status === 409 || createJson?.conflict === true;
        const isAuthError = createRes.status === 401 || createRes.status === 403;
        const isServerError = createRes.status >= 500;
        const errorCode = isConflict ? "slot_busy" : isAuthError ? "auth_error" : isServerError ? "calendar_error" : "booking_failed";
        const response = isConflict
          ? "Eita acabaram de agendar pra esse horário, teria alguma outra opção?"
          : isAuthError
            ? "Falha de autenticação ao confirmar no calendário. Verifique a chave service_role no n8n."
            : isServerError
              ? "Tivemos uma instabilidade ao confirmar no calendário. Pode tentar de novo em instantes ou escolher outro horário?"
              : "Não conseguimos confirmar o agendamento agora. Pode tentar outro horário?";
        return ok({
          success: false,
          error_code: errorCode,
          response,
          calendar_status: createRes.status,
          calendar_error: createJson?.error || createJson?.message || null,
        });
      }

      if (queueIndexToPersist !== null && visitScheduling.mode !== "manual") {
        await persistQueueIndex(service, companyId, queueIndexToPersist);
      }

      const brokerIdFromCalendar = createJson?.broker_id || null;
      const brokerNameFromCalendar = createJson?.broker_name || "";
      const calendarId = createJson?.calendar_id || "";
      const eventId = createJson?.id || "";

      // Format note
      const startDT = createJson?.start?.dateTime || slotStart;
      const dataPt = new Date(startDT).toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
      const horaPt = new Date(startDT).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
      const resumo = assignBrokerLater
        ? `Visita agendada para ${dataPt} às ${horaPt} no imóvel ${idImovel}. Aguardando definição do corretor responsável.`
        : `Visita agendada para ${dataPt} às ${horaPt} no imóvel ${idImovel}`;

      // Update lead
      if (sessionId) {
        const updateFields: any = {
          stage: "visita-agendada",
          notes: resumo,
          updated_at: new Date().toISOString(),
        };
        if (nomeCliente) updateFields.name = nomeCliente;
        if (emailCliente) updateFields.email = emailCliente;
        if (!assignBrokerLater) {
          if (brokerIdFromCalendar) updateFields.id_corretor_responsavel = brokerIdFromCalendar;
          if (brokerNameFromCalendar) updateFields.Corretor_responsavel = brokerNameFromCalendar;
        }
        if (calendarId) updateFields.calenda_id = calendarId;
        if (eventId) updateFields.event_id = eventId;
        if (propertyData.tipo_imovel) updateFields.interest = propertyData.tipo_imovel;
        if (propertyData.preco) updateFields.estimated_value = propertyData.preco;
        if (propertyData.descricao) updateFields.imovel_interesse = String(propertyData.descricao).split(" (98)")[0];

        await service.from("leads").update(updateFields).eq("id", sessionId).eq("company_id", companyId);
      }

      const respText = assignBrokerLater
        ? `Perfeito ${nomeCliente || "[nome]"}, acabei de agendar a visita para ${dataPt} às ${horaPt}!\n\nNossa equipe vai definir o corretor responsável e entrar em contato com você em instantes.`
        : `Perfeito ${nomeCliente || "[nome]"}, acabei de agendar!\n\nCorretor Responsável: ${brokerNameFromCalendar || "da imobiliária"}\n\nO corretor responsável vai entrar em contato com você em instantes.\n\nCaso venha ser o nome da empresa, fale que o corretor responsavel vai entrar em contato. Nunca envente um nome`;
      return ok({
        success: true,
        response: respText,
        event_id: eventId,
        broker_name: assignBrokerLater ? null : brokerNameFromCalendar,
        broker_id: assignBrokerLater ? null : brokerIdFromCalendar,
        calendar_id: calendarId,
        visit_assignment_mode: visitScheduling.mode,
        broker_pending_assignment: assignBrokerLater,
      });
    }

    // ==================== ASSIGN VISIT BROKER (modo manual) ====================
    if (action === "assign_visit_broker") {
      const leadId = String(body?.lead_id || "").trim();
      const brokerUserId = String(body?.broker_id || "").trim();
      if (!leadId || !brokerUserId) {
        return ok({ success: false, error: "lead_id e broker_id são obrigatórios" }, 400);
      }

      const permError = await assertCompanyManager(req, service, companyId);
      if (permError) return ok({ success: false, error: permError }, 403);

      const { data: lead, error: leadError } = await service
        .from("leads")
        .select("id, event_id, calenda_id, notes, stage, id_corretor_responsavel")
        .eq("id", leadId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (leadError) return ok({ success: false, error: leadError.message }, 500);
      if (!lead?.event_id || !lead?.calenda_id) {
        return ok({ success: false, error: "Lead sem visita vinculada ao calendário" }, 400);
      }

      const stage = String(lead.stage || "").toLowerCase().replace(/\s+/g, "-");
      if (stage !== "visita-agendada") {
        return ok({ success: false, error: "Lead não está com visita agendada" }, 400);
      }

      if (lead.id_corretor_responsavel) {
        return ok({ success: false, error: "Este lead já possui corretor responsável" }, 400);
      }

      const { data: scheduleRows, error: scheduleError } = await service
        .from("oncall_schedules")
        .select("calendar_id, assigned_user_id")
        .eq("company_id", companyId)
        .eq("assigned_user_id", brokerUserId)
        .not("calendar_id", "is", null)
        .limit(1);

      if (scheduleError) return ok({ success: false, error: scheduleError.message }, 500);
      const scheduleRow = Array.isArray(scheduleRows) ? scheduleRows[0] : null;
      if (!scheduleRow?.calendar_id) {
        return ok({
          success: false,
          error: "Corretor sem calendário configurado no plantão",
        }, 400);
      }

      const { data: brokerProfile } = await service
        .from("user_profiles")
        .select("full_name, email, is_active, role")
        .eq("id", brokerUserId)
        .maybeSingle();

      if (!brokerProfile?.is_active) {
        return ok({ success: false, error: "Corretor inativo" }, 400);
      }
      if (!["corretor", "gestor"].includes(String(brokerProfile.role || ""))) {
        return ok({ success: false, error: "Usuário selecionado não é corretor ou gestor" }, 400);
      }

      const brokerName = String(brokerProfile.full_name || brokerProfile.email || brokerUserId);
      const destCalendarId = String(scheduleRow.calendar_id);
      let eventId = String(lead.event_id);
      let calendarId = String(lead.calenda_id);

      if (destCalendarId !== calendarId) {
        try {
          const moved = await gFetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/move?destination=${encodeURIComponent(destCalendarId)}`,
            { method: "POST" },
          );
          eventId = String(moved?.id || eventId);
          calendarId = destCalendarId;
        } catch (moveErr: any) {
          return ok({
            success: false,
            error: moveErr?.message || "Não foi possível mover a visita para o calendário do corretor",
          }, 500);
        }
      }

      const cleanedNotes = String(lead.notes || "")
        .replace(/\.?\s*Aguardando definição do corretor responsável\.?/gi, "")
        .trim();

      const { error: updateError } = await service
        .from("leads")
        .update({
          id_corretor_responsavel: brokerUserId,
          Corretor_responsavel: brokerName,
          calenda_id: calendarId,
          event_id: eventId,
          notes: cleanedNotes || lead.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("company_id", companyId);

      if (updateError) return ok({ success: false, error: updateError.message }, 500);

      return ok({
        success: true,
        lead_id: leadId,
        broker_id: brokerUserId,
        broker_name: brokerName,
        calendar_id: calendarId,
        event_id: eventId,
      });
    }

    // ==================== CANCEL VISIT ====================
    if (action === "cancel_visit") {
      const sessionId = String(body?.session_id || "");
      if (!sessionId) return ok({ success: false, error: "session_id obrigatório" }, 400);

      const { data: lead } = await service.from("leads").select("id, calenda_id, event_id, company_id").eq("id", sessionId).eq("company_id", companyId).maybeSingle();
      if (!lead || !lead.event_id || !lead.calenda_id) return ok({ success: false, error: "Lead sem agendamento vinculado" }, 400);

      const calApiUrl = `${env("SUPABASE_URL")}/functions/v1/google-calendar-api`;
      const cancelRes = await fetch(calApiUrl, {
        method: "POST",
        headers: calFnHeaders,
        body: JSON.stringify({ action: "cancel_event_from_n8n", company_id: companyId, calendar_id: lead.calenda_id, event_id: lead.event_id, lead_id: sessionId }),
      });
      const cancelJson = await cancelRes.json().catch(() => ({}));
      return ok({ success: true, response: "Agendamento cancelado com sucesso.", ...cancelJson });
    }

    return ok({
      success: false,
      error: "action inválida. Use: check_availability, book_visit, cancel_visit, assign_visit_broker",
    }, 400);
  } catch (e: any) {
    return ok({ success: false, error: e?.message || "Erro interno" }, 500);
  }
});
