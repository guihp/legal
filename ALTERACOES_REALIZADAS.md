# ✅ Alterações Realizadas

## 1. Removida página "Contratos (MVP)" do Sidebar
- **Arquivo:** `src/components/AppSidebar.tsx`
- **Alteração:** Removido o item do menu "Contratos (MVP)"

## 2. Máscara de Telefone Brasileiro
- **Arquivo:** `src/components/ConnectionsViewSimplified.tsx`
- **Funcionalidade:**
  - Campo aceita apenas números
  - Formatação automática no padrão: `(DDD) 9 XXXX-XXXX`
  - O número 9 após o DDD é sempre adicionado automaticamente (padrão brasileiro)
  - Máscara aplicada em tempo real enquanto o usuário digita
  - Ao enviar, remove a formatação e adiciona código do país (+55) se necessário

## 3. Verificação de Integração (Webhooks N8N)
- **Confirmação:** A aplicação está usando **webhooks do N8N**, não chamadas diretas à Evolution API
- **Arquivo:** `src/hooks/useWhatsAppInstances.ts`
- **Variável de ambiente:** `VITE_WHATSAPP_API_BASE`
- **URL padrão:** `https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook`
- **Endpoints utilizados:**
  - `GET /whatsapp-instances` - Listar instâncias
  - `POST /criar-instancia` - Criar nova instância
  - `POST /deletar-instancia` - Deletar instância
  - `POST /conectar-instancia` - Conectar instância
  - `POST /desconectar-instancia` - Desconectar instância
  - `POST /puxar-qrcode` - Obter QR Code
  - `POST /config-instancia` - Configurar instância
  - `POST /edit-config-instancia` - Editar configuração

Todas as chamadas passam pelos webhooks N8N configurados, não há integração direta com Evolution API no frontend.


