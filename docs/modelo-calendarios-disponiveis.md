# Modelo de Trazer Calendários Disponíveis

## 📋 Visão Geral

Este documento explica como funciona o sistema de busca e exibição de calendários disponíveis na aba **"Calendários"** do módulo **Plantão** (`PlantaoView.tsx`).

---

## 🔄 Fluxo de Busca de Calendários

### 1. **Função Principal: `puxarAgendas()`**

Localização: `src/components/PlantaoView.tsx` (linhas 114-220)

#### Etapas do Processo:

**a) Obtenção de Dados do Usuário e Empresa**
```typescript
// 1. Buscar usuário autenticado
const { data: { user } } = await supabase.auth.getUser();

// 2. Buscar perfil do usuário (company_id e role)
const { data: profile } = await supabase
  .from('user_profiles')
  .select('company_id, role')
  .eq('id', user.id)
  .single();
```

**b) Chamada ao Webhook N8N**
```typescript
const resp = await fetch(
  "https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/id_agendas",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      funcao: "leitura",
      company_id: companyId,
      user_id: user?.id
    }),
  }
);
```

**Parâmetros enviados:**
- `funcao`: "leitura" (indica que é uma busca de calendários)
- `company_id`: ID da empresa do usuário logado
- `user_id`: ID do usuário autenticado

**c) Processamento da Resposta**

O webhook retorna os dados no seguinte formato (atualizado em 23/01/2026):

```json
[
  {
    "calendars": [
      {
        "Calendar Name": "jasteloempreendimentos@gmail.com",
        "Calendar ID": "jasteloempreendimentos@gmail.com",
        "Time Zone": "America/Fortaleza",
        "Access Role": "owner",
        "Conference Allowed": "hangoutsMeet",
        "Color": "#9fe1e7",
        "Default Reminders": "popup in 30 minutes",
        "Primary Calendar": "Yes",
        "Selected": "Yes"
      }
    ],
    "assigned_user_id": "f915f6b4-22d0-4f71-be29-0f9dd299cc3c"
  }
]
```

O código processa este formato e mantém compatibilidade com formatos antigos:

```typescript
let list: any[] = [];

// NOVO FORMATO: Array de objetos com { calendars: [...], assigned_user_id: "..." }
if (Array.isArray(data)) {
  // Verificar se é o novo formato (objetos com propriedade "calendars")
  if (data.length > 0 && Array.isArray(data[0]?.calendars)) {
    // Novo formato: extrair calendários e preservar assigned_user_id
    list = data.flatMap((item: any) => {
      const calendars = item.calendars || [];
      // Adicionar assigned_user_id a cada calendário para facilitar filtragem
      return calendars.map((cal: any) => ({
        ...cal,
        _assigned_user_id: item.assigned_user_id // Prefixo _ para indicar campo auxiliar
      }));
    });
  }
  // FORMATO ANTIGO: lista de wrappers com chave "Calendars" (maiúscula)
  else if (data.length > 0 && Array.isArray(data[0]?.Calendars)) {
    list = data.flatMap((item: any) => item.Calendars || []);
  }
  // FORMATO ANTIGO: array direto de calendários
  else {
    list = data;
  }
} 
// FORMATO ANTIGO: Objeto com propriedade "Calendars" ou "calendars"
else if (Array.isArray(data?.Calendars) || Array.isArray(data?.calendars)) {
  list = data.Calendars || data.calendars;
} 
// FORMATO ANTIGO: Objeto com propriedade "events"
else if (Array.isArray(data?.events)) {
  list = data.events;
} 
// Nenhum formato reconhecido
else {
  list = [];
}
```

**Importante:** O novo formato inclui `assigned_user_id` diretamente na resposta, facilitando a filtragem por usuário vinculado.

**d) Normalização dos Dados**

Os calendários são normalizados para um formato padrão:

```typescript
const normalized = list.map((item: any) => ({
  name: item?.["Calendar Name"] ?? item?.name ?? "Sem nome",
  id: item?.["Calendar ID"] ?? item?.id ?? "",
  timeZone: item?.["Time Zone"] ?? item?.timeZone ?? "",
  accessRole: item?.["Access Role"] ?? item?.accessRole ?? "",
  color: item?.["Color"] ?? item?.color ?? "#6b7280",
  primary: item?.["Primary Calendar"] ?? item?.primary ?? "No",
  defaultReminders: item?.["Default Reminders"],
  conferenceAllowed: item?.["Conference Allowed"],
  // Preservar assigned_user_id se vier do novo formato
  _assigned_user_id: item?._assigned_user_id,
}));
```

