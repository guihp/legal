import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';

export type AuditAction =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.stage_changed'
  | 'leads.bulk_assign'
  | 'property.created'
  | 'property.updated'
  | 'property.deleted'
  | 'property.images_uploaded'
  | 'property.images_removed'
  | 'property.availability_changed'
  | 'property.xml_imported'
  | 'property.viewed'
  | 'contract.created'
  | 'contract.updated'
  | 'contract.deleted'
  | 'whatsapp.message_sent'
  | 'whatsapp.chat_created'
  | 'whatsapp.instance_created'
  | 'whatsapp.instance_status_updated'
  | 'whatsapp.instance_connected'
  | 'whatsapp.instance_disconnected'
  | 'whatsapp.instance_qr_generated'
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.profile_updated'
  | 'user.deactivated'
  | 'user.activated'
  | 'user.deleted'
  | 'permissions.updated'
  | 'bulk_whatsapp.started'
  | 'bulk_whatsapp.finished'
  | 'agenda.event_created'
  | 'dispatch_configurations.list'
  | 'dispatch_configurations.create'
  | 'dispatch_configurations.update'
  | 'dispatch_configurations.delete'
  | 'system.test';

export interface AuditMeta {
  [key: string]: any;
}

export async function logAudit(
  params: { action: AuditAction; resource: string; resourceId?: string | null; meta?: AuditMeta }
) {
  try {
    // Obter dados do usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      console.warn('logAudit: Usuário não autenticado, ignorando log');
      return;
    }

    // Tentar obter company_id do perfil do usuário
    let companyId: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      companyId = profile?.company_id || null;
    } catch (profileError) {
      console.warn('logAudit: Erro ao obter company_id do perfil:', profileError);
    }

    // Inserir o log de auditoria
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      meta: { 
        ...(params.meta || {}),
        company_id: companyId // Mover company_id para meta para evitar problemas de schema
      },
    });

    if (error) {
      console.warn('logAudit: Falha ao registrar audit log:', error.message, {
        action: params.action,
        resource: params.resource,
        user_id: user.id,
        company_id: companyId
      });
    } else {
      console.log('✅ logAudit: Log registrado com sucesso:', params.action);
    }
  } catch (e) {
    console.warn('logAudit: Erro inesperado ao registrar audit log:', (e as any)?.message || e);
  }
}


