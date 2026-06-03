import { isAutoMediaPlaceholderText } from '@/lib/chatMediaCaption';

// Detector de tipo de mídia para o campo `media` da tabela
// `imobipro_messages_*` / `crm_whatsapp_messages_*`.
//
// O conteúdo desse campo varia bastante: pode ser uma URL pública, um data URL
// (`data:image/png;base64,...`), base64 puro (sem prefixo), ou — mais comum
// hoje — um JSON stringificado vindo do n8n contendo `imagem`/`audio`/`video`
// com URL apontando pra um asset hospedado.
//
// O detector antigo só fazia `startsWith('/9j/')` ou `startsWith('iVBORw0')`,
// que só pegava base64 puro de JPEG/PNG. Quando a mensagem era qualquer outro
// formato, o front caía no fallback que mostrava 🎧 (áudio) — daí o bug visual
// reportado: imagem aparecendo como ícone de fone na lista de conversas.

export type MediaKind = 'image' | 'audio' | 'video' | 'unknown';

const IMG_BASE64_PREFIXES = ['/9j/', 'iVBORw0', 'R0lGOD', 'UklGR', 'PHN2Zy', 'PD94bW']; // JPEG, PNG, GIF, WEBP, SVG, XML/SVG
const AUDIO_BASE64_PREFIXES = ['SUQzB', 'SUQzA', '//uQ', '//sw', 'T2dnUw']; // MP3 (ID3), MP3 (no header), Ogg
const VIDEO_BASE64_PREFIXES = ['AAAAGGZ0eXBtcDQy', 'AAAAIGZ0eXBpc29t', 'GkXfo']; // MP4, WebM/Matroska

