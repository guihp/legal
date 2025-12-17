import { useEffect, useRef } from 'react';
import { useAuthManager } from './useAuthManager';
import { logAudit } from '@/lib/audit/logger';

export function useAuthAudit() {
  const { session } = useAuthManager();
  const lastSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = session?.user?.id || null;
    const lastUserId = lastSessionRef.current;

    // Login detectado - fazer log após um pequeno delay para garantir que o perfil foi carregado
    if (currentUserId && currentUserId !== lastUserId) {
      setTimeout(async () => {
        try {
          await logAudit({
            action: 'user.login',
            resource: 'user_profile',
            resourceId: currentUserId,
            meta: {
              email: session?.user?.email,
              provider: session?.user?.app_metadata?.provider || 'email',
              login_time: new Date().toISOString()
            }
          });
        } catch (error) {
          console.warn('Erro ao registrar login (não crítico):', error);
        }
      }, 1000);
    }

    // Logout detectado
    if (!currentUserId && lastUserId) {
      try {
        logAudit({
          action: 'user.logout',
          resource: 'user_profile',
          resourceId: lastUserId,
          meta: {
            logout_time: new Date().toISOString()
          }
        });
      } catch (error) {
        console.warn('Erro ao registrar logout:', error);
      }
    }

    lastSessionRef.current = currentUserId;
  }, [session]);
}