**Campos suportados (com fallback):**
- `name`: "Calendar Name" ou "name"
- `id`: "Calendar ID" ou "id"
- `timeZone`: "Time Zone" ou "timeZone"
- `accessRole`: "Access Role" ou "accessRole"
- `color`: "Color" ou "color" (padrão: "#6b7280")
- `primary`: "Primary Calendar" ou "primary" (padrão: "No")
- `_assigned_user_id`: ID do usuário vinculado (vem do novo formato do N8N, prefixo `_` indica campo auxiliar)

**e) Filtragem por Empresa e Role**

Após normalizar, os calendários são filtrados com base na empresa e no role do usuário. O novo formato do N8N já inclui `assigned_user_id`, facilitando a filtragem:

```typescript
// Buscar TODAS as agendas da empresa no banco
const { data: companySchedules } = await supabase
  .from('oncall_schedules')
  .select('calendar_id, assigned_user_id')
  .eq('company_id', userProfile.company_id);

const companyCalendarIds = companySchedules?.map(s => s.calendar_id) || [];

if (userProfile.role === 'corretor') {
  // Corretor vê apenas as agendas onde está vinculado
  // Primeiro, verificar se assigned_user_id vem do N8N (novo formato)
  // Depois, verificar no banco
  const myIds = companySchedules
    ?.filter(s => s.assigned_user_id === user.id)
    .map(s => s.calendar_id) || [];
  
  // Combinar ambos: calendários do N8N com assigned_user_id OU do banco
  finalCalendars = normalized.filter(c => 
    c._assigned_user_id === user.id || myIds.includes(c.id)
  );
} else {
  // Gestor/Admin vê todas as agendas da empresa
  // Se o calendário tem assigned_user_id no novo formato, já está vinculado
  // Caso contrário, verificar se está no banco
  finalCalendars = normalized.filter(c => 
    c._assigned_user_id || companyCalendarIds.includes(c.id)
  );
}
```

**Lógica de Filtragem:**
- **Corretor**: 
  - Vê calendários onde `_assigned_user_id === user.id` (novo formato do N8N)
  - OU onde `assigned_user_id = user.id` na tabela `oncall_schedules` (banco)
- **Gestor/Admin**: 
  - Vê calendários que têm `_assigned_user_id` (já vinculados no N8N)
  - OU que estão vinculados à empresa no banco (`company_id`)

---

## 🗄️ Tabela `oncall_schedules`

### Estrutura

A tabela `oncall_schedules` armazena a vinculação entre calendários e empresas/usuários:

```sql
CREATE TABLE public.oncall_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,              -- Usuário que criou/editou
    company_id UUID NOT NULL,            -- Empresa dona do calendário
    calendar_id TEXT NOT NULL,           -- ID do calendário (vem do Google Calendar via N8N)
    calendar_name TEXT NOT NULL,         -- Nome do calendário
    assigned_user_id UUID,               -- Corretor vinculado à agenda (NULL = não vinculado)
    -- Horários de trabalho por dia da semana
    mon_works BOOLEAN NOT NULL DEFAULT false,
    mon_start TIME,
    mon_end TIME,
    -- ... (tue, wed, thu, fri, sat, sun)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Constraint Única

Existe uma constraint única em `(company_id, calendar_id)` para garantir que cada empresa tenha apenas um registro por calendário:

```sql
ALTER TABLE public.oncall_schedules
ADD CONSTRAINT oncall_schedules_company_calendar_unique 
UNIQUE (company_id, calendar_id);
```

### Row Level Security (RLS)

**Política de SELECT:**
```sql
CREATE POLICY "oncall_select" ON public.oncall_schedules
FOR SELECT
USING (
  user_id = auth.uid() 
  OR assigned_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() 
      AND up.company_id = oncall_schedules.company_id 
      AND up.role IN ('gestor', 'admin')
  )
);
```

**Permissões:**
- Usuário pode ver se é o criador (`user_id = auth.uid()`)
- Usuário pode ver se está vinculado (`assigned_user_id = auth.uid()`)
- Gestor/Admin pode ver todos da sua empresa

---

## 🔄 Disparo Automático

### Quando a aba "Calendários" é ativada

```typescript
useEffect(() => {
  if (activeTab === 'calendarios') {
    puxarAgendas("auto");
  }
}, [activeTab]);
```

**Modos de execução:**
- `"auto"`: Disparo automático (sem feedback visual de loading)
- `"manual"`: Disparo manual via botão "Atualizar" (com feedback visual)

---

## 📊 Estado do Componente

### Estados Principais

```typescript
const [calendars, setCalendars] = useState<Array<{
  name: string;
  id: string;
  timeZone: string;
  accessRole: string;
  color: string;
  primary: string;
  defaultReminders?: string;
  conferenceAllowed?: string;
}>>([]);

