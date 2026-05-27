import { File as FileIcon, Image as ImageIcon, Mic, Video } from 'lucide-react';
import type { ConversationPreviewKind } from '@/lib/conversaMedia';

export function ConversationListPreview({
  kind,
  text,
}: {
  kind?: ConversationPreviewKind | null;
  text: string;
}) {
  const label = text || 'Toque para abrir conversa';
  if (!kind) {
    return <span className="truncate">{label}</span>;
  }
  const iconClass = 'w-3.5 h-3.5 shrink-0 text-[var(--cv-text-muted)]';
  const Icon =
    kind === 'audio' ? Mic : kind === 'image' ? ImageIcon : kind === 'video' ? Video : FileIcon;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <Icon className={iconClass} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
