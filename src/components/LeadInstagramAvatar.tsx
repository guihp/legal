import React, { useEffect, useState } from 'react';
import { differenceInHours } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { requestInstagramProfilePicRefresh } from '@/lib/instagramProfilePicRefresh';

const PROFILE_STALE_HOURS = 48;

function needsProfileResync(lastSyncIso: string | null | undefined): boolean {
  if (lastSyncIso == null || String(lastSyncIso).trim() === '') return true;
  const t = new Date(lastSyncIso);
  if (Number.isNaN(t.getTime())) return true;
  return differenceInHours(new Date(), t) >= PROFILE_STALE_HOURS;
}

export type LeadInstagramAvatarProps = {
  leadId: string;
  displayName: string;
  profilePicUrlInstagram?: string | null;
  lastProfileSyncInstagram?: string | null;
  instagramIdCliente?: string | null;
  companyTokenInstagram?: string | null;
  className?: string;
  fallbackClassName?: string;
};

/**
 * Avatar de lead Instagram: URL em cache; webhook em background se sync >48h;
 * Radix mostra fallback se não houver src ou imagem quebrar (403 / expirada).
 */
export function LeadInstagramAvatar({
  leadId,
  displayName,
  profilePicUrlInstagram,
  lastProfileSyncInstagram,
  instagramIdCliente,
  companyTokenInstagram,
  className = 'h-full w-full',
  fallbackClassName,
}: LeadInstagramAvatarProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const initial = (displayName?.trim()?.charAt(0) || '?').toUpperCase();
  const rawUrl = profilePicUrlInstagram?.trim() || '';
  const effectiveSrc = rawUrl && !imgBroken ? rawUrl : undefined;

  useEffect(() => {
    setImgBroken(false);
  }, [rawUrl]);

  useEffect(() => {
    if (!needsProfileResync(lastProfileSyncInstagram)) return;
    if (!instagramIdCliente?.trim() || !companyTokenInstagram?.trim()) return;
    requestInstagramProfilePicRefresh({
      lead_id: leadId,
      instagram_id_cliente: instagramIdCliente.trim(),
      token_instagram: companyTokenInstagram.trim(),
    });
  }, [leadId, lastProfileSyncInstagram, instagramIdCliente, companyTokenInstagram]);

  return (
    <Avatar className={className}>
      <AvatarImage
        src={effectiveSrc}
        alt=""
        className="object-cover"
        onError={() => setImgBroken(true)}
      />
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  );
}
