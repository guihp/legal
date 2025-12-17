-- =====================================================
-- ÍNDICES PARA PERFORMANCE DO DASHBOARD
-- =====================================================
-- Data: 2025-08-25
-- Autor: Eng. Banco de Dados
-- Descrição: Índices otimizados para consultas do dashboard PAINEL
--            baseados nos agrupamentos e filtros utilizados no metrics.ts

-- =====================================================
-- TABELA: leads
-- =====================================================

-- Índice para filtros temporais (usado em todas as métricas de leads)
-- Suporta: WHERE created_at >= ? AND created_at <= ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at 
ON leads (created_at DESC);

-- Índice para agrupamento por canal de origem
-- Suporta: GROUP BY source + filtro temporal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_created_at 
ON leads (source, created_at DESC);

-- Índice para agrupamento por estágio do funil
-- Suporta: GROUP BY stage + filtro temporal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_stage_created_at 
ON leads (stage, created_at DESC);

-- Índice para consultas por corretor responsável
-- Suporta: WHERE id_corretor_responsavel = ? + filtro temporal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_corretor_created_at 
ON leads (id_corretor_responsavel, created_at DESC);

-- Índice para leads não atribuídos (NULL corretor)
-- Suporta: WHERE id_corretor_responsavel IS NULL + filtro temporal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_unassigned_created_at 
ON leads (created_at DESC) 
WHERE id_corretor_responsavel IS NULL;

-- Índice para imóveis de interesse (mais procurados)
-- Suporta: WHERE imovel_interesse IS NOT NULL AND imovel_interesse != '' + GROUP BY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_imovel_interesse_created_at 
ON leads (imovel_interesse, created_at DESC) 
WHERE imovel_interesse IS NOT NULL AND imovel_interesse != '';

-- =====================================================
-- TABELA: imoveisvivareal
-- =====================================================

-- Índice para agrupamento por tipo de imóvel
-- Suporta: GROUP BY tipo_imovel + filtro temporal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_imoveisvivareal_tipo_created_at 
ON imoveisvivareal (tipo_imovel, created_at DESC);

-- Índice para consultas de disponibilidade
-- Suporta: GROUP BY disponibilidade para taxa de ocupação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_imoveisvivareal_disponibilidade 
ON imoveisvivareal (disponibilidade);

-- Índice geral para filtros temporais em imóveis
-- Suporta: WHERE created_at >= ? AND created_at <= ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_imoveisvivareal_created_at 
ON imoveisvivareal (created_at DESC);

-- =====================================================
-- TABELA: whatsapp_messages (Heatmap de Conversas)
-- =====================================================

-- Índice composto para heatmap de conversas
-- Suporta: WHERE timestamp >= ? AND timestamp <= ? AND from_me = true + agrupamentos temporais
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_heatmap 
ON whatsapp_messages (timestamp DESC, from_me, instance_id);

-- Índice específico para mensagens enviadas pelos corretores
-- Suporta: WHERE from_me = true + filtros temporais + JOIN com instances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_outbound_timestamp 
ON whatsapp_messages (timestamp DESC, instance_id) 
WHERE from_me = true;

-- =====================================================
-- TABELA: imobipro_messages (Fallback para Heatmap)
-- =====================================================

-- Índice para heatmap alternativo (caso whatsapp_messages não exista)
-- Suporta: WHERE data >= ? AND data <= ? + GROUP BY temporal + instancia
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_imobipro_messages_heatmap 
ON imobipro_messages (data DESC, instancia);

-- =====================================================
-- TABELA: whatsapp_instances
-- =====================================================

-- Índice para JOIN com user_profiles (corretores disponíveis)
-- Suporta: JOIN whatsapp_instances.user_id = user_profiles.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_instances_user_id 
ON whatsapp_instances (user_id);

-- =====================================================
-- TABELA: user_profiles
-- =====================================================

-- Índice composto para busca de corretores ativos
-- Suporta: WHERE role = 'corretor' AND is_active = true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_corretor_active 
ON user_profiles (role, is_active, full_name) 
WHERE role = 'corretor' AND is_active = true;

-- Índice para ID lookup em JOINs
-- Suporta: JOIN leads.id_corretor_responsavel = user_profiles.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_id 
ON user_profiles (id);

-- =====================================================
-- TABELA: contracts (Para VGV - futuro)
-- =====================================================

-- Índice para métricas de VGV por período
-- Suporta: WHERE created_at >= ? AND created_at <= ? + GROUP BY temporal + SUM(valor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_created_at_valor 
ON contracts (created_at DESC, valor) 
WHERE status IN ('Ativo', 'Pendente');

-- Índice para agrupamento por status + valor
-- Suporta: WHERE status IN ('Ativo', 'Pendente') + agregações de valor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_status_valor_created_at 
ON contracts (status, created_at DESC, valor);

-- =====================================================
-- ÍNDICES COMPOSTOS PARA CONSULTAS COMPLEXAS
-- =====================================================

-- Índice para análise de performance de corretores
-- Suporta: Consultas que relacionam leads, corretor e período
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_performance_analysis 
ON leads (id_corretor_responsavel, created_at DESC, stage, source);

-- Índice para análise temporal completa de leads
-- Suporta: Consultas que precisam de agrupamento temporal + múltiplos filtros
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_temporal_analysis 
ON leads (created_at DESC, source, stage, id_corretor_responsavel);

-- =====================================================
-- COMENTÁRIOS E ESTIMATIVAS DE PERFORMANCE
-- =====================================================

/*
ESTIMATIVAS DE IMPACTO:

1. LEADS (tabela mais consultada):
   - idx_leads_created_at: Redução de 80-90% no tempo de filtros temporais
   - idx_leads_source_created_at: Otimização para agrupamento por canal
   - idx_leads_stage_created_at: Otimização para funil de vendas
   - idx_leads_corretor_created_at: Consultas por corretor 5-10x mais rápidas

2. IMOVEISVIVAREAL:
   - idx_imoveisvivareal_tipo_created_at: Distribuição por tipo otimizada
   - idx_imoveisvivareal_disponibilidade: Taxa de ocupação instantânea

3. MENSAGENS (Heatmap):
   - idx_whatsapp_messages_heatmap: Consultas de heatmap 10-20x mais rápidas
   - idx_imobipro_messages_heatmap: Fallback eficiente

4. USUARIOS:
   - idx_user_profiles_corretor_active: Lookup de corretores otimizado
   - Melhoria significativa em JOINs

TOTAL ESTIMADO: 60-80% redução no tempo de carregamento do dashboard
*/

-- =====================================================
-- MONITORAMENTO DE UTILIZAÇÃO
-- =====================================================

-- Para verificar uso dos índices (executar após implementação):
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY idx_tup_read DESC;
*/