const [loading, setLoading] = useState(false);
const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
const [lastCount, setLastCount] = useState<number | null>(null);
const [status, setStatus] = useState<string | null>(null);
```

### Filtragem Local

Os calendários podem ser filtrados localmente por nome ou ID:

```typescript
const filteredCalendars = useMemo(() => {
  const term = searchTerm.trim().toLowerCase();
  return calendars.filter((c) => {
    return term === "" || 
           c.name.toLowerCase().includes(term) || 
           c.id.toLowerCase().includes(term);
  });
}, [calendars, searchTerm]);
```

---

## 🎨 Renderização

### Grid de Calendários

Os calendários são exibidos em um grid responsivo:

```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
  {filteredCalendars.map((cal) => (
    <div key={`${cal.id}-${cal.name}`} className="...">
      {/* Card do calendário */}
    </div>
  ))}
</div>
```

**Cada card exibe:**
- Indicador de cor do calendário
- Nome do calendário (truncado se muito longo)
- Botão para copiar Calendar ID
- Botão para deletar agenda

---

## 🔐 Segurança e Permissões

### Hierarquia de Acesso

1. **Admin**: Vê e gerencia todos os calendários de todas as empresas
2. **Gestor**: Vê e gerencia todos os calendários da sua empresa
3. **Corretor**: Vê apenas os calendários onde está vinculado (`assigned_user_id`)

### Validação no Backend

- RLS garante que apenas usuários autorizados vejam os calendários
- Filtragem no frontend é apenas para UX (segurança real está no RLS)

---

## 🔗 Integração com N8N

### Endpoint do Webhook

**URL Base:** `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/id_agendas`

**Operações suportadas:**

1. **Leitura** (`funcao: "leitura"`)
   - Retorna lista de calendários disponíveis
   - Filtra por `company_id` e `user_id`

2. **Adicionar** (`funcao: "adicionar"`)
   - Cria novo calendário no Google Calendar
   - Retorna o `calendar_id` criado

3. **Apagar** (`funcao: "apagar"`)
   - Remove calendário do Google Calendar
   - Requer `id` do calendário

---

## 📝 Observações Importantes

1. **Fonte de Verdade**: Os calendários vêm do Google Calendar via webhook N8N, mas a vinculação empresa/usuário está no Supabase (`oncall_schedules`)

2. **Sincronização**: Quando um calendário é criado via webhook, um registro é inserido em `oncall_schedules` para vincular à empresa

3. **Filtragem Dupla**: 
   - Primeiro filtra no webhook (por `company_id`)
   - Depois filtra no frontend (por role do usuário)

4. **Fallback de Formato**: O código trata múltiplos formatos de resposta do webhook para garantir compatibilidade

5. **Performance**: A busca é feita automaticamente ao abrir a aba, mas pode ser atualizada manualmente

---

## 🐛 Troubleshooting

### "Nenhum calendário para exibir"

**Possíveis causas:**
1. Nenhum calendário vinculado à empresa no `oncall_schedules`
2. Webhook N8N não retornou calendários para a empresa
3. Filtragem por role está ocultando calendários (corretor sem vinculação)

### Calendários não aparecem após criar

**Solução:**
- Verificar se o registro foi inserido em `oncall_schedules` com `company_id` correto
- Recarregar a lista manualmente (botão "Atualizar")

---

## 📚 Arquivos Relacionados

- `src/components/PlantaoView.tsx` - Componente principal
- `src/components/AgendaView.tsx` - Usa a mesma lógica para carregar corretores
- `supabase/migrations/20250825193901_complete_remote_schema.sql` - Schema da tabela
- `supabase/migrations/20260113000000_add_oncall_schedules_unique_constraint.sql` - Constraint única

---

---

## 🔄 Mudanças Recentes (23/01/2026)

### Novo Formato do Webhook N8N

O webhook agora retorna um array de objetos, onde cada objeto contém:
- `calendars`: Array de calendários
- `assigned_user_id`: ID do usuário vinculado ao grupo de calendários

**Vantagens:**
- `assigned_user_id` já vem na resposta, reduzindo necessidade de consultas ao banco
- Facilita filtragem por usuário vinculado
- Mantém compatibilidade com formatos antigos

**Exemplo de resposta:**
```json
[
  {
    "calendars": [
      {
        "Calendar Name": "jasteloempreendimentos@gmail.com",
        "Calendar ID": "jasteloempreendimentos@gmail.com",
        "Time Zone": "America/Fortaleza",
        "Access Role": "owner",
        "Conference Allowed": "hangoutsMeet",
        "Color": "#9fe1e7",
        "Default Reminders": "popup in 30 minutes",
        "Primary Calendar": "Yes",
        "Selected": "Yes"
      }
    ],
    "assigned_user_id": "f915f6b4-22d0-4f71-be29-0f9dd299cc3c"
  }
]
```

---

**Última atualização:** 23/01/2026
