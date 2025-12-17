-- Complete Remote Schema Migration
-- Generated on 2025-01-25 19:39:01
-- This migration contains the complete schema state from the remote database

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    actor_id UUID,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Companies table
CREATE TABLE public.companies (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    cnpj TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    max_users INTEGER DEFAULT 10,
    plan TEXT DEFAULT 'basic'::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Company features table
CREATE TABLE public.company_features (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    feature_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company settings table
CREATE TABLE public.company_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    display_name TEXT NOT NULL DEFAULT 'ImobiPro'::text,
    display_subtitle TEXT NOT NULL DEFAULT 'Gestão Imobiliária'::text,
    logo_url TEXT,
    theme TEXT NOT NULL DEFAULT 'dark'::text,
    primary_color TEXT NOT NULL DEFAULT '#3B82F6'::text,
    language TEXT NOT NULL DEFAULT 'pt-BR'::text,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'::text,
    company_name_font_family TEXT NOT NULL DEFAULT 'Inter'::text,
    company_name_font_size INTEGER NOT NULL DEFAULT 20,
    company_name_color TEXT NOT NULL DEFAULT '#FFFFFF'::text,
    company_name_bold BOOLEAN NOT NULL DEFAULT false,
    company_subtitle_font_family TEXT NOT NULL DEFAULT 'Inter'::text,
    company_subtitle_font_size INTEGER NOT NULL DEFAULT 12,
    company_subtitle_color TEXT NOT NULL DEFAULT '#9CA3AF'::text,
    company_subtitle_bold BOOLEAN NOT NULL DEFAULT false,
    logo_size INTEGER NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contract templates table
CREATE TABLE public.contract_templates (
    id TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    name TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    template_type TEXT DEFAULT 'Locação'::text,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    user_id UUID,
    company_id UUID
);

-- Contracts table
CREATE TABLE public.contracts (
    id TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    numero TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente'::text,
    client_id TEXT,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    client_cpf TEXT,
    client_address TEXT,
    client_nationality TEXT,
    client_marital_status TEXT,
    landlord_name TEXT,
    landlord_email TEXT,
    landlord_phone TEXT,
    landlord_cpf TEXT,
    landlord_address TEXT,
    landlord_nationality TEXT,
    landlord_marital_status TEXT,
    guarantor_name TEXT,
    guarantor_email TEXT,
    guarantor_phone TEXT,
    guarantor_cpf TEXT,
    guarantor_address TEXT,
    guarantor_nationality TEXT,
    guarantor_marital_status TEXT,
    property_title TEXT NOT NULL,
    property_address TEXT NOT NULL,
    property_type TEXT,
    property_area NUMERIC(10,2),
    property_city TEXT,
    property_state TEXT,
    property_zip_code TEXT,
    template_id TEXT,
    template_name TEXT NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    data_assinatura DATE,
    proximo_vencimento DATE,
    contract_duration TEXT,
    payment_day TEXT,
    payment_method TEXT,
    contract_city TEXT,
    contract_file_path TEXT,
    contract_file_name TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Dispatch configurations table
CREATE TABLE public.dispatch_configurations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID,
    company_id UUID,
    assigned_brokers JSONB DEFAULT '[]'::jsonb,
    broker_assignment_strategy TEXT DEFAULT 'round_robin'::text,
    time_windows JSONB DEFAULT '{}'::jsonb,
    interval_between_messages INTEGER DEFAULT 150,
    max_messages_per_hour INTEGER DEFAULT 100,
    message_template TEXT NOT NULL DEFAULT 'Olá {nome}, tudo bem?'::text,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequences for integer ID tables
CREATE SEQUENCE IF NOT EXISTS imobipro_messages1_id_seq;
CREATE SEQUENCE IF NOT EXISTS imoveisvivareal_id_seq;

-- ImobiPro messages table
CREATE TABLE public.imobipro_messages (
    id INTEGER NOT NULL DEFAULT nextval('imobipro_messages1_id_seq'::regclass),
    session_id VARCHAR(255) NOT NULL,
    message JSONB NOT NULL,
    data TIMESTAMP DEFAULT now(),
    media TEXT,
    instancia TEXT DEFAULT 'sdr'::text
);

-- Imoveis VivaReal table
CREATE TABLE public.imoveisvivareal (
    id INTEGER NOT NULL DEFAULT nextval('imoveisvivareal_id_seq'::regclass),
    listing_id TEXT,
    imagens TEXT[],
    tipo_categoria TEXT,
    tipo_imovel TEXT,
    descricao TEXT,
    preco NUMERIC(12,2),
    tamanho_m2 NUMERIC(10,2),
    quartos INTEGER,
    banheiros INTEGER,
    ano_construcao INTEGER,
    suite INTEGER,
    garagem INTEGER,
    features TEXT[],
    andar INTEGER,
    blocos INTEGER,
    cidade TEXT,
    bairro TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    cep TEXT,
    user_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    modalidade TEXT,
    disponibilidade TEXT DEFAULT 'disponivel'::text,
    disponibilidade_observacao TEXT
);

-- Inquilinato conversations table
CREATE TABLE public.inquilinato_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Inquilinato messages table
CREATE TABLE public.inquilinato_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID,
    conversation_id UUID,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads table
CREATE TABLE public.leads (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    stage TEXT DEFAULT 'Novo Lead'::text,
    interest TEXT DEFAULT ''::text,
    estimated_value NUMERIC(12,2) DEFAULT 0,
    notes TEXT DEFAULT ''::text,
    updated_at TIMESTAMPTZ DEFAULT now(),
    cpf TEXT,
    endereco TEXT,
    estado_civil TEXT,
    imovel_interesse TEXT,
    id_corretor_responsavel UUID,
    user_id UUID,
    company_id UUID DEFAULT 'd8387240-f150-4cf4-ae21-28e1f95f453c'::uuid
);

-- Oncall events table (REMOVED - events are fetched via API endpoints)

-- Oncall schedules table
CREATE TABLE public.oncall_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    calendar_id TEXT NOT NULL,
    calendar_name TEXT NOT NULL,
    mon_works BOOLEAN NOT NULL DEFAULT false,
    mon_start TIME,
    mon_end TIME,
    tue_works BOOLEAN NOT NULL DEFAULT false,
    tue_start TIME,
    tue_end TIME,
    wed_works BOOLEAN NOT NULL DEFAULT false,
    wed_start TIME,
    wed_end TIME,
    thu_works BOOLEAN NOT NULL DEFAULT false,
    thu_start TIME,
    thu_end TIME,
    fri_works BOOLEAN NOT NULL DEFAULT false,
    fri_start TIME,
    fri_end TIME,
    sat_works BOOLEAN NOT NULL DEFAULT false,
    sat_start TIME,
    sat_end TIME,
    sun_works BOOLEAN NOT NULL DEFAULT false,
    sun_start TIME,
    sun_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_user_id UUID
);

-- Properties table (REMOVED - using imoveisvivareal instead)

-- Property images table (REMOVED - using imoveisvivareal instead)

-- Role permissions table
CREATE TABLE public.role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    permission_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles table
CREATE TABLE public.user_profiles (
    id UUID NOT NULL,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT DEFAULT 'corretor'::text,
    department TEXT,
    company_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    chat_instance TEXT
);

-- WhatsApp chats table (REMOVED - using imobipro_messages instead)

-- WhatsApp instances table (REMOVED - using external N8N endpoints)
-- All WhatsApp functionality now handled via external webhooks
-- See: https://devlabz.n8nlabz.com.br/webhook/* endpoints

-- WhatsApp messages table (REMOVED - using imobipro_messages instead)

-- =============================================================================
-- CONSTRAINTS AND INDEXES
-- =============================================================================

-- Primary Keys
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE public.company_features ADD CONSTRAINT company_features_pkey PRIMARY KEY (id);
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_pkey PRIMARY KEY (id);
ALTER TABLE public.imobipro_messages ADD CONSTRAINT imobipro_messages1_pkey PRIMARY KEY (id);
ALTER TABLE public.imoveisvivareal ADD CONSTRAINT imoveisvivareal_pkey PRIMARY KEY (id);
ALTER TABLE public.inquilinato_conversations ADD CONSTRAINT inquilinato_conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.inquilinato_messages ADD CONSTRAINT inquilinato_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.oncall_schedules ADD CONSTRAINT oncall_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
-- whatsapp_instances primary key removed - table no longer exists

-- Foreign Key Constraints
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id);
ALTER TABLE public.company_features ADD CONSTRAINT company_features_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.contract_templates(id);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
ALTER TABLE public.imoveisvivareal ADD CONSTRAINT imoveisvivareal_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.imoveisvivareal ADD CONSTRAINT imoveisvivareal_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
ALTER TABLE public.inquilinato_conversations ADD CONSTRAINT inquilinato_conversations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.inquilinato_messages ADD CONSTRAINT inquilinato_messages_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.inquilinato_messages ADD CONSTRAINT inquilinato_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.inquilinato_conversations(id);
ALTER TABLE public.leads ADD CONSTRAINT leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.leads ADD CONSTRAINT leads_id_corretor_responsavel_fkey FOREIGN KEY (id_corretor_responsavel) REFERENCES public.user_profiles(id);
-- Property reference removed - using imoveisvivareal instead
ALTER TABLE public.leads ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
-- Oncall events table removed - events fetched via API
ALTER TABLE public.oncall_schedules ADD CONSTRAINT oncall_schedules_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.user_profiles(id);
ALTER TABLE public.oncall_schedules ADD CONSTRAINT oncall_schedules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.oncall_schedules ADD CONSTRAINT oncall_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
-- Property tables removed - using imoveisvivareal instead
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
-- WhatsApp instances, chats and messages tables removed - using external endpoints and imobipro_messages

-- Unique Constraints
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_numero_key UNIQUE (numero);
-- WhatsApp instances unique constraints removed - table no longer exists

-- Check Constraints
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_language_check CHECK (language = ANY (ARRAY['pt-BR'::text, 'en-US'::text, 'es-ES'::text]));
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_template_type_check CHECK (template_type = ANY (ARRAY['Locação'::text, 'Venda'::text]));
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check CHECK (status = ANY (ARRAY['Ativo'::text, 'Pendente'::text, 'Vencendo'::text, 'Expirado'::text, 'Cancelado'::text]));
ALTER TABLE public.contracts ADD CONSTRAINT contracts_tipo_check CHECK (tipo = ANY (ARRAY['Locação'::text, 'Venda'::text]));
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_broker_assignment_strategy_check CHECK (broker_assignment_strategy = ANY (ARRAY['round_robin'::text, 'random'::text, 'least_busy'::text]));
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_interval_between_messages_check CHECK (interval_between_messages >= 0);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_max_messages_per_hour_check CHECK (max_messages_per_hour > 0);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_assigned_brokers_check CHECK (jsonb_typeof(assigned_brokers) = 'array'::text);
ALTER TABLE public.dispatch_configurations ADD CONSTRAINT dispatch_configurations_time_windows_check CHECK (jsonb_typeof(time_windows) = 'object'::text);
-- WhatsApp instances check constraints removed - table no longer exists

-- =============================================================================
-- CUSTOM FUNCTIONS
-- =============================================================================

-- Get user company ID function
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$

  SELECT company_id 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;

$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$

DECLARE 
  v_role text;
  v_jwt_role text;
BEGIN
  -- Primeiro tenta pegar do JWT
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
    IF v_jwt_role IS NOT NULL AND v_jwt_role != 'authenticated' THEN
      RETURN v_jwt_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignora erros de JWT
  END;

  -- Se não tiver no JWT, busca na tabela (pode falhar se RLS bloquear)
  BEGIN
    SELECT role INTO v_role
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar, assume corretor como padrão mais restritivo
  END;

  -- Fallback para o papel mais restritivo
  RETURN 'corretor';
END;

$$;

-- Is admin user function
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$

  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    JOIN public.user_profiles up ON au.id = up.id
    WHERE au.id = auth.uid() 
      AND up.role = 'admin'
  );

