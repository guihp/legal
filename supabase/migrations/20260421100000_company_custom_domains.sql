-- Domínios customizados para o site vitrine
-- Permite que cada imobiliária aponte o próprio domínio (ex: site.jastelo.com.br)
-- pro seu site vitrine, ficando white-label.

CREATE TABLE IF NOT EXISTS public.company_custom_domains (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    -- 'pending'      : cadastrado, aguardando cliente configurar DNS
    -- 'verifying'    : DNS foi verificado, aguardando SSL
    -- 'verified'     : DNS + TXT corretos, site servindo
    -- 'active'       : SSL ativo (alias de verified, para claridade)
    -- 'failed'       : última verificação falhou
    -- 'disabled'     : usuário desabilitou
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','verifying','verified','active','failed','disabled')),
    -- Token único pra TXT record _iafe-verify.{hostname}
    verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    -- CNAME/A alvo mostrado ao cliente (sempre aponta pro hostname principal do app)
    target_cname TEXT,
    verified_at TIMESTAMPTZ,
    ssl_issued_at TIMESTAMPTZ,
    last_check_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT company_custom_domains_pkey PRIMARY KEY (id),
    CONSTRAINT company_custom_domains_hostname_unique UNIQUE (hostname),
    CONSTRAINT company_custom_domains_hostname_format CHECK (
        hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
        AND length(hostname) BETWEEN 4 AND 253
    )
);

CREATE INDEX IF NOT EXISTS idx_company_custom_domains_company
    ON public.company_custom_domains (company_id);

CREATE INDEX IF NOT EXISTS idx_company_custom_domains_hostname_status
    ON public.company_custom_domains (hostname) WHERE status IN ('verified', 'active');

-- Trigger pra atualizar updated_at
CREATE OR REPLACE FUNCTION public._touch_company_custom_domains()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_company_custom_domains ON public.company_custom_domains;
CREATE TRIGGER trg_touch_company_custom_domains
    BEFORE UPDATE ON public.company_custom_domains
    FOR EACH ROW EXECUTE FUNCTION public._touch_company_custom_domains();

-- Trigger pra normalizar hostname (lowercase, trim)
CREATE OR REPLACE FUNCTION public._normalize_company_custom_domain_hostname()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.hostname = lower(trim(NEW.hostname));
    -- Remove "http://" ou "https://" caso tenha entrado por engano
    NEW.hostname = regexp_replace(NEW.hostname, '^https?://', '');
    -- Remove "/" final
    NEW.hostname = regexp_replace(NEW.hostname, '/+$', '');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_company_custom_domain_hostname ON public.company_custom_domains;
CREATE TRIGGER trg_normalize_company_custom_domain_hostname
    BEFORE INSERT OR UPDATE OF hostname ON public.company_custom_domains
    FOR EACH ROW EXECUTE FUNCTION public._normalize_company_custom_domain_hostname();

-- RLS: cada empresa só vê/edita os próprios domínios
ALTER TABLE public.company_custom_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_domains_select_company" ON public.company_custom_domains;
CREATE POLICY "custom_domains_select_company"
    ON public.company_custom_domains
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "custom_domains_insert_company" ON public.company_custom_domains;
CREATE POLICY "custom_domains_insert_company"
    ON public.company_custom_domains
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "custom_domains_update_company" ON public.company_custom_domains;
CREATE POLICY "custom_domains_update_company"
    ON public.company_custom_domains
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (
            SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "custom_domains_delete_company" ON public.company_custom_domains;
CREATE POLICY "custom_domains_delete_company"
    ON public.company_custom_domains
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (
            SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
        )
    );

-- Super admin enxerga tudo
DROP POLICY IF EXISTS "custom_domains_super_admin_all" ON public.company_custom_domains;
CREATE POLICY "custom_domains_super_admin_all"
    ON public.company_custom_domains
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin'));

-- =========================================================
-- RPC pública (anon): resolve hostname → slug do site
-- Usada pelo App.tsx no carregamento pra saber se o host atual
-- corresponde a um domínio custom de alguma empresa.
-- Só retorna domínios VERIFICADOS e site PUBLICADO.
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_custom_domain(p_hostname TEXT)
RETURNS TABLE(
    company_id UUID,
    site_slug TEXT,
    site_title TEXT,
    is_published BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        cw.company_id,
        cw.slug AS site_slug,
        cw.title AS site_title,
        cw.is_published
    FROM public.company_custom_domains ccd
    INNER JOIN public.company_websites cw ON cw.company_id = ccd.company_id
    WHERE ccd.hostname = lower(trim(p_hostname))
      AND ccd.status IN ('verified','active')
      AND cw.is_published = true
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_custom_domain(TEXT) TO anon, authenticated;

-- =========================================================
-- RPC interna (só super_admin / edge function): marcar como verificado
-- Chamada pelo edge function verify-custom-domain após conferir o DNS.
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_custom_domain_verified(
    p_domain_id UUID,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_success THEN
        UPDATE public.company_custom_domains
        SET status = 'verified',
            verified_at = COALESCE(verified_at, now()),
            last_check_at = now(),
            last_error = NULL
        WHERE id = p_domain_id;
    ELSE
        UPDATE public.company_custom_domains
        SET status = CASE
            WHEN status IN ('verified','active') THEN status  -- já estava ok, não degrada
            ELSE 'failed'
        END,
            last_check_at = now(),
            last_error = p_error
        WHERE id = p_domain_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_custom_domain_verified(UUID, BOOLEAN, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_custom_domain_verified(UUID, BOOLEAN, TEXT) TO service_role;

COMMENT ON TABLE public.company_custom_domains IS 'Domínios próprios apontados pelas imobiliárias pro site vitrine (white-label)';
COMMENT ON COLUMN public.company_custom_domains.verification_token IS 'Token pra DNS TXT _iafe-verify.{hostname} validar posse do domínio';
COMMENT ON COLUMN public.company_custom_domains.target_cname IS 'Hostname que o cliente aponta o CNAME (ex: sites.iafeoficial.com)';
