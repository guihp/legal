# Aplicação Web

Aplicação web moderna construída com React e TypeScript.

## 🛠️ **Stack Técnico**

### **Frontend**
- ⚡ **Vite** - Build tool
- ⚛️ **React 18** - Biblioteca de interface
- 🟦 **TypeScript** - Type safety
- 🎨 **Tailwind CSS** - Estilização
- 🧩 **shadcn/ui** - Componentes UI

### **Backend & Database**
- 🐘 **Supabase** - Backend-as-a-Service
- 🗄️ **PostgreSQL** - Banco de dados
- 🔐 **Row Level Security (RLS)** - Segurança
- ⚡ **Edge Functions** - Lógica server-side

---

## 🚀 **Instalação**

### **Pré-requisitos**
- Node.js 18+
- npm ou pnpm

### **Setup**

```bash
# Instalar dependências
npm install
# ou
pnpm install

# Executar em desenvolvimento
npm run dev
# ou
pnpm dev
```

---

## ⚙️ **Configuração**

### **Variáveis de Ambiente**

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

---

## 📦 **Scripts Disponíveis**

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Linting
npm run lint
```

---

## 🏗️ **Estrutura do Projeto**

```
├── src/
│   ├── components/     # Componentes React
│   ├── hooks/          # Custom hooks
│   ├── services/       # Serviços e APIs
│   ├── lib/            # Utilitários
│   └── pages/          # Páginas
├── public/             # Assets estáticos
└── package.json
```

---

## 📄 **Licença**

Este projeto está sob licença proprietária.

---

**Versão:** 1.0.0
