import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit/logger';

export interface ImovelVivaReal {
  id: number;
  listing_id: string | null;
  imagens: string[] | null;
  tipo_categoria: string | null;
  tipo_imovel: string | null;
  descricao: string | null;
  preco: number | null;
  tamanho_m2: number | null;
  quartos: number | null;
  banheiros: number | null;
  ano_construcao: number | null;
  suite: number | null;
  garagem: number | null;
  features: string[] | null;
  andar: number | null;
  blocos: number | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  user_id: string | null;
  company_id: string | null;
  modalidade: string | null;
  disponibilidade: 'disponivel' | 'indisponivel' | 'reforma';
  disponibilidade_observacao: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ImoveisOrderBy = { column: 'created_at' | 'preco' | 'tamanho_m2'; ascending: boolean };

export interface ImoveisFilters {
  search?: string;
  listingId?: string;
  tipoCategoria?: string[]; // modalidade/finalidade
  tipoImovel?: string[];
  preco?: { min?: number; max?: number };
  tamanho?: { min?: number; max?: number };
  quartos?: { min?: number; max?: number };
  banheiros?: { min?: number; max?: number };
  suite?: { min?: number; max?: number };
  garagem?: { min?: number; max?: number };
  andar?: { min?: number; max?: number };
  anoConstrucao?: { min?: number; max?: number };
  cidade?: string;
  bairro?: string;
  endereco?: string;
  cep?: string;
}

export function useImoveisVivaReal(initial?: {
  page?: number;
  pageSize?: 12 | 24 | 50 | 100;
  orderBy?: ImoveisOrderBy;
  filters?: ImoveisFilters;
}) {
  const [imoveis, setImoveis] = useState<ImovelVivaReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initial?.page ?? 1);
  const [pageSize, setPageSize] = useState<12 | 24 | 50 | 100>(initial?.pageSize ?? 12);
  const [orderBy, setOrderBy] = useState<ImoveisOrderBy>(initial?.orderBy ?? { column: 'created_at', ascending: false });
  const [filters, setFilters] = useState<ImoveisFilters>(initial?.filters ?? {});
  const [total, setTotal] = useState<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  const from = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const to = useMemo(() => from + pageSize - 1, [from, pageSize]);

  const refetch = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('imoveisvivareal')
        .select('*', { count: 'exact' });

