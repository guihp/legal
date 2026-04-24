import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CustomDomainResolution = {
  loading: boolean;
  isCustomDomain: boolean;
  siteSlug: string | null;
  companyId: string | null;
  siteTitle: string | null;
};

/**
 * Detecta se o hostname atual corresponde a um domínio próprio (white-label)
 * cadastrado em company_custom_domains com status verificado.
 *
 * Hostnames que NÃO são custom domain:
 * - domínio principal do app (VITE_PUBLIC_SITE_DOMAIN)
 * - subdomínios do domínio principal (ex: jastelo.imobi.iafeoficial.com — esse fluxo
 *   já é tratado pelo caminho "isCompanySubdomain" do App.tsx)
 * - localhost e IPs diretos
 *
 * Quando é custom domain, retorna o `siteSlug` pra renderizar o SiteVitrine
 * como se fosse /s/:companySlug.
 */
export function useCustomDomain(): CustomDomainResolution {
  const [state, setState] = useState<CustomDomainResolution>({
    loading: true,
    isCustomDomain: false,
    siteSlug: null,
    companyId: null,
    siteTitle: null,
  });

  useEffect(() => {
    let cancelled = false;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isIp = /^[0-9.]+$/.test(hostname);
    const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost');

    const primaryHost =
      ((import.meta as any)?.env?.VITE_PUBLIC_SITE_DOMAIN as string | undefined) ||
      ((import.meta as any)?.env?.VITE_PUBLIC_APP_URL
        ? (() => {
            try {
              return new URL((import.meta as any).env.VITE_PUBLIC_APP_URL).hostname;
            } catch {
              return undefined;
            }
          })()
        : undefined) ||
      'imobi.iafeoficial.com';

    // Se for o domínio principal ou subdomínio dele → não é custom
    const isPrimary =
      hostname === primaryHost || hostname.endsWith('.' + primaryHost);

    if (!hostname || isIp || isLocal || isPrimary) {
      setState({ loading: false, isCustomDomain: false, siteSlug: null, companyId: null, siteTitle: null });
      return;
    }

    // Custom domain candidate — resolve via RPC
    (async () => {
      try {
        const { data, error } = await supabase.rpc('resolve_custom_domain', { p_hostname: hostname });
        if (cancelled) return;
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!error && row && (row as any).is_published) {
          setState({
            loading: false,
            isCustomDomain: true,
            siteSlug: (row as any).site_slug ?? null,
            companyId: (row as any).company_id ?? null,
            siteTitle: (row as any).site_title ?? null,
          });
        } else {
          setState({ loading: false, isCustomDomain: false, siteSlug: null, companyId: null, siteTitle: null });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, isCustomDomain: false, siteSlug: null, companyId: null, siteTitle: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
