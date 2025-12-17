import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/audit/logger';

export type DatabaseProperty = Tables<'properties'>;
export type DatabasePropertyImage = Tables<'property_images'>;
export type PropertyInsert = TablesInsert<'properties'>;
export type PropertyUpdate = TablesUpdate<'properties'>;

export interface PropertyWithImages extends DatabaseProperty {
  property_images: DatabasePropertyImage[];
}

export function useProperties() {
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionsRef = useRef<{ properties: any; images: any }>({ properties: null, images: null });
  const isSubscribedRef = useRef(false);

  const fetchProperties = async () => {
    try {
      console.log('🔍 Iniciando busca de propriedades...');
      setLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          property_images!property_images_property_id_fkey (*)
        `)
        .order('created_at', { ascending: false });

      console.log('📊 Resposta do Supabase:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao buscar propriedades:', error);
        throw error;
      }
      
      console.log('✅ Propriedades carregadas:', data?.length || 0);
      setProperties(data || []);
      setError(null);
    } catch (err) {
      console.error('💥 Erro na função fetchProperties:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar propriedades');
    } finally {
      setLoading(false);
    }
  };

  const createProperty = async (propertyData: Omit<PropertyInsert, 'user_id'>): Promise<DatabaseProperty | null> => {
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('🏠 Criando propriedade:', propertyData);
      const { data, error } = await supabase
        .from('properties')
        .insert([{ ...propertyData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Propriedade criada:', data);
      // Refetch para atualizar com imagens
      await fetchProperties();
      // Audit
      try { await logAudit({ action: 'property.created', resource: 'property', resourceId: (data as any)?.id, meta: { title: (data as any)?.title, price: (data as any)?.price } }); } catch {}
      return data;
    } catch (err) {
      console.error('❌ Erro ao criar propriedade:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar propriedade');
      return null;
    }
  };

  const updateProperty = async (id: string, updates: PropertyUpdate): Promise<DatabaseProperty | null> => {
    try {
      console.log('✏️ Atualizando propriedade:', id, updates);
      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Propriedade atualizada:', data);
      // Refetch para atualizar com imagens
      await fetchProperties();
      // Audit
      try { await logAudit({ action: 'property.updated', resource: 'property', resourceId: (data as any)?.id, meta: updates }); } catch {}
      return data;
    } catch (err) {
      console.error('❌ Erro ao atualizar propriedade:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar propriedade');
      return null;
    }
  };

  const deleteProperty = async (id: string): Promise<boolean> => {
    try {
      console.log('🗑️ Deletando propriedade:', id);
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Propriedade deletada');
      // Atualizar lista local
      setProperties(prev => prev.filter(prop => prop.id !== id));
      // Audit
      try { await logAudit({ action: 'property.deleted', resource: 'property', resourceId: id, meta: null }); } catch {}
      return true;
    } catch (err) {
      console.error('❌ Erro ao deletar propriedade:', err);
      setError(err instanceof Error ? err.message : 'Erro ao deletar propriedade');
      return false;
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  // Separar subscription do real-time para evitar re-subscriptions
  useEffect(() => {
    // Verificar se já temos subscriptions ativas
    if (isSubscribedRef.current) {
      console.log('🔄 Subscriptions já ativas, pulando...');
      return;
    }

    // Configurar real-time updates para a tabela properties
    console.log('🔄 Configurando real-time updates para propriedades...');
    
    // Criar canais com nomes únicos usando timestamp e random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const propertiesChannelName = `properties-changes-${timestamp}-${random}`;
          const imagesChannelName = `property_images-changes-${timestamp}-${random}`;
    
    try {
      const propertiesChannel = supabase
        .channel(propertiesChannelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'properties'
          },
          (payload) => {
            console.log('🔔 Mudança detectada na tabela properties:', payload);
            
            if (payload.eventType === 'INSERT') {
              console.log('➕ Nova propriedade adicionada:', payload.new);
              fetchProperties();
            } else if (payload.eventType === 'UPDATE') {
              console.log('✏️ Propriedade atualizada:', payload.new);
              fetchProperties();
            } else if (payload.eventType === 'DELETE') {
              console.log('🗑️ Propriedade removida:', payload.old);
              setProperties(prev => prev.filter(p => p.id !== payload.old.id));
            }
          }
        );

      // Configurar real-time updates para a tabela property_images
      const imagesChannel = supabase
        .channel(imagesChannelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'property_images'
          },
          (payload) => {
            console.log('🔔 Mudança detectada na tabela property_images:', payload);
            fetchProperties();
          }
        );

      // Salvar referências
      subscriptionsRef.current.properties = propertiesChannel;
      subscriptionsRef.current.images = imagesChannel;

      // Subscribe aos canais
      propertiesChannel.subscribe((status: string) => {
        console.log(`🔗 Status subscription properties: ${status}`);
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        }
      });
      
      imagesChannel.subscribe((status: string) => {
        console.log(`🔗 Status subscription images: ${status}`);
      });
    } catch (error) {
      console.error('❌ Erro ao configurar subscriptions:', error);
    }

    // Cleanup na desmontagem do componente
    return () => {
      console.log('🧹 Limpando subscriptions do real-time...');
      try {
        if (subscriptionsRef.current.properties) {
          supabase.removeChannel(subscriptionsRef.current.properties);
          subscriptionsRef.current.properties = null;
        }
        if (subscriptionsRef.current.images) {
          supabase.removeChannel(subscriptionsRef.current.images);
          subscriptionsRef.current.images = null;
        }
        isSubscribedRef.current = false;
      } catch (error) {
        console.error('❌ Erro ao limpar subscriptions:', error);
      }
    };
  }, []); // Array vazio para executar apenas uma vez

  return { 
    properties, 
    loading, 
    error, 
    refetch: fetchProperties,
    createProperty,
    updateProperty,
    deleteProperty
  };
}