$$;

-- List company users function
CREATE OR REPLACE FUNCTION public.list_company_users(target_company_id uuid DEFAULT NULL::uuid, search text DEFAULT NULL::text, roles text[] DEFAULT NULL::text[], limit_count integer DEFAULT 50, offset_count integer DEFAULT 0)
RETURNS TABLE(id uuid, email text, full_name text, role text, department text, phone text, avatar_url text, is_active boolean, company_id uuid, company_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$

  SELECT 
    up.id,
    up.email,
    up.full_name,
    up.role,
    up.department,
    up.phone,
    up.avatar_url,
    up.is_active,
    up.company_id,
    c.name as company_name,
    up.created_at,
    up.updated_at
  FROM public.user_profiles up
  LEFT JOIN public.companies c ON up.company_id = c.id
  WHERE 
    -- Se target_company_id for especificado, usar ele, senão usar a empresa do usuário atual
    up.company_id = COALESCE(
      target_company_id,
      (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    )
    -- Filtro de busca (nome ou email)
    AND (
      search IS NULL 
      OR up.full_name ILIKE '%' || search || '%'
      OR up.email ILIKE '%' || search || '%'
    )
    -- Filtro de roles
    AND (
      roles IS NULL 
      OR up.role = ANY(roles)
    )
  ORDER BY up.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;

$$;

-- Get leads for dashboard function
CREATE OR REPLACE FUNCTION public.admin_get_leads_by_period(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(lead_id uuid, created_at timestamp with time zone, source text, stage text, company_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$

DECLARE
  current_user_role TEXT;
BEGIN
  -- Verificar se o usuário é admin
  SELECT up.role INTO current_user_role 
  FROM user_profiles up
  WHERE up.id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: only admin users can access this function';
  END IF;

  -- Log da função
  RAISE NOTICE 'admin_get_leads_by_period: start_date=%, end_date=%, user=%', start_date, end_date, auth.uid();
  
  -- Buscar leads sem RLS (SECURITY DEFINER) - renomeando colunas para evitar ambiguidade
  RETURN QUERY
  SELECT 
    l.id AS lead_id,
    l.created_at,
    l.source,
    l.stage,
    l.company_id
  FROM public.leads l
  WHERE l.created_at >= start_date
    AND l.created_at <= end_date
  ORDER BY l.created_at ASC;
END;

$$;

-- Get leads for dashboard wrapper
CREATE OR REPLACE FUNCTION public.get_leads_for_dashboard(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(lead_id uuid, created_at timestamp with time zone, source text, stage text, company_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$

begin
  return query
  select * from public.admin_get_leads_by_period(start_date, end_date);
end;

$$;

-- Get imoveis for dashboard function
CREATE OR REPLACE FUNCTION public.get_imoveis_for_dashboard(start_date timestamp with time zone, end_date timestamp with time zone, trunc_type text)
RETURNS TABLE(bucket text, vgv numeric, imoveis bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$

BEGIN
  -- Validar trunc_type para evitar injeção de SQL
  IF trunc_type NOT IN ('day', 'week', 'month', 'year', 'total') THEN
    RAISE EXCEPTION 'Tipo de truncagem inválido: %', trunc_type;
  END IF;

  IF trunc_type = 'total' THEN
    RETURN QUERY
    SELECT
      NULL::TEXT AS bucket,
      SUM(preco) AS vgv,
      COUNT(id) AS imoveis
    FROM public.imoveisvivareal
    WHERE created_at BETWEEN start_date AND end_date;
  ELSE
    -- Executa a query dinâmica de forma segura para outros períodos
    RETURN QUERY
    EXECUTE format(
      'SELECT
        DATE_TRUNC(%L, created_at)::TEXT AS bucket,
        SUM(preco) AS vgv,
        COUNT(id) AS imoveis
      FROM public.imoveisvivareal
      WHERE created_at BETWEEN %L AND %L
      GROUP BY DATE_TRUNC(%L, created_at)
      ORDER BY bucket ASC;',
      trunc_type,
      start_date,
      end_date,
      trunc_type
    );
  END IF;
END;

$$;

-- Notify managers connection request function (REMOVED)
-- WhatsApp functionality now handled via external N8N webhooks
-- Function no longer needed as whatsapp_instances table was removed

-- Get corretores conversas dev function
CREATE OR REPLACE FUNCTION public.get_corretores_conversas_dev()
RETURNS TABLE(
    user_id uuid,
    full_name text,
    email text,
    role text,
    company_id uuid,
    conversation_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        up.id as user_id,
        up.full_name,
        up.email,
        up.role,
        up.company_id,
        COUNT(DISTINCT ic.id) as conversation_count
    FROM public.user_profiles up
    LEFT JOIN public.inquilinato_conversations ic ON up.id = ic.user_id
    WHERE up.role = 'corretor'
    AND up.is_active = true
    GROUP BY up.id, up.full_name, up.email, up.role, up.company_id
    ORDER BY conversation_count DESC;
$$;

-- Conversation functions for chat system
CREATE OR REPLACE FUNCTION public.conversation_for_user(p_session_id text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
RETURNS TABLE(id bigint, session_id text, message jsonb, data timestamp with time zone, media text, instancia text, before_handoff boolean, handoff_ts timestamp with time zone)
LANGUAGE sql VOLATILE SECURITY DEFINER
AS $$

  with me as (
    select id as uid, role, company_id, chat_instance
    from public.user_profiles
    where id = auth.uid()
  ),
  -- sessões que o usuário PODE ver:
  allowed_sessions as (
    select l.id::text as sid
    from public.leads l, me
    where l.company_id = me.company_id
      and (
        -- gestor/admin veem tudo da company
        me.role in ('admin','gestor')
        -- corretor vê se o lead está atribuído a ele
        or (me.role = 'corretor' and l.id_corretor_responsavel = me.uid)
        -- ou se já houve handoff (existe msg com sua instancia)
        or (me.role = 'corretor' and exists (
             select 1 from public.imobipro_messages m
             where m.session_id = l.id::text
               and m.instancia = me.chat_instance
           ))
      )
  ),
  handoff as (
    -- início do atendimento humano para ESTE usuário (primeira msg com a instancia dele)
    select min(m.data) as ts
    from public.imobipro_messages m, me
    where m.session_id = p_session_id
      and m.instancia = me.chat_instance
  )
  select
    m.id,
    m.session_id,
    m.message,
    m.data,
    m.media,
    m.instancia,
    -- true para mensagens anteriores ao handoff (usado para pintar/cinzar e inserir o divisor)
    (handoff.ts is not null and m.data < handoff.ts) as before_handoff,
    handoff.ts as handoff_ts
  from public.imobipro_messages m
  join allowed_sessions s on s.sid = m.session_id
  left join handoff on true
  where m.session_id = p_session_id
  order by m.data asc
  limit p_limit offset p_offset;

$$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql VOLATILE
AS $$

BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;

$$;

CREATE OR REPLACE FUNCTION public.set_contract_template_defaults()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$

BEGIN
  -- Set user_id if not provided
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid()::UUID;
  END IF;
  
  -- Set company_id usando a função auxiliar
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  
  -- Set created_by if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid()::TEXT;
  END IF;
  
  RETURN NEW;
END;

$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_features_updated_at BEFORE UPDATE ON public.company_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dispatch_configurations_updated_at BEFORE UPDATE ON public.dispatch_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_imoveisvivareal_updated_at BEFORE UPDATE ON public.imoveisvivareal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inquilinato_conversations_updated_at BEFORE UPDATE ON public.inquilinato_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_oncall_schedules_updated_at BEFORE UPDATE ON public.oncall_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- WhatsApp instances, chats and messages triggers removed - using external endpoints and imobipro_messages

-- Special triggers
CREATE TRIGGER set_contract_template_defaults_trigger BEFORE INSERT ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.set_contract_template_defaults();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveisvivareal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquilinato_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquilinato_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- WhatsApp instances, chats and messages RLS removed - using external endpoints and imobipro_messages

-- Audit logs policies
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "audit_logs_select_admin_gestor" ON public.audit_logs
    FOR SELECT
    TO public
    USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::text, 'gestor'::text]))))));

-- Companies policies
CREATE POLICY "companies_select" ON public.companies
    FOR SELECT
    TO public
    USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.company_id = companies.id)))));

