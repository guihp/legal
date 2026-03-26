-- Visitas ao site vitrine e landing pages (tráfego e origem)

CREATE TABLE IF NOT EXISTS public.public_site_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    page_type TEXT NOT NULL CHECK (page_type IN ('vitrine', 'landing')),
    path TEXT,
    referrer TEXT,
    referrer_kind TEXT NOT NULL DEFAULT 'other'
        CHECK (referrer_kind IN ('google', 'social', 'direct', 'referral', 'other')),
    utm_source TEXT,
    utm_medium TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT public_site_visits_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_public_site_visits_company_created
    ON public.public_site_visits (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_site_visits_company_kind
    ON public.public_site_visits (company_id, referrer_kind, created_at DESC);

ALTER TABLE public.public_site_visits ENABLE ROW LEVEL SECURITY;

-- Leitura apenas para usuários da mesma empresa
CREATE POLICY "public_site_visits_select_company"
    ON public.public_site_visits
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT up.company_id FROM public.user_profiles up WHERE up.id = auth.uid()
        )
    );

-- Inserção apenas via função SECURITY DEFINER (anon pode executar)

CREATE OR REPLACE FUNCTION public.log_public_site_visit(
    p_visit_kind TEXT,
    p_site_slug TEXT DEFAULT NULL,
    p_lp_slug TEXT DEFAULT NULL,
    p_path TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_referrer_kind TEXT DEFAULT 'other',
    p_utm_source TEXT DEFAULT NULL,
    p_utm_medium TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_kind TEXT;
BEGIN
    IF p_visit_kind NOT IN ('vitrine', 'landing') THEN
        RETURN;
    END IF;

    v_kind := lower(trim(p_referrer_kind));
    IF v_kind NOT IN ('google', 'social', 'direct', 'referral', 'other') THEN
        v_kind := 'other';
    END IF;

    IF p_visit_kind = 'vitrine' THEN
        IF p_site_slug IS NULL OR length(trim(p_site_slug)) = 0 THEN
            RETURN;
        END IF;
        SELECT cw.company_id INTO v_company_id
        FROM public.company_websites cw
        WHERE cw.slug = trim(p_site_slug)
          AND cw.is_published = true
        LIMIT 1;
    ELSE
        IF p_lp_slug IS NULL OR length(trim(p_lp_slug)) = 0 THEN
            RETURN;
        END IF;
        SELECT plp.company_id INTO v_company_id
        FROM public.property_landing_pages plp
        WHERE plp.slug = trim(p_lp_slug)
          AND plp.is_published = true
        LIMIT 1;
    END IF;

    IF v_company_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.public_site_visits (
        company_id,
        page_type,
        path,
        referrer,
        referrer_kind,
        utm_source,
        utm_medium
    )
    VALUES (
        v_company_id,
        p_visit_kind,
        NULLIF(trim(p_path), ''),
        NULLIF(trim(p_referrer), ''),
        v_kind,
        NULLIF(trim(p_utm_source), ''),
        NULLIF(trim(p_utm_medium), '')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_public_site_visit(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMENT ON TABLE public.public_site_visits IS 'Visitas às páginas públicas (vitrine/LP) para métricas no CRM';
