import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';

export type CompanyFeatureKey =
  | 'feature_clients_pipeline'
  | 'feature_clients_crm'
  | 'feature_connections';

export interface CompanyFeature {
  id: string;
  company_id: string;
  feature_key: CompanyFeatureKey | string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useCompanyFeatures() {
  const { profile } = useUserProfile();
  const [features, setFeatures] = useState<CompanyFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const featuresMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const f of features) map[f.feature_key] = !!f.is_enabled;
    return map;
  }, [features]);

  const isFeatureEnabled = (featureKey: CompanyFeatureKey | string): boolean => {
    // Por padrão, recurso desabilitado quando não houver registro
    return !!featuresMap[featureKey];
  };

  const loadCompanyFeatures = async () => {
    try {
      if (!profile?.company_id) {
        setFeatures([]);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('company_features')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('feature_key', { ascending: true });

      if (error) throw error;
      setFeatures(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar features';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const upsertFeature = async (
    featureKey: CompanyFeatureKey | string,
    enabled: boolean
  ): Promise<CompanyFeature | null> => {
    if (!profile?.company_id) return null;

    const payload = {
      company_id: profile.company_id,
      feature_key: featureKey,
      is_enabled: enabled,
    };

    const { data, error } = await supabase
      .from('company_features')
      .upsert(payload, { onConflict: 'company_id,feature_key' })
      .select('*')
      .single();

    if (error) throw error;
    // atualizar local
    setFeatures((prev) => {
      const idx = prev.findIndex(
        (f) => f.feature_key === featureKey && f.company_id === profile.company_id
      );
      if (idx >= 0) {
        const clone = prev.slice();
        clone[idx] = data as CompanyFeature;
        return clone;
      }
      return [...prev, data as CompanyFeature];
    });
    return data as CompanyFeature;
  };

  useEffect(() => {
    loadCompanyFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  return {
    features,
    featuresMap,
    loading,
    error,
    isFeatureEnabled,
    refresh: loadCompanyFeatures,
    updateFeature: upsertFeature,
  };
}



