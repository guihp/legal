-- Permite leitura anônima limitada de companies e company_settings para páginas públicas
-- (site vitrine ou LP publicada), necessário para rodapé e nome da imobiliária.

DROP POLICY IF EXISTS "companies_select_public_marketing" ON public.companies;
DROP POLICY IF EXISTS "company_settings_select_public_marketing" ON public.company_settings;

CREATE POLICY "companies_select_public_marketing"
    ON public.companies
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.company_websites cw
            WHERE cw.company_id = companies.id AND cw.is_published = true
        )
        OR EXISTS (
            SELECT 1 FROM public.property_landing_pages plp
            WHERE plp.company_id = companies.id AND plp.is_published = true
        )
    );

CREATE POLICY "company_settings_select_public_marketing"
    ON public.company_settings
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.company_websites cw
            WHERE cw.company_id = company_settings.company_id AND cw.is_published = true
        )
        OR EXISTS (
            SELECT 1 FROM public.property_landing_pages plp
            WHERE plp.company_id = company_settings.company_id AND plp.is_published = true
        )
    );
