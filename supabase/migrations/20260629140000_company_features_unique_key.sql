-- Garante upsert por empresa + feature (ex.: ai_assistant_enabled)
CREATE UNIQUE INDEX IF NOT EXISTS company_features_company_id_feature_key_uidx
  ON public.company_features (company_id, feature_key);
