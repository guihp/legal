# 🔐 PLANO DE IMPLEMENTAÇÃO DE SEGURANÇA - ImobIPro

**Data de Criação**: 2025-01-27  
**Status**: Aguardando Implementação  
**Prioridade**: CRÍTICA  
**Responsável**: Equipe de Desenvolvimento  

Sempre utilize o MCP Supabase quando for necessário realizar alguma ação que envolva o supabase.

---

## 📋 RESUMO EXECUTIVO

Este documento é a **fonte única de verdade** para implementação de segurança no sistema ImobIPro. Baseado em auditoria completa realizada em 2025-01-27, identifica vulnerabilidades críticas e apresenta plano detalhado de correção.

### **🚨 VULNERABILIDADES CRÍTICAS IDENTIFICADAS**
1. **RLS Permissivo**: Tabelas `imoveisvivareal` e `contracts` com políticas `qual: "true"`
2. **Vault Ausente**: Nenhum uso do Supabase Vault para segredos
3. **Dados Hardcoded**: Senhas e tokens expostos no código
4. **Autenticação N8N**: Bearer token comentado, sem implementação
5. **Logs Insuficientes**: Ausência de logs de segurança estruturados

### **✅ PONTOS FORTES EXISTENTES**
- Supabase Auth implementado corretamente
- Edge Functions usando SERVICE_ROLE adequadamente
- RLS ativo na maioria das tabelas
- Função `get_current_role()` com SECURITY DEFINER
- Validação básica com Zod

---

## 🎯 OBJETIVOS E METAS

### **Objetivo Principal**
Transformar o ImobIPro em um sistema comercialmente seguro, eliminando todas as vulnerabilidades críticas e implementando as melhores práticas de segurança para aplicações SaaS.

### **Metas Mensuráveis**
- ✅ 100% das tabelas com RLS rigoroso
- ✅ 100% dos segredos no Supabase Vault
- ✅ 0 dados sensíveis hardcoded
- ✅ Logs de segurança em 100% das operações críticas
- ✅ Autenticação N8N funcional
- ✅ Monitoramento de segurança ativo

---

## 📊 CRONOGRAMA DETALHADO

### **🔥 SEMANA 1 - CORREÇÕES CRÍTICAS (5 dias)**

#### **DIA 1: Implementar Supabase Vault**
**Tempo estimado**: 8 horas  
**Responsável**: Dev Backend  

**Tarefas:**
1. **Ativar extensão Vault** (30min)
```sql
-- Executar no Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vault;
```

2. **Criar segredos iniciais** (1h)
```sql
-- Migração: 20250127100000_setup_vault_secrets.sql
-- Criar todos os segredos necessários
SELECT vault.create_secret('n8n_webhook_secret', 'Imobipro@123');
SELECT vault.create_secret('evolution_api_token', 'Imobipro@123');
SELECT vault.create_secret('default_user_password', 'Imobipro@123');
SELECT vault.create_secret('smtp_password', 'Imobipro@123');
SELECT vault.create_secret('openai_api_key', 'Imobipro@123');
```

3. **Criar função helper para Edge Functions** (2h)
```typescript
// supabase/functions/_shared/vault.ts
export async function getVaultSecret(secretName: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabaseAdmin
    .rpc('vault_get_secret', { secret_name: secretName });
  
  if (error) {
    console.error(`Vault error for ${secretName}:`, error);
    throw new Error(`Failed to get secret: ${secretName}`);
  }
  
  if (!data) {
    throw new Error(`Secret not found: ${secretName}`);
  }
  
  return data;
}
```

4. **Atualizar Edge Functions existentes** (3h)
```typescript
// supabase/functions/admin-create-user/index.ts - ATUALIZAR
import { getVaultSecret } from '../_shared/vault.ts';

// Substituir senha hardcoded
const defaultPassword = await getVaultSecret('default_user_password');
```

5. **Testes de integração** (1.5h)
- Verificar se todas as Edge Functions funcionam com Vault
- Testar recuperação de segredos
- Validar error handling

**Critérios de Aceite:**
- [ ] Extensão Vault ativa
- [ ] Todos os segredos criados no Vault
- [ ] Edge Functions usando Vault
- [ ] Testes passando
- [ ] Documentação atualizada

---

#### **DIA 2: Corrigir RLS Permissivo**
**Tempo estimado**: 8 horas  
**Responsável**: Dev Backend + DBA  

**Tarefas:**
1. **Audit completo das policies atuais** (1h)
```sql
-- Script de auditoria
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

2. **Corrigir tabela imoveisvivareal** (2h)
```sql
-- Migração: 20250127110000_fix_imoveisvivareal_rls.sql

-- Remover policy permissiva
DROP POLICY IF EXISTS "imoveisvivareal_all" ON public.imoveisvivareal;

-- Criar policies seguras
CREATE POLICY "imoveisvivareal_select_company_scoped" ON public.imoveisvivareal
FOR SELECT
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND CASE 
    WHEN (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor') THEN true
    ELSE user_id = auth.uid()
  END
);

CREATE POLICY "imoveisvivareal_insert_company_scoped" ON public.imoveisvivareal
FOR INSERT
WITH CHECK (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor')
    OR user_id = auth.uid()
  )
);

CREATE POLICY "imoveisvivareal_update_company_scoped" ON public.imoveisvivareal
FOR UPDATE
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND CASE 
    WHEN (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor') THEN true
    ELSE user_id = auth.uid()
  END
)
WITH CHECK (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "imoveisvivareal_delete_admin_gestor" ON public.imoveisvivareal
FOR DELETE
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor')
);
```

3. **Corrigir tabela contracts** (2h)
```sql
-- Migração: 20250127120000_fix_contracts_rls.sql

-- Remover policies permissivas
DROP POLICY IF EXISTS "Anyone can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can delete contracts" ON public.contracts;

-- Criar policies seguras
CREATE POLICY "contracts_select_company_scoped" ON public.contracts
FOR SELECT
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND CASE 
    WHEN (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor') THEN true
    ELSE user_id = auth.uid()
  END
);

