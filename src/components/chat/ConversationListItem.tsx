import type { ReactNode } from 'react';
import { ConversationListPreview } from '@/components/chat/ConversationListPreview';
import type { ConversationPreviewKind } from '@/lib/conversaMedia';
import { conversationLabelListBadgeClasses } from '@/lib/conversationContactLabels';
import { crmStageBadgeClasses } from '@/lib/crmKanbanStages';

export type ConversationListItemProps = {
  selected?: boolean;
  onClick: () => void;
  displayName: string;
  leadStage?: string | null;
  crmStage?: string | null;
  hasCrmLead?: boolean;
  timeLabel?: string;
  previewKind?: ConversationPreviewKind | null;
  previewText: string;
  avatar: ReactNode;
  /** Anel do avatar: verde (WhatsApp) ou gradiente IG. */
  variant?: 'whatsapp' | 'instagram';
  /** Mensagens do cliente ainda não “vistas” (regras no useConversasUnread). */
  unreadCount?: number;
};

function ListBadge({ className, children, title }: { className: string; children: string; title?: string }) {
  return (
    <span
      title={title}
      className={`conversas-list-badge inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight tracking-wide border-0 ${className}`}
    >
      {children}
    </span>
  );
}

export function ConversationListItem({
  selected = false,
  onClick,
  displayName,
  leadStage,
  crmStage,
  hasCrmLead,
  timeLabel,
  previewKind,
  previewText,
  avatar,
  variant = 'whatsapp',
  unreadCount = 0,
}: ConversationListItemProps) {
  const labelStage = leadStage || 'AI ATIVA';
  const crmLabel = crmStage?.trim() || 'CRM';

  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected ? 'true' : 'false'}
      className={`conversas-list-item group${variant === 'instagram' ? ' conversas-list-item--instagram' : ''}`}
    >
      <div className="conversas-list-item__avatar-ring">{avatar}</div>

      <div className="conversas-list-item__body min-w-0 flex-1">
        <div className="conversas-list-item__head">
          <h3
            className={`conversas-list-item__name truncate${unreadCount > 0 ? ' conversas-list-item__name--unread' : ''}`}
          >
            {displayName}
          </h3>
          {timeLabel ? (
            <time
              className={`conversas-list-item__time tabular-nums shrink-0${unreadCount > 0 ? ' conversas-list-item__time--unread' : ''}`}
            >
              {timeLabel}
            </time>
          ) : null}
        </div>

        <div className="conversas-list-item__badges-row">
          <div className="conversas-list-item__badges">
            <ListBadge className={conversationLabelListBadgeClasses(labelStage)}>{labelStage}</ListBadge>
            {hasCrmLead ? (
              <ListBadge
                className={crmStageBadgeClasses(crmLabel)}
                title="Estágio no CRM (Kanban)"
              >
                {crmLabel}
              </ListBadge>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <span
              className={`conversas-list-unread-badge${unreadCount > 9 ? ' conversas-list-unread-badge--wide' : ''}`}
              aria-label={`${unreadCount} mensagem${unreadCount === 1 ? '' : 's'} não lida${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>

        <p className="conversas-list-item__preview">
          <ConversationListPreview kind={previewKind} text={previewText} />
        </p>
      </div>
    </button>
  );
}
