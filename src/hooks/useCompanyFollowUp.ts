import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  followUpLabelNameForDelay,
  followUpLabelSlugForDelay,
} from '@/lib/followUp';
import {
  normalizeAiLabelSlug,
  type AiLabelColor,
} from '@/lib/conversationContactLabels';

export type CompanyFollowUpSettings = {
  company_id: string;
  enabled: boolean;
  channel_whatsapp: boolean;
  channel_instagram: boolean;
};

export type CompanyFollowUpSchedule = {
  id: string;
  company_id: string;
  delay_minutes: number;
  is_system: boolean;
  enabled: boolean;
  label_slug: string;
  label_name: string;
  ai_description: string;
  sort_order: number;
};

const DEFAULT_SETTINGS = (companyId: string): CompanyFollowUpSettings => ({
  company_id: companyId,
  enabled: false,
  channel_whatsapp: true,
  channel_instagram: true,
});

export function useCompanyFollowUp() {
  const { profile, isManager } = useUserProfile();
  const companyId = profile?.company_id ?? null;
  const [settings, setSettings] = useState<CompanyFollowUpSettings | null>(null);
  const [schedules, setSchedules] = useState<CompanyFollowUpSchedule[]>([]);
  const [labelColors, setLabelColors] = useState<Record<string, AiLabelColor | string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setSettings(null);
      setSchedules([]);
      setLabelColors({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [settingsRes, schedulesRes, labelsRes] = await Promise.all([
        (supabase as any)
          .from('company_follow_up_settings')
          .select('company_id, enabled, channel_whatsapp, channel_instagram')
          .eq('company_id', companyId)
          .maybeSingle(),
        (supabase as any)
          .from('company_follow_up_schedules')
          .select(
            'id, company_id, delay_minutes, is_system, enabled, label_slug, label_name, ai_description, sort_order',
          )
          .eq('company_id', companyId)
          .order('delay_minutes', { ascending: true }),
        supabase
          .from('company_ai_labels')
          .select('slug, color')
          .eq('company_id', companyId)
          .like('slug', 'follow_up%'),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (schedulesRes.error) throw schedulesRes.error;

      setSettings(settingsRes.data || DEFAULT_SETTINGS(companyId));
      setSchedules((schedulesRes.data || []) as CompanyFollowUpSchedule[]);

      const colors: Record<string, string> = {};
      for (const row of labelsRes.data || []) {
        colors[row.slug] = row.color;
      }
      setLabelColors(colors);
    } catch (err) {
      console.error('useCompanyFollowUp:', err);
      setSettings(companyId ? DEFAULT_SETTINGS(companyId) : null);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = useCallback(
    async (patch: Partial<Omit<CompanyFollowUpSettings, 'company_id'>>) => {
      if (!companyId || !isManager) return;
      setSaving(true);
      try {
        const next = {
          ...(settings || DEFAULT_SETTINGS(companyId)),
          ...patch,
          company_id: companyId,
        };
        const { error } = await (supabase as any)
          .from('company_follow_up_settings')
          .upsert(next, { onConflict: 'company_id' });
        if (error) throw error;
        setSettings(next);
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, settings],
  );

  const updateSchedule = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<CompanyFollowUpSchedule, 'enabled' | 'ai_description' | 'delay_minutes' | 'label_name'>
      >,
    ) => {
      if (!companyId || !isManager) return;
      setSaving(true);
      try {
        const current = schedules.find((s) => s.id === id);
        if (!current) return;

        const nextDelay = patch.delay_minutes ?? current.delay_minutes;
        const nextSlug = current.is_system
          ? current.label_slug
          : followUpLabelSlugForDelay(nextDelay);
        const nextName = current.is_system
          ? current.label_name
          : patch.label_name || followUpLabelNameForDelay(nextDelay);

        const { error } = await (supabase as any)
          .from('company_follow_up_schedules')
          .update({
            enabled: patch.enabled ?? current.enabled,
            ai_description:
              patch.ai_description !== undefined ? patch.ai_description : current.ai_description,
            ...(current.is_system
              ? {}
              : {
                  delay_minutes: nextDelay,
                  label_slug: normalizeAiLabelSlug(nextSlug),
                  label_name: nextName,
                }),
          })
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
        await load();
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, schedules, load],
  );

  const createSchedule = useCallback(
    async (delayMinutes: number, aiDescription: string) => {
      if (!companyId || !isManager) return;
      if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) {
        throw new Error('Informe um atraso válido em minutos');
      }
      setSaving(true);
      try {
        const slug = normalizeAiLabelSlug(followUpLabelSlugForDelay(delayMinutes));
        const name = followUpLabelNameForDelay(delayMinutes);
        const { error } = await (supabase as any).from('company_follow_up_schedules').insert({
          company_id: companyId,
          delay_minutes: Math.round(delayMinutes),
          is_system: false,
          enabled: true,
          label_slug: slug,
          label_name: name,
          ai_description: aiDescription.trim(),
          sort_order: 100 + Math.round(delayMinutes),
        });
        if (error) throw error;
        await load();
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, load],
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      if (!companyId || !isManager) return;
      const row = schedules.find((s) => s.id === id);
      if (!row || row.is_system) throw new Error('Horário de sistema não pode ser excluído');
      setSaving(true);
      try {
        const { error } = await (supabase as any)
          .from('company_follow_up_schedules')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
        await load();
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager, schedules, load],
  );

  const updateLabelColor = useCallback(
    async (slug: string, color: AiLabelColor) => {
      if (!companyId || !isManager) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from('company_ai_labels')
          .update({ color })
          .eq('company_id', companyId)
          .eq('slug', slug);
        if (error) throw error;
        setLabelColors((prev) => ({ ...prev, [slug]: color }));
      } finally {
        setSaving(false);
      }
    },
    [companyId, isManager],
  );

  return {
    companyId,
    isManager,
    settings,
    schedules,
    labelColors,
    loading,
    saving,
    reload: load,
    saveSettings,
    updateSchedule,
    createSchedule,
    deleteSchedule,
    updateLabelColor,
  };
}