CREATE POLICY "contracts_insert_company_scoped" ON public.contracts
FOR INSERT
WITH CHECK (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND user_id = auth.uid()
);

CREATE POLICY "contracts_update_company_scoped" ON public.contracts
FOR UPDATE
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND CASE 
    WHEN (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor') THEN true
    ELSE user_id = auth.uid()
  END
)
WITH CHECK (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "contracts_delete_admin_gestor" ON public.contracts
FOR DELETE
USING (
  company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'gestor')
);
```

4. **Criar testes de RLS** (2h)
```sql
-- Arquivo: supabase/tests/rls_security_tests.sql
-- Testes automatizados para validar RLS

-- Test 1: Corretor não deve ver contratos de outras empresas
BEGIN;
  SET request.jwt.claims = '{"sub": "corretor-user-id", "user_metadata": {"role": "corretor"}}';
  
  -- Inserir dados de teste
  INSERT INTO user_profiles (id, role, company_id) VALUES 
    ('corretor-user-id', 'corretor', 'company-a'),
    ('other-user-id', 'corretor', 'company-b');
  
  INSERT INTO contracts (id, user_id, company_id, title) VALUES
    ('contract-a', 'corretor-user-id', 'company-a', 'Contract A'),
    ('contract-b', 'other-user-id', 'company-b', 'Contract B');
  
  -- Teste: corretor só deve ver próprios contratos
  SELECT COUNT(*) as visible_contracts FROM contracts; -- Deve retornar 1
  
ROLLBACK;
```

5. **Validação e testes** (1h)
- Executar testes de RLS
- Verificar se aplicação funciona normalmente
- Confirmar isolamento entre empresas

**Critérios de Aceite:**
- [ ] Policies permissivas removidas
- [ ] Policies seguras implementadas
- [ ] Testes de RLS passando
- [ ] Isolamento entre empresas funcionando
- [ ] Aplicação funcionando normalmente

---

#### **DIA 3: Implementar Autenticação N8N**
**Tempo estimado**: 8 horas  
**Responsável**: Dev Backend  

**Tarefas:**
1. **Criar serviço de autenticação N8N** (3h)
```typescript
// src/services/n8nAuth.ts
import { supabase } from '@/integrations/supabase/client';

export interface N8NWebhookRequest {
  endpoint: string;
  payload: any;
  signature?: string;
}

export interface N8NAuthHeaders {
  'Content-Type': string;
  'Authorization': string;
  'X-Signature'?: string;
}

export class N8NAuthService {
  private static instance: N8NAuthService;
  private bearerToken: string | null = null;
  private webhookSecret: string | null = null;

  static getInstance(): N8NAuthService {
    if (!N8NAuthService.instance) {
      N8NAuthService.instance = new N8NAuthService();
    }
    return N8NAuthService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Buscar tokens do Vault via Edge Function
      const { data, error } = await supabase.functions.invoke('get-n8n-credentials');
      
      if (error) throw error;
      
      this.bearerToken = data.bearer_token;
      this.webhookSecret = data.webhook_secret;
    } catch (error) {
      console.error('Erro ao inicializar N8N auth:', error);
      throw new Error('Falha na inicialização da autenticação N8N');
    }
  }

  async getAuthHeaders(payload?: any): Promise<N8NAuthHeaders> {
    if (!this.bearerToken) {
      await this.initialize();
    }

    const headers: N8NAuthHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.bearerToken}`,
    };

    // Adicionar assinatura HMAC se payload fornecido
    if (payload && this.webhookSecret) {
      const signature = await this.generateSignature(payload);
      headers['X-Signature'] = signature;
    }

    return headers;
  }

  private async generateSignature(payload: any): Promise<string> {
    const data = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret!);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async validateIncomingWebhook(
    payload: string,
    signature: string
  ): Promise<boolean> {
    if (!this.webhookSecret) {
      await this.initialize();
    }

    const expectedSignature = await this.generateSignature(payload);
    return signature === expectedSignature;
  }
}
```

2. **Criar Edge Function para credenciais** (2h)
```typescript
// supabase/functions/get-n8n-credentials/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVaultSecret } from '../_shared/vault.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais do Vault
    const [bearerToken, webhookSecret] = await Promise.all([
      getVaultSecret('n8n_webhook_secret'),
      getVaultSecret('n8n_webhook_secret') // Mesmo valor para ambos por enquanto
    ]);

    return new Response(
      JSON.stringify({
        bearer_token: bearerToken,
        webhook_secret: webhookSecret
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na edge function get-n8n-credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

3. **Atualizar serviços existentes** (2h)
```typescript
// src/services/whatsappWebhook.ts - ATUALIZAR
import { N8NAuthService } from './n8nAuth';

export async function sendWhatsAppMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppWebhookResponse> {
  try {
    // Validação de payload (manter existente)
    if (!payload.message.trim()) {
      throw new Error('Mensagem não pode estar vazia');
    }

    // Obter headers autenticados
    const n8nAuth = N8NAuthService.getInstance();
    const headers = await n8nAuth.getAuthHeaders(payload);

    // Construir URL completa
    const url = `${WEBHOOK_CONFIG.baseUrl}${WEBHOOK_CONFIG.sendMessageEndpoint}`;

    console.log('🚀 Enviando mensagem via webhook autenticado:', {
      url,
      lead_phone: payload.lead_phone,
      corretor: payload.corretor_nome,
      message_preview: payload.message.substring(0, 50) + '...'
    });

    // Fazer requisição autenticada
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_CONFIG.timeout)
    });

    // Resto da implementação (manter existente)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
      message: 'Mensagem enviada com sucesso'
    };

  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido',
      message: 'Falha no envio da mensagem'
    };
  }
}
```

4. **Middleware para webhooks incoming** (1h)
```typescript
// src/middleware/webhookAuth.ts
import { N8NAuthService } from '@/services/n8nAuth';