      if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim();
        query = query.or(
          `descricao.ilike.%${term}%,cidade.ilike.%${term}%,bairro.ilike.%${term}%,endereco.ilike.%${term}%,listing_id.ilike.%${term}%`
        );
      }

      if (filters.listingId && filters.listingId.trim().length > 0) {
        query = query.ilike('listing_id', `%${filters.listingId.trim()}%`);
      }
      if (filters.tipoCategoria && filters.tipoCategoria.length > 0) {
        query = query.in('tipo_categoria', filters.tipoCategoria);
      }
      if (filters.tipoImovel && filters.tipoImovel.length > 0) {
        query = query.in('tipo_imovel', filters.tipoImovel);
      }

      const rangeFilter = (
        field: keyof ImovelVivaReal,
        range?: { min?: number; max?: number }
      ) => {
        if (!range) return;
        if (typeof range.min === 'number') query = query.gte(field as string, range.min);
        if (typeof range.max === 'number') query = query.lte(field as string, range.max);
      };
      rangeFilter('preco', filters.preco);
      rangeFilter('tamanho_m2', filters.tamanho);
      rangeFilter('quartos', filters.quartos);
      rangeFilter('banheiros', filters.banheiros);
      rangeFilter('suite', filters.suite);
      rangeFilter('garagem', filters.garagem);
      rangeFilter('andar', filters.andar);
      // ano_construcao
      if (filters.anoConstrucao) {
        if (typeof filters.anoConstrucao.min === 'number') query = query.gte('ano_construcao', filters.anoConstrucao.min);
        if (typeof filters.anoConstrucao.max === 'number') query = query.lte('ano_construcao', filters.anoConstrucao.max);
      }

      if (filters.cidade && filters.cidade.trim()) {
        query = query.ilike('cidade', `%${filters.cidade.trim()}%`);
      }
      if (filters.bairro && filters.bairro.trim()) {
        query = query.ilike('bairro', `%${filters.bairro.trim()}%`);
      }
      if (filters.endereco && filters.endereco.trim()) {
        query = query.ilike('endereco', `%${filters.endereco.trim()}%`);
      }
      if (filters.cep && filters.cep.trim()) {
        query = query.ilike('cep', `%${filters.cep.trim()}%`);
      }

      // Ordenação
      query = query.order(orderBy.column, { ascending: orderBy.ascending });

      // Paginação
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setImoveis((data as ImovelVivaReal[]) ?? []);
      setTotal(count ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imóveis');
    } finally {
      setLoading(false);
    }
  };

  const createImovel = async (novo: Omit<ImovelVivaReal, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'company_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error: insertError } = await supabase
        .from('imoveisvivareal')
        .insert([{ ...novo, user_id: user.id }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Log de auditoria
      try {
        await logAudit({
          action: 'property.created',
          resource: 'imovel_vivareal',
          resourceId: data.id?.toString(),
          meta: {
            listing_id: data.listing_id,
            tipo_imovel: data.tipo_imovel,
            cidade: data.cidade,
            bairro: data.bairro,
            preco: data.preco
          }
        });
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      await refetch();
      return data as ImovelVivaReal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar imóvel');
      return null;
    }
  };

  const updateImovel = async (id: number, updates: Partial<ImovelVivaReal>) => {
    try {
      const { error: updateError } = await supabase
        .from('imoveisvivareal')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      // Buscar o registro atualizado separadamente se necessário
      const { data } = await supabase
        .from('imoveisvivareal')
        .select('id, listing_id, tipo_imovel, cidade, bairro, disponibilidade, disponibilidade_observacao')
        .eq('id', id)
        .single();

      // Log de auditoria
      try {
        const action = updates.disponibilidade ? 'property.availability_changed' : 'property.updated';
        await logAudit({
          action,
          resource: 'imovel_vivareal',
          resourceId: id.toString(),
          meta: {
            updated_fields: Object.keys(updates),
            listing_id: data.listing_id,
            tipo_imovel: data.tipo_imovel,
            cidade: data.cidade,
            bairro: data.bairro,
            ...(updates.disponibilidade && {
              new_availability: updates.disponibilidade,
              availability_note: updates.disponibilidade_observacao
            })
          }
        });
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      await refetch();
      return data as ImovelVivaReal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar imóvel');
      return null;
    }
  };

  const deleteImovel = async (id: number) => {
    try {
      // Buscar dados do imóvel antes de deletar para o log
      const { data: imovelData } = await supabase
        .from('imoveisvivareal')
        .select('listing_id, tipo_imovel, cidade, bairro, preco')
        .eq('id', id)
        .single();

      const { error: deleteError } = await supabase
        .from('imoveisvivareal')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Log de auditoria
      try {
        await logAudit({
          action: 'property.deleted',
          resource: 'imovel_vivareal',
          resourceId: id.toString(),
          meta: {
            listing_id: imovelData?.listing_id,
            tipo_imovel: imovelData?.tipo_imovel,
            cidade: imovelData?.cidade,
            bairro: imovelData?.bairro,
            preco: imovelData?.preco
          }
        });
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      setImoveis(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar imóvel');
      return false;
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, orderBy.column, orderBy.ascending, JSON.stringify(filters)]);

  useEffect(() => {
    if (subscribedRef.current) return;

    const channel = supabase
      .channel(`imoveisvivareal-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imoveisvivareal' },
        () => refetch()
      );

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedRef.current = false;
      }
    };
  }, []);

  return {
    imoveis,
    loading,
    error,
    refetch,
    createImovel,
    updateImovel,
    deleteImovel,
    page,
    setPage,
    pageSize,
    setPageSize,
    orderBy,
    setOrderBy,
    filters,
    setFilters,
    total,
  };
}

// Sugestões (autocomplete) — utilitários
export async function suggestCities(q: string): Promise<string[]> {
  const term = q.trim();
  let query = supabase.from('imoveisvivareal').select('cidade');
  if (term) query = query.ilike('cidade', `%${term}%`);
  const { data, error } = await query.neq('cidade', null).limit(25);
  if (error) return [];
  const values = (data as any[]).map(r => r.cidade).filter(Boolean);
  return Array.from(new Set(values)).slice(0, 10);
}

export async function suggestNeighborhoods(city: string, q: string): Promise<string[]> {
  const term = q.trim();
  let query = supabase.from('imoveisvivareal').select('bairro');
  if (city.trim()) query = query.ilike('cidade', `%${city.trim()}%`);
  if (term) query = query.ilike('bairro', `%${term}%`);
  const { data, error } = await query.neq('bairro', null).limit(25);
  if (error) return [];
  const values = (data as any[]).map(r => r.bairro).filter(Boolean);
  return Array.from(new Set(values)).slice(0, 10);
}

export async function suggestAddresses(q: string): Promise<string[]> {
  const term = q.trim();
  let query = supabase.from('imoveisvivareal').select('endereco');
  if (term) query = query.ilike('endereco', `%${term}%`);
  const { data, error } = await query.neq('endereco', null).limit(25);
  if (error) return [];
  const values = (data as any[]).map(r => r.endereco).filter(Boolean);
  return Array.from(new Set(values)).slice(0, 10);
}

// Sugestões globais para a barra de pesquisa (mistura de campos)
export async function suggestSearch(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const results: string[] = [];
  // Buscar possíveis correspondências em listing_id, endereco, cidade, bairro (limitado)
  const [{ data: a }, { data: b }, { data: c }, { data: d }] = await Promise.all([
    supabase.from('imoveisvivareal').select('listing_id').ilike('listing_id', `%${term}%`).limit(10),
    supabase.from('imoveisvivareal').select('endereco').ilike('endereco', `%${term}%`).limit(10),
    supabase.from('imoveisvivareal').select('cidade').ilike('cidade', `%${term}%`).limit(10),
    supabase.from('imoveisvivareal').select('bairro').ilike('bairro', `%${term}%`).limit(10),
  ]);
  for (const row of (a || [])) if (row.listing_id) results.push(String(row.listing_id));
  for (const row of (b || [])) if (row.endereco) results.push(String(row.endereco));
  for (const row of (c || [])) if (row.cidade) results.push(String(row.cidade));
  for (const row of (d || [])) if (row.bairro) results.push(String(row.bairro));
  return Array.from(new Set(results)).slice(0, 10);
}


