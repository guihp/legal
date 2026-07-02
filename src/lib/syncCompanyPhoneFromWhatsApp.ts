import { supabase } from '@/integrations/supabase/client';
import {
  normalizePhoneDigits,
  normalizePhoneForStorage,
} from '@/lib/normalizePhone';

function extractDigitsFromWhatsAppId(value: string | null | undefined): string {
  if (!value) return '';
  return normalizePhoneDigits(String(value).replace(/@s\.whatsapp\.net$/i, ''));
}

function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneForStorage(a);
  const db = normalizePhoneForStorage(b);
  return da !== '' && da === db;
}

/**
 * Atualiza companies.phone com o número conectado no WhatsApp (5519993022717).
 * Só grava se o número for válido e diferente do que já está cadastrado.
 */
export async function syncCompanyPhoneFromWhatsApp(
  rawPhone: string | null | undefined,
): Promise<boolean> {
  const storagePhone = normalizePhoneForStorage(extractDigitsFromWhatsAppId(rawPhone));
  if (normalizePhoneDigits(storagePhone).length < 12) return false;

  try {
    const { data: companyRows, error: readError } = await supabase.rpc('get_own_company');
    if (readError) throw readError;

    const currentPhone = (companyRows as { phone?: string | null }[] | null)?.[0]?.phone;
    if (phonesMatch(currentPhone || '', storagePhone)) return false;

    const { error } = await supabase.rpc('update_own_company', { p_phone: storagePhone });
    if (error) throw error;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('own-company-updated'));
    }

    return true;
  } catch (err) {
    console.warn('syncCompanyPhoneFromWhatsApp:', err);
    return false;
  }
}