export async function validateN8NWebhook(
  request: Request
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const signature = request.headers.get('X-Signature');
    if (!signature) {
      return { isValid: false, error: 'Missing signature header' };
    }

    const payload = await request.text();
    const n8nAuth = N8NAuthService.getInstance();
    const isValid = await n8nAuth.validateIncomingWebhook(payload, signature);

    return { isValid };
  } catch (error) {
    console.error('Erro na validação de webhook:', error);
    return { isValid: false, error: 'Validation failed' };
  }
}
```

**Critérios de Aceite:**
- [ ] Serviço N8NAuthService implementado
- [ ] Edge Function para credenciais funcionando
- [ ] Webhooks outgoing usando Bearer token
- [ ] Validação de webhooks incoming
- [ ] Testes de integração passando

---

#### **DIA 4: Remover Dados Hardcoded**
**Tempo estimado**: 6 horas  
**Responsável**: Dev Frontend + Backend  

**Tarefas:**
1. **Audit de dados sensíveis** (1h)
```bash
# Script para encontrar dados hardcoded
grep -r -E "(password|token|secret|key).*=.*['\"][^'\"]+['\"]" src/
grep -r "Imobi@1234" src/
grep -r "SERVICE_ROLE" src/
```

2. **Atualizar UserManagementView** (2h)
```typescript
// src/components/UserManagementView.tsx - ATUALIZAR
import { getVaultSecret } from '@/services/vault';

export function UserManagementView() {
  const [defaultPassword, setDefaultPassword] = useState<string>('');

  useEffect(() => {
    const loadDefaultPassword = async () => {
      try {
        // Buscar senha padrão do Vault via Edge Function
        const { data, error } = await supabase.functions.invoke('get-default-password');
        if (error) throw error;
        setDefaultPassword(data.password);
      } catch (error) {
        console.error('Erro ao carregar senha padrão:', error);
        // Fallback para uma senha gerada
        setDefaultPassword(generateSecurePassword());
      }
    };

    loadDefaultPassword();
  }, []);

  // Resto da implementação usando defaultPassword em vez de hardcoded
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

3. **Criar Edge Function para senha padrão** (1h)
```typescript
// supabase/functions/get-default-password/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVaultSecret } from '../_shared/vault.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário é admin ou gestor
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !['admin', 'gestor'].includes(profile?.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar senha do Vault
    const password = await getVaultSecret('default_user_password');

    return new Response(
      JSON.stringify({ password }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na edge function get-default-password:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

4. **Remover variáveis hardcoded** (1h)
```typescript
// Remover de @docs/hierarquia-usuarios.md
// Substituir referências a VITE_DEFAULT_NEW_USER_PASSWORD

// Atualizar .env.example
echo "# Remover VITE_DEFAULT_NEW_USER_PASSWORD - agora no Vault" >> .env.example
```

5. **Testes e validação** (1h)
- Verificar se criação de usuários funciona
- Testar diferentes roles
- Confirmar que senha não está mais hardcoded

**Critérios de Aceite:**
- [ ] Nenhum dado sensível hardcoded no código
- [ ] Senhas padrão vindo do Vault
- [ ] Edge Function para senhas funcionando
- [ ] Testes de criação de usuário passando
- [ ] Documentação atualizada

---

#### **DIA 5: Implementar Logging de Segurança**
**Tempo estimado**: 8 horas  
**Responsável**: Dev Backend  

**Tarefas:**
1. **Criar tabela de logs de segurança** (1h)
```sql
-- Migração: 20250127130000_create_security_logs.sql
CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ip_address inet,
  user_agent text,
  endpoint text,
  method text,
  payload jsonb,
  response_code integer,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX idx_security_logs_severity ON public.security_logs(severity);
CREATE INDEX idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX idx_security_logs_company_id ON public.security_logs(company_id);

-- RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admins podem ver logs de segurança
CREATE POLICY "security_logs_admin_only" ON public.security_logs
FOR ALL
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
);
```

2. **Criar serviço de logging de segurança** (3h)
```typescript
// src/lib/security/logger.ts
import { supabase } from '@/integrations/supabase/client';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  payload?: any;
  responseCode?: number;
  details?: Record<string, any>;
}

export enum SecurityEventType {
  // Autenticação
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGIN_SUSPICIOUS = 'auth.login.suspicious',
  PASSWORD_CHANGE = 'auth.password.change',
  TOKEN_REFRESH = 'auth.token.refresh',
  
  // Autorização
  ACCESS_DENIED = 'authz.access.denied',
  PRIVILEGE_ESCALATION = 'authz.privilege.escalation',
  RLS_VIOLATION = 'authz.rls.violation',
  
  // Dados sensíveis
  DATA_EXPORT = 'data.export',
  DATA_DELETION = 'data.deletion',
  SENSITIVE_DATA_ACCESS = 'data.sensitive.access',
  
  // API
  API_RATE_LIMIT = 'api.rate_limit',
  API_UNUSUAL_ACTIVITY = 'api.unusual_activity',
  
  // Sistema
  SYSTEM_ERROR = 'system.error',
  CONFIGURATION_CHANGE = 'system.config.change',
}

export class SecurityLogger {
  private static instance: SecurityLogger;

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  async logEvent(event: SecurityEvent): Promise<void> {
    try {
      // Enriquecer evento com contexto
      const enrichedEvent = await this.enrichEvent(event);

      // Inserir no banco
      const { error } = await supabase.from('security_logs').insert({
        event_type: enrichedEvent.type,
        severity: enrichedEvent.severity,
        user_id: enrichedEvent.userId,
        company_id: enrichedEvent.companyId,
        ip_address: enrichedEvent.ipAddress,
        user_agent: enrichedEvent.userAgent,
        endpoint: enrichedEvent.endpoint,
        method: enrichedEvent.method,
        payload: enrichedEvent.payload,
        response_code: enrichedEvent.responseCode,
        details: enrichedEvent.details
      });

      if (error) {
        console.error('Erro ao registrar log de segurança:', error);
      }

      // Alertas para eventos críticos
      if (enrichedEvent.severity === 'critical') {
        await this.sendCriticalAlert(enrichedEvent);
      }

    } catch (error) {
      console.error('Erro no SecurityLogger:', error);
    }
  }

