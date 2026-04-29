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
const AUDIO_URL_EXT = /\.(?:mp3|m4a|wav|ogg|opus|aac|flac|webm|mp4)(?:\?|#|$)/i;
const VIDEO_URL_EXT = /\.(?:mp4|webm|mov|avi|mkv|m3u8)(?:\?|#|$)/i;

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

/**
 * Rótulo amigável (texto puro, sem emoji) para o preview da lista de
 * conversas — substitui o uso dos emojis 🖼️ / 🎧 / 📎 antigos.
 *
 * Quando há texto além da mídia (ex.: caption), o caller deve concatenar:
 *   `${mediaPreviewLabel(media)} ${cleanContent}`
 *
 * Usa colchetes pra ficar visualmente óbvio que é um marker, e mantém o
 * mesmo padrão que o WhatsApp mostra ("[imagem]").
 */
export function mediaPreviewLabel(raw: unknown): string {
  const kind = inferMediaKind(raw);
  switch (kind) {
    case 'image': return '[Imagem]';
    case 'audio': return '[Áudio]';
    case 'video': return '[Vídeo]';
    default:      return '[Mídia]';
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

  // 1) URL direta com extensao conhecida
  if ((lower.startsWith('http://') || lower.startsWith('https://')) && AUDIO_URL_EXT.test(lower)) {
    return s;
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
