import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  normalizeAiLabelSlug,
  SYSTEM_AI_LABELS_FALLBACK,
  type AiLabelColor,
  type CompanyAiLabel,
} from '@/lib/conversationContactLabels';

type UpsertInput = {
  id?: string;
  name: string;
  slug?: string;
  color: AiLabelColor | string;
  sort_order?: number;
};

export function useCompanyAiLabels() {
  const { profile, isManager } = useUserProfile();
  const [labels, setLabels] = useState<CompanyAiLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.company_id ?? null;

  const loadLabels = useCallback(async () => {
    if (!companyId) {
      setLabels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: qError } = await supabase
        .from('company_ai_labels')
        .select('id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (qError) throw qError;

      if (data?.length) {
        setLabels(data as CompanyAiLabel[]);
      } else {
        // Seed ainda não visível / empresa nova: fallback local
        setLabels(
          SYSTEM_AI_LABELS_FALLBACK.map((l, i) => ({
            id: `fallback-${l.slug}`,
            company_id: companyId,
            ...l,
            created_at: undefined,
            updated_at: undefined,
            sort_order: l.sort_order ?? (i + 1) * 10,
          })),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar etiquetas';
      console.error('useCompanyAiLabels:', err);
      setError(msg);
      setLabels(
        SYSTEM_AI_LABELS_FALLBACK.map((l, i) => ({
          id: `fallback-${l.slug}`,
          company_id: companyId,
          ...l,
          sort_order: l.sort_order ?? (i + 1) * 10,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadLabels();
  }, [loadLabels]);

  const upsertLabel = useCallback(
    async (input: UpsertInput): Promise<CompanyAiLabel | null> => {
      if (!companyId || !isManager) return null;
      const name = input.name.trim();
      const slug = normalizeAiLabelSlug(input.slug || name);
      if (!name || !slug) throw new Error('Nome/slug inválido');

      setSaving(true);
      try {
        if (input.id && !input.id.startsWith('fallback-')) {
          const { data: existing } = await supabase
            .from('company_ai_labels')
            .select('is_system, slug, name')
            .eq('id', input.id)
            .eq('company_id', companyId)
            .maybeSingle();

          // Sistema: só cor (e sort_order opcional). Nome/slug fixos.
          const patch: Record<string, unknown> = existing?.is_system
            ? {
                color: input.color,
                ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
              }
            : {
                name,
                color: input.color,
                slug,
                sort_order: input.sort_order ?? 100,
              };

          const { data, error: uError } = await supabase
            .from('company_ai_labels')
            .update(patch)
            .eq('id', input.id)
            .eq('company_id', companyId)
            .select('id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at')
            .single();

          if (uError) throw uError;
          await loadLabels();
          return data as CompanyAiLabel;
        }

        const { data, error: iError } = await supabase
          .from('company_ai_labels')
          .insert({
            company_id: companyId,
            name,
            slug,
            color: input.color,
            is_system: false,
            sort_order: input.sort_order ?? 100,
          })
          .select('id, company_id, slug, name, color, is_system, sort_order, created_at, updated_at')
          .single();

        if (iError) throw iError;
        await loadLabels();
        return data as CompanyAiLabel;
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, loadLabels],
  );

  const deleteLabel = useCallback(
    async (id: string): Promise<boolean> => {
      if (!companyId || !isManager || id.startsWith('fallback-')) return false;
      setSaving(true);
      try {
        const { error: dError } = await supabase
          .from('company_ai_labels')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);
        if (dError) throw dError;
        await loadLabels();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, loadLabels],
  );

  return {
    labels,
    loading,
    saving,
    error,
    isManager,
    companyId,
    reload: loadLabels,
    upsertLabel,
    deleteLabel,
  };
}
