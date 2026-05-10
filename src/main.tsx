import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startVersionChecker } from './lib/versionChecker'
import { ErrorBoundary } from './components/ErrorBoundary'
import { createTheme } from '@mui/material/styles'
import { SafeThemeProvider } from './components/SafeThemeProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import type {} from '@mui/x-charts/themeAugmentation'
import { ptBR } from '@mui/x-charts/locales'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const theme = createTheme({
  palette: { mode: 'dark' },
}, ptBR);

// React Query — cache compartilhado entre hooks.
// staleTime curto pra dados de imóveis/leads (mudam frequentemente);
// retry 1 evita rajada de retries em falhas de rede.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s sem refetch automático
      gcTime: 5 * 60_000,        // 5min em memória após último uso
      retry: 1,
      refetchOnWindowFocus: false, // evita refetch agressivo ao trocar de aba
    },
  },
});

createRoot(document.getElementById("root")!).render(
  // TEMPORARIAMENTE DESABILITADO StrictMode para resolver problema de recarregamento
  // <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SafeThemeProvider theme={theme}>
            <App />
          </SafeThemeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  // </React.StrictMode>
);

// Verificação automática de nova versão após deploy (só em produção).
// Faz polling a cada 5 min no /build-meta.json e recarrega se mudou.
startVersionChecker();