  private async enrichEvent(event: SecurityEvent): Promise<SecurityEvent> {
    const enriched = { ...event };

    // Obter usuário atual se não fornecido
    if (!enriched.userId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        enriched.userId = user?.id;
      } catch {}
    }

    // Obter company_id se temos userId
    if (enriched.userId && !enriched.companyId) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', enriched.userId)
          .single();
        enriched.companyId = profile?.company_id;
      } catch {}
    }

    // Obter IP do cliente (quando possível)
    if (!enriched.ipAddress) {
      // Em produção, configurar para capturar IP real
      enriched.ipAddress = 'unknown';
    }

    // User Agent
    if (!enriched.userAgent && typeof navigator !== 'undefined') {
      enriched.userAgent = navigator.userAgent;
    }

    return enriched;
  }

  private async sendCriticalAlert(event: SecurityEvent): Promise<void> {
    try {
      // Enviar alerta via Edge Function
      await supabase.functions.invoke('send-security-alert', {
        body: { event }
      });
    } catch (error) {
      console.error('Erro ao enviar alerta crítico:', error);
    }
  }

  // Métodos de conveniência
  async logLogin(success: boolean, details?: any): Promise<void> {
    await this.logEvent({
      type: success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILURE,
      severity: success ? 'low' : 'medium',
      details
    });
  }

  async logAccessDenied(endpoint: string, details?: any): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.ACCESS_DENIED,
      severity: 'high',
      endpoint,
      details
    });
  }

  async logDataExport(resource: string, recordCount: number): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.DATA_EXPORT,
      severity: 'medium',
      details: { resource, record_count: recordCount }
    });
  }

  async logRLSViolation(table: string, details?: any): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.RLS_VIOLATION,
      severity: 'critical',
      details: { table, ...details }
    });
  }
}

// Instância global
export const securityLogger = SecurityLogger.getInstance();
```

3. **Integrar com sistema de autenticação** (2h)
```typescript
// src/hooks/useAuthManager.ts - ATUALIZAR
import { securityLogger, SecurityEventType } from '@/lib/security/logger';

class AuthManager {
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        await securityLogger.logEvent({
          type: SecurityEventType.LOGIN_FAILURE,
          severity: 'medium',
          details: { email, error: error.message }
        });
        throw error;
      }

      await securityLogger.logEvent({
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: 'low',
        userId: data.user.id,
        details: { email }
      });

      return { data, error: null };
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  // Implementar em outros métodos críticos
}
```

4. **Middleware para APIs críticas** (1.5h)
```typescript
// src/middleware/securityLogger.ts
import { securityLogger, SecurityEventType } from '@/lib/security/logger';

export function withSecurityLogging<T extends (...args: any[]) => any>(
  fn: T,
  eventType: SecurityEventType,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      
      await securityLogger.logEvent({
        type: eventType,
        severity,
        details: {
          duration_ms: Date.now() - startTime,
          success: true,
          args_count: args.length
        }
      });
      
      return result;
    } catch (error) {
      await securityLogger.logEvent({
        type: eventType,
        severity: 'high',
        details: {
          duration_ms: Date.now() - startTime,
          success: false,
          error: error.message,
          args_count: args.length
        }
      });
      
      throw error;
    }
  }) as T;
}

// Exemplo de uso
export const secureCreateUser = withSecurityLogging(
  createUser,
  SecurityEventType.DATA_CREATION,
  'medium'
);
```

5. **Edge Function para alertas** (0.5h)
```typescript
// supabase/functions/send-security-alert/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    const { event } = await req.json();
    
    // Por enquanto, apenas log
    console.log('🚨 ALERTA DE SEGURANÇA CRÍTICO:', event);
    
    // Em produção: integrar com Slack, email, PagerDuty, etc.
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro no alerta de segurança:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

**Critérios de Aceite:**
- [ ] Tabela security_logs criada
- [ ] SecurityLogger implementado
- [ ] Integração com autenticação
- [ ] Middleware para APIs críticas
- [ ] Alertas para eventos críticos
- [ ] Testes de logging funcionando

---

### **⚠️ SEMANA 2 - MELHORIAS DE SEGURANÇA (5 dias)**

#### **DIA 6: Adicionar Sanitização XSS**
**Tempo estimado**: 6 horas  
**Responsável**: Dev Frontend  

**Tarefas:**
1. **Instalar dependências** (15min)
```bash
npm install dompurify @types/dompurify
npm install validator @types/validator
```