-- Company features policies
CREATE POLICY "company_features_modify" ON public.company_features
    FOR ALL
    TO public
    USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text) AND (up.company_id = company_features.company_id)))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.role = 'admin'::text) AND (up.company_id = company_features.company_id)))));

CREATE POLICY "company_features_select" ON public.company_features
    FOR SELECT
    TO public
    USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.company_id = company_features.company_id)))));

-- Company settings policies
CREATE POLICY "company_settings_select_policy" ON public.company_settings
    FOR SELECT
    TO public
    USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));

CREATE POLICY "company_settings_insert_policy" ON public.company_settings
    FOR INSERT
    TO public
    WITH CHECK (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));

CREATE POLICY "company_settings_update_policy" ON public.company_settings
    FOR UPDATE
    TO public
    USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))))
    WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));

CREATE POLICY "company_settings_delete_policy" ON public.company_settings
    FOR DELETE
    TO public
    USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text))))));

-- Contract templates policies
CREATE POLICY "contract_templates_select_by_role" ON public.contract_templates
    FOR SELECT
    TO public
    USING (((get_user_role() = 'admin'::text) OR ((get_user_role() = 'gestor'::text) AND (company_id = get_user_company_id())) OR ((get_user_role() = 'corretor'::text) AND (user_id = auth.uid()))));

