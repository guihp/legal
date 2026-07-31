export type ListingFact = { label: string; value: string };

/** Long ficha/commercial dump — not a short interest or property id. */
export function isListingDump(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /ficha\s*t[eé]cnica/i.test(t) ||
    /descri[çc][ãa]o\s*comercial/i.test(t) ||
    (t.includes('\n') && t.length > 80) ||
    t.length > 120
  );
}

/** Compact label for tables: tipo ("Casa") or truncated short text — never full ficha. */
export function shortListingLabel(raw: string | null | undefined, maxLen = 40): string {
  const text = String(raw || '').trim();
  if (!text || text === 'Não especificado') return '';
  if (!isListingDump(text)) {
    return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
  }
  const tipo = extractListingBasicFacts(text).find((f) => /tipo\s*de\s*im[oó]vel/i.test(f.label));
  if (tipo?.value) {
    const v = tipo.value.trim();
    return v.length > maxLen ? `${v.slice(0, maxLen).trim()}…` : v;
  }
  return '';
}

/** Only a real short property id — rejects ficha dumps. */
export function shortPropertyId(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  if (!text || isListingDump(text)) return '';
  if (text.length > 48) return `${text.slice(0, 48).trim()}…`;
  return text;
}

export function extractListingBasicFacts(raw: string): ListingFact[] {
  const commercialIdx = raw.search(/\[?\s*DESCRI[ÇC][ÃA]O\s*COMERCIAL/i);
  let body = (commercialIdx >= 0 ? raw.slice(0, commercialIdx) : raw).trim();

  const fichaHeader = body.match(/\[?\s*FICHA\s*T[EÉ]CNICA[^\]]*\]?\s*/i);
  if (fichaHeader?.index != null) {
    body = body.slice(fichaHeader.index + fichaHeader[0].length).trim();
  }

  const facts: ListingFact[] = [];
  const seen = new Set<string>();
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^\[/.test(trimmed)) continue;
    const kv = trimmed.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!kv) continue;
    const label = kv[1].trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ label, value: kv[2].trim() });
  }
  return facts;
}

export function resolveListingDisplay(raw: string | null | undefined):
  | { kind: 'facts'; facts: ListingFact[] }
  | { kind: 'text'; text: string }
  | { kind: 'empty' } {
  const text = (raw || '').trim();
  if (!text) return { kind: 'empty' };

  if (!isListingDump(text)) return { kind: 'text', text };

  const facts = extractListingBasicFacts(text);
  if (facts.length > 0) return { kind: 'facts', facts };

  const commercialIdx = text.search(/\[?\s*DESCRI[ÇC][ÃA]O\s*COMERCIAL/i);
  const fichaOnly = (commercialIdx >= 0 ? text.slice(0, commercialIdx) : text)
    .replace(/\[?\s*FICHA\s*T[EÉ]CNICA[^\]]*\]?\s*/i, '')
    .trim();
  if (fichaOnly) return { kind: 'text', text: fichaOnly };

  return {
    kind: 'text',
    text: text.length > 160 ? `${text.slice(0, 160).trim()}…` : text,
  };
}
