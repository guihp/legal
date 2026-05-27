import React from 'react';

/** Negrito: `**texto**` ou `*texto*` (padrão WhatsApp). */
export function processTextWithBold(text: unknown): React.ReactNode {
  const raw = text == null ? '' : typeof text === 'string' ? text : String(text);
  if (!raw) return raw;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.substring(lastIndex, match.index));
    }
    const boldText = match[1] ?? match[2] ?? '';
    parts.push(
      <strong key={`b-${key++}`} className="font-semibold">
        {boldText}
      </strong>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.substring(lastIndex));
  }

  return parts.length > 0 ? parts : raw;
}
