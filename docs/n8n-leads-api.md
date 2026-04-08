# API de Leads para n8n

## Endpoint

`POST {SUPABASE_URL}/functions/v1/company-leads-api`

Autenticação por empresa:

- Header obrigatório: `x-api-key: <CHAVE_DA_EMPRESA>`
- Cada chave está vinculada a apenas uma empresa.
- A API nunca retorna/inclui leads de outras empresas.

## Exemplo cURL (criar lead)

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/company-leads-api' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: imobi_xxxxx_xxxxxxxxxxxxxxxxx' \
  -d '{
    "name": "Maria Silva",
    "email": "maria@email.com",
    "phone": "5591999999999",
    "source": "n8n",
    "message": "Lead do fluxo n8n",
    "imovel_interesse": "Apartamento 3 quartos"
  }'
```

## Exemplo cURL (listar leads da própria empresa)

```bash
curl -X GET 'https://SEU-PROJETO.supabase.co/functions/v1/company-leads-api?limit=20' \
  -H 'x-api-key: imobi_xxxxx_xxxxxxxxxxxxxxxxx'
```

## Gestão de chaves

A gestão de chaves fica na tela interna:

- Menu: `API Leads n8n`
- Rota: `/n8n-leads-api`

Somente usuários `admin`/`gestor` (e `super_admin`) podem criar e revogar chaves.