CREATE POLICY "contract_templates_insert_by_role" ON public.contract_templates
    FOR INSERT
    TO public
    WITH CHECK (((auth.uid() IS NOT NULL) AND ((get_user_role() = 'admin'::text) OR ((get_user_role() = ANY (ARRAY['gestor'::text, 'corretor'::text])) AND (company_id = get_user_company_id())))));

CREATE POLICY "contract_templates_update_by_role" ON public.contract_templates
    FOR UPDATE
    TO public
    USING (((get_user_role() = 'admin'::text) OR ((get_user_role() = 'gestor'::text) AND (company_id = get_user_company_id())) OR ((get_user_role() = 'corretor'::text) AND (user_id = auth.uid()))))
    WITH CHECK (((get_user_role() = 'admin'::text) OR (company_id = get_user_company_id())));

CREATE POLICY "contract_templates_delete_by_role" ON public.contract_templates
    FOR DELETE
    TO public
    USING (((get_user_role() = 'admin'::text) OR ((get_user_role() = 'gestor'::text) AND (company_id = get_user_company_id())) OR ((get_user_role() = 'corretor'::text) AND (user_id = auth.uid()))));

-- Contracts policies (permissive for now)
CREATE POLICY "Anyone can view contracts" ON public.contracts
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Anyone can create contracts" ON public.contracts
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Anyone can update contracts" ON public.contracts
    FOR UPDATE
    TO public
    USING (true);