2. **Criar utilitários de sanitização** (2h)
```typescript
// src/lib/security/sanitization.ts
import DOMPurify from 'dompurify';
import validator from 'validator';

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: string[];
}

export class DataSanitizer {
  private static defaultOptions: SanitizationOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    allowedAttributes: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  };

  /**
   * Sanitiza HTML para prevenir XSS
   */
  static sanitizeHtml(input: string, options?: SanitizationOptions): string {
    if (!input || typeof input !== 'string') return '';

    const opts = { ...this.defaultOptions, ...options };
    
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: opts.allowedTags,
      ALLOWED_ATTR: Object.keys(opts.allowedAttributes || {}),
      KEEP_CONTENT: !opts.stripIgnoreTag
    });
  }

  /**
   * Sanitiza entrada de texto simples
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return validator.escape(input.trim());
  }

  /**
   * Valida e sanitiza email
   */
  static sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;

    const clean = email.trim().toLowerCase();
    return validator.isEmail(clean) ? clean : null;
  }

  /**
   * Sanitiza telefone
   */
  static sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';

    // Remove tudo exceto números, + e espaços
    return phone.replace(/[^\d+\s()-]/g, '').trim();
  }

  /**
   * Sanitiza CPF/CNPJ
   */
  static sanitizeDocument(doc: string): string {
    if (!doc || typeof doc !== 'string') return '';

    // Remove tudo exceto números
    return doc.replace(/[^\d]/g, '');
  }

  /**
   * Sanitiza URL
   */
  static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    const clean = url.trim();
    
    // Permitir apenas HTTP/HTTPS
    if (!validator.isURL(clean, { 
      protocols: ['http', 'https'],
      require_protocol: false 
    })) {
      return null;
    }

    return clean;
  }

  /**
   * Sanitiza objeto recursivamente
   */
  static sanitizeObject<T extends Record<string, any>>(
    obj: T,
    rules: Record<keyof T, 'text' | 'html' | 'email' | 'phone' | 'document' | 'url' | 'raw'>
  ): T {
    const sanitized = { ...obj };

    for (const [key, rule] of Object.entries(rules)) {
      const value = sanitized[key as keyof T];
      
      if (value === null || value === undefined) continue;

      switch (rule) {
        case 'text':
          sanitized[key as keyof T] = this.sanitizeText(String(value)) as T[keyof T];
          break;
        case 'html':
          sanitized[key as keyof T] = this.sanitizeHtml(String(value)) as T[keyof T];
          break;
        case 'email':
          sanitized[key as keyof T] = this.sanitizeEmail(String(value)) as T[keyof T];
          break;
        case 'phone':
          sanitized[key as keyof T] = this.sanitizePhone(String(value)) as T[keyof T];
          break;
        case 'document':
          sanitized[key as keyof T] = this.sanitizeDocument(String(value)) as T[keyof T];
          break;
        case 'url':
          sanitized[key as keyof T] = this.sanitizeUrl(String(value)) as T[keyof T];
          break;
        case 'raw':
          // Não sanitizar
          break;
      }
    }

    return sanitized;
  }
}
```

3. **Criar hook de sanitização** (1h)
```typescript
// src/hooks/useSanitization.ts
import { useCallback } from 'react';
import { DataSanitizer } from '@/lib/security/sanitization';

export function useSanitization() {
  const sanitizeLeadData = useCallback((leadData: any) => {
    return DataSanitizer.sanitizeObject(leadData, {
      nome: 'text',
      email: 'email',
      telefone: 'phone',
      cpf: 'document',
      endereco: 'text',
      interesse: 'text',
      observacoes: 'html',
      message: 'html'
    });
  }, []);

  const sanitizePropertyData = useCallback((propertyData: any) => {
    return DataSanitizer.sanitizeObject(propertyData, {
      title: 'text',
      description: 'html',
      address: 'text',
      city: 'text',
      state: 'text',
      propertyCode: 'text'
    });
  }, []);

  const sanitizeUserData = useCallback((userData: any) => {
    return DataSanitizer.sanitizeObject(userData, {
      full_name: 'text',
      email: 'email',
      phone: 'phone'
    });
  }, []);

  return {
    sanitizeLeadData,
    sanitizePropertyData,
    sanitizeUserData,
    sanitizeText: DataSanitizer.sanitizeText,
    sanitizeHtml: DataSanitizer.sanitizeHtml,
    sanitizeEmail: DataSanitizer.sanitizeEmail
  };
}
```

4. **Integrar com formulários existentes** (2h)
```typescript
// src/components/AddLeadModal.tsx - ATUALIZAR
import { useSanitization } from '@/hooks/useSanitization';

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ 
  isOpen, 
  onClose, 
  leadToEdit = null,
  updateLeadOverride
}) => {
  const { sanitizeLeadData } = useSanitization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica (manter existente)
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.email.trim() && !formData.telefone.trim()) {
      toast.error('Email ou telefone são obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // Sanitizar dados antes de enviar
      const sanitizedData = sanitizeLeadData({
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        cpf: formData.cpf,
        endereco: formData.endereco,
        interesse: formData.interest,
        observacoes: formData.notes,
        message: formData.message
      });

      const leadData = {
        ...sanitizedData,
        estado_civil: formData.estado_civil || '',
        origem: formData.source || 'Website',
        stage: formData.stage,
        valor: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
        valorEstimado: formData.estimated_value ? parseFloat(formData.estimated_value) : 0,
        property_id: formData.property_id || '',
        imovel_interesse: listingId || undefined,
        dataContato: new Date().toISOString().split('T')[0]
      };

      // Resto da implementação (manter existente)
      
    } catch (err: any) {
      console.error('Erro ao criar/atualizar lead:', err);
      toast.error(err.message || 'Erro ao salvar lead');
    } finally {
      setLoading(false);
    }
  };

  // Resto do componente (manter existente)
};
```

5. **Atualizar outros formulários** (0.75h)
- PropertyForm.tsx
- UserManagementView.tsx
- MessageTemplateEditor.tsx

**Critérios de Aceite:**
- [ ] Dependências de sanitização instaladas
- [ ] DataSanitizer implementado
- [ ] Hook useSanitization criado
- [ ] Formulários principais usando sanitização
- [ ] Testes de XSS prevention

---

#### **DIA 7: Configurar Security Headers**
**Tempo estimado**: 4 horas  
**Responsável**: Dev Frontend + DevOps  

**Tarefas:**
1. **Configurar headers no Vite** (1h)
```typescript
// vite.config.ts - ATUALIZAR
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // XSS Protection
      'X-XSS-Protection': '1; mode=block',
      
      // HSTS (em produção via servidor web)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Content Security Policy
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://deno.land",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.n8n.io",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join('; '),
      
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions Policy
      'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'accelerometer=()',
        'gyroscope=()'
      ].join(', ')
    }
  }
})
```

