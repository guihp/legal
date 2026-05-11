# Dockerfile para deploy no Coolify
# Build multi-stage para otimizar tamanho da imagem

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json pnpm-lock.yaml* ./

# Instalar dependências
# Preferir package-lock quando disponível para evitar instalar pnpm em todo build.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; else npm install --no-audit --no-fund; fi

# Copiar código fonte
COPY . .

# Build da aplicação
# As variáveis de ambiente serão injetadas pelo Coolify no momento do build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_WHATSAPP_API_BASE
ARG VITE_EVOLUTION_API_URL
ARG VITE_VIVAREAL_API_KEY
ARG VITE_EMAIL_SERVICE_URL
ARG VITE_PUBLIC_APP_URL
ARG VITE_PUBLIC_SITE_DOMAIN

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_WHATSAPP_API_BASE=$VITE_WHATSAPP_API_BASE
ENV VITE_EVOLUTION_API_URL=$VITE_EVOLUTION_API_URL
ENV VITE_VIVAREAL_API_KEY=$VITE_VIVAREAL_API_KEY
ENV VITE_EMAIL_SERVICE_URL=$VITE_EMAIL_SERVICE_URL
ENV VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL
ENV VITE_PUBLIC_SITE_DOMAIN=$VITE_PUBLIC_SITE_DOMAIN

# Build para produção
RUN npm run build

# Stage 2: Production - Serve com Nginx
FROM nginx:alpine

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health 2>/dev/null || exit 1

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]