CREATE POLICY "Anyone can delete contracts" ON public.contracts
    FOR DELETE
    TO public
    USING (true);

-- Dispatch configurations policies
CREATE POLICY "corretor_dispatch_configs_read" ON public.dispatch_configurations
    FOR SELECT
    TO authenticated
    USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.role
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text])) OR ((auth.uid())::text IN ( SELECT jsonb_array_elements_text(dispatch_configurations.assigned_brokers) AS jsonb_array_elements_text)))));

CREATE POLICY "owner_dispatch_configs_update" ON public.dispatch_configurations
    FOR UPDATE
    TO authenticated
    USING (((user_id = auth.uid()) AND (company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())))))
    WITH CHECK (((user_id = auth.uid()) AND (company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())))));

CREATE POLICY "admin_gestor_dispatch_configs_all" ON public.dispatch_configurations
    FOR ALL
    TO authenticated
    USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (( SELECT user_profiles.role
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))))
    WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));

-- Permissive policies (to be tightened later)
CREATE POLICY "imoveisvivareal_all" ON public.imoveisvivareal
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "inquilinato_conversations_all" ON public.inquilinato_conversations
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "inquilinato_messages_all" ON public.inquilinato_messages
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "role_permissions_all" ON public.role_permissions
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- WhatsApp instances policies (REMOVED)
-- All WhatsApp functionality now handled via external N8N webhooks
-- No RLS policies needed as data is managed externally