2. **Criar .htaccess para produção** (1h)
```apache
# public/.htaccess
# Security Headers para produção no Hostinger

# Prevent MIME type sniffing
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  
  # HSTS - apenas em HTTPS
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" env=HTTPS
  
  # CSP para produção
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://deno.land; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.n8n.io; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  
  # Permissions Policy
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()"
</IfModule>

# SPA Fallback
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Handle Angular and other router cases
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Cache Control
<IfModule mod_expires.c>
  ExpiresActive On
  
  # Cache static assets
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType application/pdf "access plus 1 month"
  
  # Cache HTML for short time
  ExpiresByType text/html "access plus 10 minutes"
</IfModule>

# Compression
<IfModule mod_deflate.c>
  # Compress HTML, CSS, JavaScript, Text, XML and fonts
  AddOutputFilterByType DEFLATE application/javascript
  AddOutputFilterByType DEFLATE application/rss+xml
  AddOutputFilterByType DEFLATE application/vnd.ms-fontobject
  AddOutputFilterByType DEFLATE application/x-font
  AddOutputFilterByType DEFLATE application/x-font-opentype
  AddOutputFilterByType DEFLATE application/x-font-otf
  AddOutputFilterByType DEFLATE application/x-font-truetype
  AddOutputFilterByType DEFLATE application/x-font-ttf
  AddOutputFilterByType DEFLATE application/x-javascript
  AddOutputFilterByType DEFLATE application/xhtml+xml
  AddOutputFilterByType DEFLATE application/xml
  AddOutputFilterByType DEFLATE font/opentype
  AddOutputFilterByType DEFLATE font/otf
  AddOutputFilterByType DEFLATE font/ttf
  AddOutputFilterByType DEFLATE image/svg+xml
  AddOutputFilterByType DEFLATE image/x-icon
  AddOutputFilterByType DEFLATE text/css
  AddOutputFilterByType DEFLATE text/html
  AddOutputFilterByType DEFLATE text/javascript
  AddOutputFilterByType DEFLATE text/plain
  AddOutputFilterByType DEFLATE text/xml
</IfModule>

# Security
<IfModule mod_rewrite.c>
  # Block access to sensitive files
  RewriteRule ^\.env - [F,L]
  RewriteRule ^\.git - [F,L]
  RewriteRule ^package\.json - [F,L]
  RewriteRule ^package-lock\.json - [F,L]
  RewriteRule ^yarn\.lock - [F,L]
  RewriteRule ^pnpm-lock\.yaml - [F,L]
</IfModule>
```

3. **Configurar CSP dinâmico** (1h)
```typescript
// src/lib/security/csp.ts
export class CSPManager {
  private static nonce: string | null = null;

  static generateNonce(): string {
    if (!this.nonce) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      this.nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return this.nonce;
  }

  static getCSPHeader(isDevelopment: boolean = false): string {
    const nonce = this.generateNonce();
    
    const directives = [
      "default-src 'self'",
      `script-src 'self' ${isDevelopment ? "'unsafe-eval' 'unsafe-inline'" : `'nonce-${nonce}'`} https://esm.sh https://deno.land`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.n8n.io",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      isDevelopment ? "" : "upgrade-insecure-requests"
    ].filter(Boolean);

    return directives.join('; ');
  }

  static applyCSP(isDevelopment: boolean = false): void {
    if (typeof document !== 'undefined') {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = this.getCSPHeader(isDevelopment);
      document.head.appendChild(meta);
    }
  }
}

// Auto-aplicar em desenvolvimento
if (import.meta.env.DEV) {
  CSPManager.applyCSP(true);
}
```

4. **Testes de headers** (1h)
```typescript
// src/tests/security/headers.test.ts
import { describe, it, expect } from 'vitest';

