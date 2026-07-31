import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type ChatContactAvatarProps = {
  displayName?: string | null;
  profilePicUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
};

/**
 * Avatar de contato WhatsApp: usa profile_pic_url_whatsapp; fallback silhueta se URL vazia/quebrada.
 */
export function ChatContactAvatar({
  displayName: _displayName,
  profilePicUrl,
  className = 'h-full w-full',
  fallbackClassName = 'bg-[var(--cv-panel-muted)] text-[var(--cv-text-muted)]',
  iconClassName = 'h-6 w-6',
}: ChatContactAvatarProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const rawUrl = String(profilePicUrl || '').trim();
  const effectiveSrc = rawUrl && !imgBroken ? rawUrl : undefined;

  useEffect(() => {
    setImgBroken(false);
  }, [rawUrl]);

  return (
    <Avatar className={className}>
      <AvatarImage
        src={effectiveSrc}
        alt=""
        className="object-cover"
        referrerPolicy="no-referrer"
        onError={() => setImgBroken(true)}
      />
      <AvatarFallback className={fallbackClassName}>
        <User className={iconClassName} strokeWidth={1.5} aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}