-- Properties and property_images tables removed - using imoveisvivareal instead

-- Leads policies (complex role-based)
CREATE POLICY "leads_select_admin_global" ON public.leads
    FOR SELECT
    TO public
    USING (
CASE
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'admin'::text) THEN true
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'gestor'::text) THEN (company_id = get_user_company_id())
    ELSE ((company_id = get_user_company_id()) AND (id_corretor_responsavel = auth.uid()))
END);

CREATE POLICY "leads_insert_admin_global" ON public.leads
    FOR INSERT
    TO public
    WITH CHECK (
CASE
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'admin'::text) THEN true
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'gestor'::text) THEN (company_id = get_user_company_id())
    ELSE ((company_id = get_user_company_id()) AND ((id_corretor_responsavel IS NULL) OR (id_corretor_responsavel = auth.uid())))
END);

CREATE POLICY "leads_update_admin_global" ON public.leads
    FOR UPDATE
    TO public
    USING (
CASE
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'admin'::text) THEN true
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'gestor'::text) THEN (company_id = get_user_company_id())
    ELSE ((company_id = get_user_company_id()) AND (id_corretor_responsavel = auth.uid()))
END)
    WITH CHECK (
CASE
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'admin'::text) THEN true
    ELSE (company_id = get_user_company_id())