describe('Security Headers', () => {
  it('should include all required security headers in development', async () => {
    // Mock fetch para testar headers
    const response = await fetch('http://localhost:5173');
    const headers = response.headers;

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('should generate valid CSP nonce', () => {
    const nonce1 = CSPManager.generateNonce();
    const nonce2 = CSPManager.generateNonce();
    
    expect(nonce1).toBeDefined();
    expect(nonce1.length).toBe(32); // 16 bytes * 2 chars
    expect(nonce1).toBe(nonce2); // Should be same within session
  });
});
```

**Critérios de Aceite:**
- [ ] Security headers configurados no Vite
- [ ] .htaccess criado para produção
- [ ] CSP dinâmico implementado
- [ ] Testes de headers passando
- [ ] Headers validados no browser

---

#### **DIA 8: Implementar Rate Limiting Básico**
**Tempo estimado**: 6 horas  
**Responsável**: Dev Backend  

**Tarefas:**
1. **Criar tabela de rate limiting** (1h)
```sql
-- Migração: 20250127140000_create_rate_limits.sql
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  ip_address inet,
  requests_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices únicos para evitar race conditions
CREATE UNIQUE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
CREATE UNIQUE INDEX idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint) WHERE user_id IS NULL;

-- Índices para performance
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX idx_rate_limits_blocked_until ON public.rate_limits(blocked_until);

-- RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem próprios limites
CREATE POLICY "rate_limits_own_data" ON public.rate_limits
FOR ALL
USING (user_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- Função para limpeza automática
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove registros de mais de 24 horas
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '24 hours';
END;
$$;

-- Trigger para limpeza automática (executar diariamente)
-- Em produção, configurar via cron job ou Edge Function
```

2. **Implementar serviço de rate limiting** (3h)
```typescript
// src/lib/security/rateLimiter.ts
import { supabase } from '@/integrations/supabase/client';

export interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
  blockDurationMinutes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests?: number;
  resetTime?: Date;
  blockedUntil?: Date;
}

export class RateLimiter {
  private static configs: Map<string, RateLimitConfig> = new Map([
    // API endpoints críticos
    ['auth.login', { endpoint: 'auth.login', maxRequests: 5, windowMinutes: 15, blockDurationMinutes: 30 }],
    ['auth.register', { endpoint: 'auth.register', maxRequests: 3, windowMinutes: 60, blockDurationMinutes: 60 }],
    ['user.create', { endpoint: 'user.create', maxRequests: 10, windowMinutes: 60 }],
    ['lead.create', { endpoint: 'lead.create', maxRequests: 50, windowMinutes: 60 }],
    ['whatsapp.send', { endpoint: 'whatsapp.send', maxRequests: 100, windowMinutes: 60 }],
    ['export.data', { endpoint: 'export.data', maxRequests: 5, windowMinutes: 60 }],
    
    // API geral
    ['api.general', { endpoint: 'api.general', maxRequests: 300, windowMinutes: 60 }]
  ]);

  static async checkLimit(
    endpoint: string,
    userId?: string,
    ipAddress?: string
  ): Promise<RateLimitResult> {
    try {
      const config = this.configs.get(endpoint) || this.configs.get('api.general')!;
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

      // Buscar ou criar registro de rate limit
      const { data: existingLimit, error: fetchError } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('endpoint', config.endpoint)
        .eq(userId ? 'user_id' : 'ip_address', userId || ipAddress)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Erro ao buscar rate limit:', fetchError);
        // Em caso de erro, permitir a requisição
        return { allowed: true };
      }

      const now = new Date();

      // Verificar se está bloqueado
      if (existingLimit?.blocked_until && new Date(existingLimit.blocked_until) > now) {
        return {
          allowed: false,
          blockedUntil: new Date(existingLimit.blocked_until)
        };
      }

      // Se não existe ou janela expirou, criar/resetar
      if (!existingLimit || new Date(existingLimit.window_start) < windowStart) {
        const { error: upsertError } = await supabase
          .from('rate_limits')
          .upsert({
            user_id: userId || null,
            ip_address: ipAddress || null,
            endpoint: config.endpoint,
            requests_count: 1,
            window_start: now,
            blocked_until: null
          }, {
            onConflict: userId ? 'user_id,endpoint' : 'ip_address,endpoint'
          });

        if (upsertError) {
          console.error('Erro ao criar rate limit:', upsertError);
          return { allowed: true };
        }

        return {
          allowed: true,
          remainingRequests: config.maxRequests - 1,
          resetTime: new Date(now.getTime() + config.windowMinutes * 60000)
        };
      }

      // Incrementar contador
      const newCount = existingLimit.requests_count + 1;
      
      if (newCount > config.maxRequests) {
        // Bloquear se excedeu limite
        const blockedUntil = config.blockDurationMinutes 
          ? new Date(now.getTime() + config.blockDurationMinutes * 60000)
          : null;

        await supabase
          .from('rate_limits')
          .update({
            requests_count: newCount,
            blocked_until: blockedUntil,
            updated_at: now
          })
          .eq('id', existingLimit.id);

        return {
          allowed: false,
          blockedUntil
        };
      }

      // Atualizar contador
      await supabase
        .from('rate_limits')
        .update({
          requests_count: newCount,
          updated_at: now
        })
        .eq('id', existingLimit.id);

      return {
        allowed: true,
        remainingRequests: config.maxRequests - newCount,
        resetTime: new Date(existingLimit.window_start).getTime() + config.windowMinutes * 60000
      };

    } catch (error) {
      console.error('Erro no rate limiter:', error);
      // Em caso de erro, permitir a requisição
      return { allowed: true };
    }
  }

  static async isBlocked(endpoint: string, userId?: string, ipAddress?: string): Promise<boolean> {
    const result = await this.checkLimit(endpoint, userId, ipAddress);
    return !result.allowed;
  }

  static getConfig(endpoint: string): RateLimitConfig | undefined {
    return this.configs.get(endpoint);
  }

  static setConfig(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
  }
}
```

3. **Criar middleware para hooks** (1.5h)
```typescript
// src/hooks/useRateLimitedAction.ts
import { useCallback, useState } from 'react';
import { RateLimiter, RateLimitResult } from '@/lib/security/rateLimiter';
import { useToast } from '@/components/ui/use-toast';
import { securityLogger, SecurityEventType } from '@/lib/security/logger';

export function useRateLimitedAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  endpoint: string
): {
  execute: T;
  isLimited: boolean;
  limitInfo: RateLimitResult | null;
} {
  const [isLimited, setIsLimited] = useState(false);
  const [limitInfo, setLimitInfo] = useState<RateLimitResult | null>(null);
  const { toast } = useToast();

  const execute = useCallback(async (...args: any[]) => {
    try {
      // Verificar rate limit antes da ação
      const limitResult = await RateLimiter.checkLimit(endpoint);
      setLimitInfo(limitResult);

      if (!limitResult.allowed) {
        setIsLimited(true);
        
        // Log do bloqueio
        await securityLogger.logEvent({
          type: SecurityEventType.API_RATE_LIMIT,
          severity: 'medium',
          endpoint,
          details: {
            blocked_until: limitResult.blockedUntil,
            reason: 'Rate limit exceeded'
          }
        });

        // Mostrar mensagem apropriada
        const message = limitResult.blockedUntil 
          ? `Muitas tentativas. Tente novamente após ${limitResult.blockedUntil.toLocaleTimeString()}`
          : 'Limite de requisições excedido. Tente novamente mais tarde.';

        toast({
          title: "Limite excedido",
          description: message,
          variant: "destructive"
        });

        throw new Error('Rate limit exceeded');
      }

      setIsLimited(false);

      // Executar ação
      const result = await action(...args);

      // Log de sucesso se perto do limite
      if (limitResult.remainingRequests !== undefined && limitResult.remainingRequests < 5) {
        await securityLogger.logEvent({
          type: SecurityEventType.API_UNUSUAL_ACTIVITY,
          severity: 'low',
          endpoint,
          details: {
            remaining_requests: limitResult.remainingRequests,
            near_limit: true
          }
        });
      }

      return result;

    } catch (error) {
      if (error.message !== 'Rate limit exceeded') {
        // Log de erro se não for rate limiting
        await securityLogger.logEvent({
          type: SecurityEventType.SYSTEM_ERROR,
          severity: 'high',
          endpoint,
          details: {
            error: error.message,
            action: 'rate_limited_action'
          }
        });
      }
      throw error;
    }
  }, [action, endpoint, toast]) as T;

  return { execute, isLimited, limitInfo };
}
```

4. **Integrar com ações críticas** (0.5h)
```typescript
// src/hooks/useAuthManager.ts - ATUALIZAR
import { useRateLimitedAction } from './useRateLimitedAction';

