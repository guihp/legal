import type { ReactNode } from 'react';
import { ConversationListPreview } from '@/components/chat/ConversationListPreview';
import type { ConversationPreviewKind } from '@/lib/conversaMedia';
import {
  conversationLabelListBadgeClasses,
  labelColorListBadgeClasses,
  type ContactLabelBadge,
} from '@/lib/conversationContactLabels';
import { crmStageBadgeClasses } from '@/lib/crmKanbanStages';

export type ConversationListItemProps = {
  selected?: boolean;
  onClick: () => void;
  displayName: string;
  leadStage?: string | null;
  /** Cor do catálogo; se omitida, infere pelo nome legado. */
  labelColor?: string | null;
  /** Múltiplas etiquetas de contato (ai_ativa + follow_up_*, etc.). */
  contactLabels?: ContactLabelBadge[] | null;
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
      title={title || children}
      className={`conversas-list-badge inline-flex max-w-[7.5rem] items-center truncate rounded px-1.5 py-0 text-[9px] font-semibold leading-tight tracking-normal border-0 ${className}`}
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
  labelColor,
  contactLabels,
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
  const badges: ContactLabelBadge[] =
    contactLabels && contactLabels.length > 0
      ? contactLabels
      : [
          {
            slug: 'legacy',
            name: labelStage,
            color: labelColor || 'emerald',
          },
        ];

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
            {badges.map((b) => (
              <ListBadge
                key={b.slug}
                className={
                  b.color
                    ? labelColorListBadgeClasses(b.color)
                    : conversationLabelListBadgeClasses(b.name)
                }
              >
                {b.name}
              </ListBadge>
            ))}
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