const IMG_URL_EXT = /\.(?:jpe?g|png|gif|webp|bmp|svg|heic|heif)(?:\?|#|$)/i;
// MediaRecorder grava em .webm (Chrome) e .mp4 (Safari). Incluimos os dois aqui
// como fallback defensivo; quando o frontend insere o registro ele usa o
// formato JSON {"audio":"<url>"}, que tem prioridade na deteccao por chave.
/** Extensões típicas de áudio (mp4 omitido — conflita com vídeo; ver `isStoredChatAudioUrl`). */
const AUDIO_URL_EXT = /\.(?:mp3|m4a|wav|ogg|opus|aac|flac|webm)(?:\?|#|$)/i;
const VIDEO_URL_EXT = /\.(?:mp4|webm|mov|avi|mkv|m3u8)(?:\?|#|$)/i;

/** Upload do painel: `.../chat-media/{canal}/audio/...` */
export function isStoredChatAudioUrl(url: string): boolean {
  return /\/chat-media\/[^/]+\/audio\//i.test(url.toLowerCase());
}

/** Upload do painel: `.../chat-media/{canal}/video/...` */
export function isStoredChatVideoUrl(url: string): boolean {
  return /\/chat-media\/[^/]+\/video\//i.test(url.toLowerCase());
}

/**
 * Heurística para classificar o `media` numa das 4 categorias.
 * Sempre prioriza o sinal mais forte (MIME / extensão de URL / JSON-key)
 * antes de cair em prefixos base64.
 */
export function inferMediaKind(raw: unknown): MediaKind {
  if (raw == null) return 'unknown';
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return 'unknown';
  const lower = s.toLowerCase();

  // 1) Data URL — mais explícito.
  if (lower.startsWith('data:image/')) return 'image';
  if (lower.startsWith('data:audio/')) return 'audio';
  if (lower.startsWith('data:video/')) return 'video';

  // 2) URL com extensão conhecida.
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    if (IMG_URL_EXT.test(lower)) return 'image';
    if (AUDIO_URL_EXT.test(lower)) return 'audio';
    if (VIDEO_URL_EXT.test(lower)) return 'video';
    return 'unknown';
  }

  // 3) JSON stringificado (formato comum do n8n: { imagem: "http..." } etc).
  if (s.startsWith('{') || s.startsWith('[')) {
    if (/"imagem"|"image"|image\//i.test(s)) return 'image';
    if (/"audio"|"voice"|"voz"|"audio_url"|audio\//i.test(s)) return 'audio';
    if (/"video"|"video_url"|video\//i.test(s)) return 'video';
    return 'unknown';
  }

  // 4) Base64 puro — fallback por prefixo.
  if (IMG_BASE64_PREFIXES.some((p) => s.startsWith(p))) return 'image';
  if (AUDIO_BASE64_PREFIXES.some((p) => s.startsWith(p))) return 'audio';
  if (VIDEO_BASE64_PREFIXES.some((p) => s.startsWith(p))) return 'video';

  return 'unknown';
}

export type ConversationPreviewKind = 'image' | 'audio' | 'video' | 'document';

function labelForPreviewKind(kind: ConversationPreviewKind): string {
  switch (kind) {
    case 'image': return 'Foto';
    case 'audio': return 'Áudio';
    case 'video': return 'Vídeo';
    case 'document': return 'Documento';
  }
}

function kindFromMensageType(mensageType: string): ConversationPreviewKind | null {
  const t = mensageType.toLowerCase().trim();
  if (['audio', 'voice', 'ptt', 'voz'].includes(t)) return 'audio';
  if (['image', 'sticker', 'imagem'].includes(t)) return 'image';
  if (t === 'video') return 'video';
  if (['document', 'file', 'pdf', 'arquivo'].includes(t)) return 'document';
  return null;
}

/**
 * Preview da última mensagem na lista (estilo WhatsApp).
 * Com legenda: mostra só o texto. Sem legenda: "Áudio", "Foto", etc.
 */
export function resolveConversationListPreview(params: {
  text?: string | null;
  media?: unknown;
  mensageType?: string | null;
}): { kind: ConversationPreviewKind | null; text: string } {
  const txt = String(params.text ?? '').trim();
  let kind = kindFromMensageType(String(params.mensageType ?? ''));
  if (!kind && params.media != null) {
    const s = String(params.media).trim();
    if (s && s.toLowerCase() !== 'null') {
      const lower = s.toLowerCase();
      if (/\/chat-media\/[^/]+\/audio\//i.test(lower)) kind = 'audio';
      else if (/\/chat-media\/[^/]+\/image\//i.test(lower)) kind = 'image';
      else if (/\/chat-media\/[^/]+\/video\//i.test(lower)) kind = 'video';
      else {
        const inferred = inferMediaKind(params.media);
        if (inferred === 'image' || inferred === 'audio' || inferred === 'video') {
          kind = inferred;
        } else if (inferred === 'unknown' && /chat-media\/[^/]+\/outros/i.test(lower)) {
          kind = 'document';
        }
      }
    }
  }
  const mediaStr =
    params.media != null && String(params.media).trim().toLowerCase() !== 'null'
      ? String(params.media).trim()
      : null;

  if (kind) {
    const useGenericLabel = !txt || isAutoMediaPlaceholderText(txt, mediaStr);
    return { kind, text: useGenericLabel ? labelForPreviewKind(kind) : txt };
  }

  if (txt && isAutoMediaPlaceholderText(txt, mediaStr)) {
    const inferredFromName = inferMediaKindFromFilename(txt);
    if (inferredFromName) {
      return { kind: inferredFromName, text: labelForPreviewKind(inferredFromName) };
    }
  }

  return { kind: null, text: txt };
}

function inferMediaKindFromFilename(text: string): ConversationPreviewKind | null {
  const t = text.toLowerCase();
  if (/\.(mp4|mov|webm|m3u8)(\?|#|$)/i.test(t)) return 'video';
  if (/\.(mp3|m4a|ogg|opus|aac|wav|webm)(\?|#|$)/i.test(t)) return 'audio';
  if (/\.(jpe?g|png|gif|webp|heic)(\?|#|$)/i.test(t)) return 'image';
  if (/\.pdf(\?|#|$)/i.test(t)) return 'document';
  if (/^whatsapp\s+video\b/i.test(t)) return 'video';
  if (/^whatsapp\s+(image|foto)\b/i.test(t)) return 'image';
  if (/^whatsapp\s+(audio|ptt)\b/i.test(t)) return 'audio';
  return null;
}

/** Rótulo curto (sem colchetes) para fallbacks legados. */
export function mediaPreviewLabel(raw: unknown): string {
  const kind = inferMediaKind(raw);
  switch (kind) {
    case 'image': return 'Foto';
    case 'audio': return 'Áudio';
    case 'video': return 'Vídeo';
    default: return 'Mídia';
  }
}

/** Versão para concatenar com texto: já adiciona espaço no fim quando há mídia. */
export function mediaPreviewPrefix(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return '';
  return `${mediaPreviewLabel(raw)} `;
}

/**
 * Extrai a URL publica de audio do campo `media` da tabela
 * `imobipro_messages_*` quando presente.
 *
 * Aceita os formatos abaixo (ordem de prioridade):
 *  1. URL direta com extensao de audio (`https://.../audio-123.webm`)
 *  2. JSON stringificado com chave `audio` ou `audio_url`
 *     (`{"audio":"https://..."}` / `{"audio_url":"https://..."}`)
 *  3. JSON aninhado padrao n8n (`{"json":{"audio":"https://..."}}` ou em array)
 *
 * Retorna `null` quando nada for encontrado. Nao tenta interpretar base64 —
 * para isso continua existindo `buildDataUrlFromMedia` no MessageBubble.
 */
export function extractMediaAudio(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  const lower = s.toLowerCase();

  // 1) URL do Storage (pasta audio) — inclui .mp4/.m4a gravados como áudio (Instagram/Safari)
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    if (isStoredChatAudioUrl(lower)) return s;
    if (AUDIO_URL_EXT.test(lower) && !isStoredChatVideoUrl(lower)) return s;
  }

  // 2) JSON com chave audio/audio_url (com ou sem aspas escapadas)
  if (s.startsWith('{') || s.startsWith('[')) {
    const tryParse = (txt: string): any | null => {
      try { return JSON.parse(txt); } catch { return null; }
    };
    const cleaned = s.replace(/\\"/g, '"').replace(/^"|"$/g, '');
    const parsed = tryParse(s) ?? tryParse(cleaned);

    const pickAudioFromObj = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      const direct = obj.audio || obj.audio_url || obj.voice || obj.voz;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      if (obj.json && typeof obj.json === 'object') {
        const inner = pickAudioFromObj(obj.json);
        if (inner) return inner;
      }
      return null;
    };

    if (parsed) {
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') {
            const innerParsed = tryParse(item);
            const url = pickAudioFromObj(innerParsed);
            if (url) return url;
          } else {
            const url = pickAudioFromObj(item);
            if (url) return url;
          }
        }
      } else {
        const url = pickAudioFromObj(parsed);
        if (url) return url;
      }
    }

    // 3) Fallback bruto via regex caso o JSON venha com escape duplo do n8n
    const regex = /"(?:audio|audio_url|voice|voz)"\s*:\s*"((?:[^"\\]|\\.)+)"/i;
    const match = s.match(regex);
    if (match && match[1]) {
      return match[1].replace(/\\\//g, '/').replace(/\\"/g, '"');
    }
  }

  return null;
}

const PDF_URL_EXT = /\.pdf(?:\?|#|$)/i;

function pickUrlFromMediaObject(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (obj.json && typeof obj.json === 'object') {
    return pickUrlFromMediaObject(obj.json as Record<string, unknown>, keys);
  }
  return null;
}

function extractMediaFromJsonKeys(raw: string, keys: string[], urlExt?: RegExp): string | null {
  const s = raw.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  const lower = s.toLowerCase();

  if ((lower.startsWith('http://') || lower.startsWith('https://')) && (!urlExt || urlExt.test(lower))) {
    return s;
  }

  if (!s.startsWith('{') && !s.startsWith('[')) return null;

  const tryParse = (txt: string): unknown | null => {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  };
  const cleaned = s.replace(/\\"/g, '"').replace(/^"|"$/g, '');
  const parsed = tryParse(s) ?? tryParse(cleaned);
  if (!parsed || typeof parsed !== 'object') return null;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string') {
        const inner = extractMediaFromJsonKeys(item, keys, urlExt);
        if (inner) return inner;
      } else if (item && typeof item === 'object') {
        const url = pickUrlFromMediaObject(item as Record<string, unknown>, keys);
        if (url) return url;
      }
    }
    return null;
  }

  return pickUrlFromMediaObject(parsed as Record<string, unknown>, keys);
}

/** URL de vídeo em `conteudo_media` (MP4 no Storage ou JSON do n8n). */
export function extractMediaVideo(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  const fromJson = extractMediaFromJsonKeys(s, ['video', 'video_url'], VIDEO_URL_EXT);
  if (fromJson) return fromJson;
  const lower = s.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    if (isStoredChatAudioUrl(lower)) return null;
    if (isStoredChatVideoUrl(lower)) return s;
    if (VIDEO_URL_EXT.test(lower)) return s;
  }
  return null;
}

/** URL de PDF/documento em `conteudo_media`. */
export function extractMediaDocument(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  const fromJson = extractMediaFromJsonKeys(
    s,
    ['document', 'pdf', 'file_url', 'file', 'arquivo'],
    PDF_URL_EXT,
  );
  if (fromJson) return fromJson;
  const lower = s.toLowerCase();
  if ((lower.startsWith('http://') || lower.startsWith('https://')) && PDF_URL_EXT.test(lower)) {
    return s;
  }
  if (/\/chat-media\/[^/]+\/document\//i.test(lower)) return s;
  return null;
}

export function isAudioMensageType(mensageType: string | null | undefined): boolean {
  const t = String(mensageType ?? '').toLowerCase().trim();
  return ['audio', 'voice', 'ptt', 'voz'].includes(t);
}

export function isVideoMensageType(mensageType: string | null | undefined): boolean {
  return String(mensageType ?? '').toLowerCase().trim() === 'video';
}

export function hasChatRenderableMedia(row: {
  media?: unknown;
  mediaImages?: string[] | null;
  mensageType?: string | null;
}): boolean {
  if (row.mediaImages?.length) return true;
  if (isAudioMensageType(row.mensageType) && row.media) return true;
  if (isVideoMensageType(row.mensageType) && row.media) return true;
  return !!(
    extractMediaAudio(row.media) ||
    extractMediaVideo(row.media) ||
    extractMediaDocument(row.media)
  );
}

export function documentFileNameFromUrl(url: string, fallback = 'documento.pdf'): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() || '';
    if (base.toLowerCase().endsWith('.pdf')) return decodeURIComponent(base);
  } catch {
    /* ignore */
  }
  return fallback;
}