export function useAuthManager() {
  // Ação original de login
  const loginAction = useCallback(async (email: string, password: string) => {
    // Implementação existente
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  }, []);

  // Login com rate limiting
  const { execute: login, isLimited: isLoginLimited } = useRateLimitedAction(
    loginAction,
    'auth.login'
  );

  return {
    login,
    isLoginLimited,
    // outros métodos...
  };
}
```

**Critérios de Aceite:**
- [ ] Tabela rate_limits criada
- [ ] RateLimiter implementado
- [ ] Hook useRateLimitedAction criado
- [ ] Integração com login funcionando
- [ ] Logs de rate limiting ativos

---

### **✅ SEMANA 3 - OTIMIZAÇÕES (5 dias)**

#### **DIA 9-10: Integrar Sentry para Monitoramento**
**Tempo estimado**: 12 horas (2 dias)  
**Responsável**: Dev FullStack  

**Tarefas Dia 9:**
1. **Configurar Sentry** (4h)
2. **Integrar com frontend** (4h)

**Tarefas Dia 10:**
1. **Integrar com Edge Functions** (2h)
2. **Configurar alertas** (2h)

#### **DIA 11-12: Criar Testes de Segurança Automatizados**
**Tempo estimado**: 12 horas (2 dias)  
**Responsável**: Dev Backend + QA  

#### **DIA 13: Implementar Audit Trails Avançados**
**Tempo estimado**: 6 horas  
**Responsável**: Dev Backend  

---

### **📊 SEMANA 4 - VALIDAÇÃO (5 dias)**

#### **DIA 14-15: Penetration Testing**
#### **DIA 16: Documentação de Segurança**
#### **DIA 17-18: Treinamento da Equipe**

---

## 🔧 CONFIGURAÇÕES E VARIÁVEIS

### **Vault Secrets (Configurar no Supabase)**
```sql
-- Executar após ativação do Vault
SELECT vault.create_secret('n8n_webhook_secret', 'SEU_SECRET_AQUI');
SELECT vault.create_secret('evolution_api_token', 'SEU_TOKEN_AQUI');
SELECT vault.create_secret('default_user_password', 'SecureP@ssw0rd123!');
SELECT vault.create_secret('smtp_password', 'SEU_SMTP_PASSWORD');
SELECT vault.create_secret('sentry_dsn', 'SEU_SENTRY_DSN');
```

### **Variáveis de Ambiente (.env.local)**
```env
# Manter apenas variáveis públicas
VITE_SUPABASE_URL=https://ibmyytoyqjoycrgutzef.supabase.co
VITE_SUPABASE_ANON_KEY=seu_anon_key_aqui
VITE_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0

# Remover (mover para Vault):
# VITE_DEFAULT_NEW_USER_PASSWORD - agora no Vault
```

### **Edge Functions Environment**
```env
# Configurar no Supabase Dashboard
SUPABASE_URL=https://ibmyytoyqjoycrgutzef.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key
SENTRY_DSN=seu_sentry_dsn (opcional)
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### **🔥 Críticos (Semana 1)**
- [ ] Supabase Vault ativo e funcionando
- [ ] Todas as policies RLS corrigidas (não permissivas)
- [ ] Autenticação N8N implementada com Bearer token
- [ ] Dados sensíveis removidos do código (sem hardcoded)
- [ ] Logs de segurança básicos funcionando

### **⚠️ Importantes (Semana 2)**
- [ ] Sanitização XSS em todos os formulários
- [ ] Security headers configurados (dev e produção)
- [ ] Rate limiting ativo em endpoints críticos
- [ ] Middleware de segurança implementado

### **✅ Desejáveis (Semana 3)**
- [ ] Sentry integrado e monitorando
- [ ] Testes de segurança automatizados
- [ ] Audit trails avançados
- [ ] Documentação de segurança completa

### **📊 Validação Final (Semana 4)**
- [ ] Penetration testing realizado
- [ ] Vulnerabilidades críticas corrigidas
- [ ] Equipe treinada em práticas de segurança
- [ ] Sistema pronto para produção

---

## 🚨 ALERTAS E MONITORAMENTO

### **Eventos que Devem Gerar Alertas Críticos**
1. **Multiple failed login attempts** (5+ em 15min)
2. **RLS policy violation attempt**
3. **Unusual data export volume** (>1000 registros)
4. **Service role key usage in frontend**
5. **Rate limit blocks** (multiple endpoints)

### **Métricas de Segurança para Dashboard**
- Total de eventos de segurança por dia
- Taxa de falhas de login
- Número de usuários bloqueados por rate limiting
- Tentativas de violação de RLS
- Tempo médio de resposta após implementação

---

## 📞 CONTATOS E RESPONSABILIDADES

### **Escalation Matrix**
- **Vulnerabilidade Crítica**: Notificar imediatamente + parar deploy
- **Vulnerabilidade Alta**: Resolver em 24h
- **Vulnerabilidade Média**: Resolver em 1 semana
- **Vulnerabilidade Baixa**: Próximo sprint

### **Responsáveis por Área**
- **Backend Security**: [Nome do responsável]
- **Frontend Security**: [Nome do responsável]  
- **Infrastructure Security**: [Nome do responsável]
- **Compliance**: [Nome do responsável]

---

## 📚 RECURSOS E DOCUMENTAÇÃO

### **Links Úteis**
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### **Ferramentas de Teste**
- [OWASP ZAP](https://zaproxy.org/) - Penetration testing
- [Security Headers Test](https://securityheaders.com/) - Validar headers
- [Mozilla Observatory](https://observatory.mozilla.org/) - Scan geral

---

## 🔄 PROCESSO DE ATUALIZAÇÃO

Este documento deve ser atualizado sempre que:
1. **Nova vulnerabilidade for identificada**
2. **Configuração de segurança for alterada**
3. **Nova ferramenta de segurança for adicionada**
4. **Processo de segurança for modificado**

**Última atualização**: 2025-01-27  
**Próxima revisão**: 2025-02-27  
**Versão**: 1.0