END);

CREATE POLICY "leads_delete_admin_global" ON public.leads
    FOR DELETE
    TO public
    USING (
CASE
    WHEN (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = 'admin'::text) THEN true
    ELSE ((company_id = get_user_company_id()) AND (( SELECT user_profiles.role
       FROM user_profiles
      WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY['gestor'::text])))
END);

-- User profiles policies
CREATE POLICY "user_profiles_select_self" ON public.user_profiles
    FOR SELECT
    TO public
    USING ((id = auth.uid()));

CREATE POLICY "user_profiles_select_all" ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "user_profiles_insert_authenticated" ON public.user_profiles
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "user_profiles_update_admin_or_own" ON public.user_profiles
    FOR UPDATE
    TO public
    USING (((id = auth.uid()) OR is_admin_user()));

CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
    FOR DELETE
    TO public
    USING ((id = auth.uid()));

-- Oncall events policies removed - events fetched via API

-- Oncall schedules policies
CREATE POLICY "oncall_select" ON public.oncall_schedules
    FOR SELECT
    TO public
    USING (((user_id = auth.uid()) OR (assigned_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.company_id = oncall_schedules.company_id) AND (up.role = ANY (ARRAY['gestor'::text, 'admin'::text])))))));

CREATE POLICY "oncall_modify" ON public.oncall_schedules
    FOR ALL
    TO public
    USING (((user_id = auth.uid()) OR (assigned_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.company_id = oncall_schedules.company_id) AND (up.role = ANY (ARRAY['gestor'::text, 'admin'::text])))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = auth.uid()) AND (up.company_id = oncall_schedules.company_id)))));

-- =============================================================================
-- INDEXES (Optional Performance Improvements)
-- =============================================================================

-- Add important indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_corretor_responsavel ON public.leads(id_corretor_responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);
-- Index removed - properties table no longer exists
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
-- WhatsApp instances indexes removed - table no longer exists

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- This migration contains the complete schema state as of 2025-01-25 (Updated for external WhatsApp)
-- Total components:
-- - 15 Tables with proper structure (removed unused tables including whatsapp_instances)
-- - All Primary Key, Foreign Key, and Unique constraints
-- - Check constraints for data validation  
-- - 10+ Custom functions for business logic
-- - Comprehensive RLS policies for security
-- - Performance indexes on key columns
-- - Triggers for automatic field updates
-- - Removed: properties, property_images, whatsapp_instances, whatsapp_chats, whatsapp_messages, oncall_events
-- - Using: imoveisvivareal (properties), imobipro_messages (chat), external N8N webhooks (WhatsApp instances)

COMMENT ON SCHEMA public IS 'Complete ImobiPro database schema - WhatsApp via external endpoints';
