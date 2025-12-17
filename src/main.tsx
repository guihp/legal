import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { createTheme } from '@mui/material/styles'
import { SafeThemeProvider } from './components/SafeThemeProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import type {} from '@mui/x-charts/themeAugmentation'
import { ptBR } from '@mui/x-charts/locales'

const theme = createTheme({
  palette: { mode: 'dark' },
}, ptBR);

createRoot(document.getElementById("root")!).render(
  // TEMPORARIAMENTE DESABILITADO StrictMode para resolver problema de recarregamento
  // <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SafeThemeProvider theme={theme}>
          <App />
        </SafeThemeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  // </React.StrictMode>
);
